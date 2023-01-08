const express = require("express");
const csrf = require("tiny-csrf");
const app = express();
const { Todo, User } = require("./models");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const path = require("path");

const passport = require("passport");
const LocalStrategy = require("passport-local");
const session = require("express-session");
const connectEnsureLogin = require("connect-ensure-login");
const bcrypt = require("bcrypt");
const flash = require("connect-flash");

const saltRounds = 10;

app.use(bodyParser.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser("shh"));
app.use(csrf("this_should_be_32_character_long", ["POST", "PUT", "DELETE"]));
app.use(flash());

app.use(
  session({
    secret: "my-super-secret-key-21728172615261562",
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

app.use(function (request, response, next) {
  response.locals.messages = request.flash();
  next();
});

app.use(passport.initialize());
app.use(passport.session());

passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    (email, password, done) => {
      User.findOne({ where: { email } })
        .then(async (user) => {
          if (!user) {
            return done(null, false, { message: "Incorrect username." });
          }
          const result = await bcrypt.compare(password, user.password);
          if (result) {
            return done(null, user);
          } else {
            return done(null, false, { message: "Incorrect password." });
          }
        })
        .catch((err) => {
          done(err, null);
        });
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  User.findByPk(id)
    .then((user) => {
      done(null, user);
    })
    .catch((err) => {
      done(err, null);
    });
});

app.set("view engine", "ejs");

app.get("/", (req, res) => {
  if (req.user && req.user.id) {
    res.redirect("/todos");
  } else {
    res.render("index", { csrfToken: req.csrfToken() });
  }
});

app.get(
  "/todos",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const userId = request.user.id;
    const overdueTodos = await Todo.overdue(userId);
    const dueTodayTodos = await Todo.dueToday(userId);
    const dueLaterTodos = await Todo.dueLater(userId);
    const completedTodos = await Todo.completed(userId);
    if (request.accepts("html")) {
      response.render("todos", {
        overdueTodos,
        dueTodayTodos,
        dueLaterTodos,
        completedTodos,
        user: request.user,
        csrfToken: request.csrfToken(),
      });
    } else {
      response.json({
        overdueTodos,
        dueTodayTodos,
        dueLaterTodos,
        completedTodos,
      });
    }
  }
);

app.get("/signup", (request, response) => {
  response.render("signup", {
    csrfToken: request.csrfToken(),
    title: "Signup",
  });
});

app.get("/login", (request, response) => {
  response.render("login", { csrfToken: request.csrfToken(), title: "Login" });
});

app.post(
  "/session",
  passport.authenticate("local", {
    failureRedirect: "/login",
    failureFlash: true,
  }),
  (request, response) => {
    response.redirect("/todos");
  }
);

app.get("/signout", (request, response) => {
  request.logout((err) => {
    if (err) {
      /* eslint-disable no-undef */
      return next(err);
    }
    response.redirect("/");
  });
});

app.post("/users", async (request, response) => {
  const { firstName, lastName, email, password } = request.body;

  const hashedPassword = await bcrypt.hash(password, saltRounds);

  try {
    const user = await User.createUser({
      firstName,
      lastName,
      email,
      password: hashedPassword,
    });
    request.logIn(user, (err) => {
      if (err) {
        console.log(err);
        throw err;
      }
      response.redirect("/todos");
    });
  } catch (error) {
    error.errors.forEach((element) => {
      request.flash("error", element.message);
    });
    response.redirect("signup");
  }
});

app.use(express.static(path.join(__dirname, "public")));

app.get(
  "/alltodos",
  connectEnsureLogin.ensureLoggedIn(),
  async function (request, response) {
    try {
      const todos = await Todo.getTodos(request.user.id);
      return response.json(todos);
    } catch (error) {
      return response.status(500).send(error);
    }
  }
);

app.get(
  "/todos/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async function (request, response) {
    try {
      const todo = await Todo.findByPk(request.params.id);
      return response.json(todo);
    } catch (error) {
      return response.status(422).json(error);
    }
  }
);

app.post(
  "/todos",
  connectEnsureLogin.ensureLoggedIn(),
  async function (request, response) {
    try {
      await Todo.addTodo({ ...request.body, userId: request.user.id });
      return response.redirect("/todos");
    } catch (error) {
      error.errors.forEach((element) => {
        request.flash("error", element.message);
      });
      response.redirect("/todos");
    }
  }
);

app.put(
  "/todos/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async function (request, response) {
    const todo = await Todo.findByPk(request.params.id);
    const completed = request.body.completed;
    try {
      const updatedTodo = await todo.setCompletionStatus(
        completed === true,
        request.user.id
      );
      return response.json(updatedTodo);
    } catch (error) {
      return response.status(404).json(error);
    }
  }
);

app.delete(
  "/todos/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async function (request, response) {
    try {
      const todo = await Todo.findByPk(request.params.id);
      await todo.removeTodo(request.user.id);
      return response.json({ success: true });
    } catch (error) {
      return response.status(404).json({ success: false });
    }
  }
);

module.exports = app;
