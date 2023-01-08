const request = require("supertest");
const cheerio = require("cheerio");
const db = require("../models/index");
const app = require("../app");

let server, agent;

let globalTodoId = 0;

const extractCSRFToken = (html) => {
  const $ = cheerio.load(html);
  return $("[name=_csrf]").val();
};

const login = async (agentt, email, password) => {
  const res = await agentt.get("/login");
  const csrfToken = extractCSRFToken(res.text);
  const a = await agentt.post("/session").send({
    email,
    password,
    _csrf: csrfToken,
  });
  console.log(a.statusCode);
  return a;
};

const logout = async (agentt) => {
  const res = await agentt.get("/signout");
  return res;
};

describe("Todo Application", function () {
  beforeAll(async () => {
    await db.sequelize.sync({ force: true });
    server = app.listen(5000, () => {});
    agent = request.agent(server);
  });

  afterAll(async () => {
    try {
      await db.sequelize.close();
      await server.close();
    } catch (error) {
      console.log(error);
    }
  });

  test("Sign up", async () => {
    let res = await agent.get("/login");
    let csrfToken = extractCSRFToken(res.text);
    res = await agent.post("/users").send({
      firstName: "John",
      lastName: "Doe",
      email: "johndoe@example.com",
      password: "password",
      _csrf: csrfToken,
    });
    expect(res.statusCode).toBe(302);
    res = await agent.get("/login");
    csrfToken = extractCSRFToken(res.text);
    res = await agent.post("/users").send({
      firstName: "Foo",
      lastName: "Bar",
      email: "foobar@example.com",
      password: "foobar",
      _csrf: csrfToken,
    });
    expect(res.statusCode).toBe(302);
  });

  test("Sign out", async () => {
    let res = await agent.get("/todos");
    expect(res.statusCode).toBe(200);
    res = await agent.get("/signout");
    expect(res.statusCode).toBe(302);
    res = await agent.get("/todos");
    expect(res.statusCode).toBe(302);
  });

  test("Creates a todo", async () => {
    const agent = request.agent(server);
    await login(agent, "johndoe@example.com", "password");
    const { text } = await agent.get("/todos");
    const csrfToken = extractCSRFToken(text);

    const response = await agent.post("/todos").send({
      title: "Buy milk",
      dueDate: new Date().toISOString(),
      _csrf: csrfToken,
    });
    //console.log(response.text);
    expect(response.statusCode).toBe(302);
  });

  test("Marks a todo with the given ID as complete", async () => {
    const agent = request.agent(server);
    await login(agent, "johndoe@example.com", "password");
    let res = await agent.get("/todos");
    let csrfToken = extractCSRFToken(res.text);
    await agent.post("/todos").send({
      title: "Wash Dishes",
      dueDate: new Date().toISOString(),
      _csrf: csrfToken,
    });

    const groupedTodos = await agent
      .get("/alltodos")
      .set("Accept", "application/json");
    const parsedResponse = JSON.parse(groupedTodos.text);
    const lastItem = parsedResponse[parsedResponse.length - 1];

    res = await agent.get("/todos");
    csrfToken = extractCSRFToken(res.text);

    const markCompleteResponse = await agent.put(`/todos/${lastItem.id}`).send({
      _csrf: csrfToken,
      completed: true,
    });

    const parsedUpdateResponse = JSON.parse(markCompleteResponse.text);
    expect(parsedUpdateResponse.completed).toBe(true);
  });

  test("Marks a todo with the given ID as incomplete", async () => {
    const agent = request.agent(server);
    await login(agent, "johndoe@example.com", "password");
    const groupedTodos = await agent
      .get("/alltodos")
      .set("Accept", "application/json");
    const parsedResponse = JSON.parse(groupedTodos.text);
    const completeItem = parsedResponse.find((item) => item.completed === true);

    const res = await agent.get("/todos");
    const csrfToken = extractCSRFToken(res.text);

    const markIncompleteResponse = await agent
      .put(`/todos/${completeItem.id}`)
      .send({
        _csrf: csrfToken,
        completed: false,
      });

    const parsedIncompleteResponse = JSON.parse(markIncompleteResponse.text);
    expect(parsedIncompleteResponse.completed).toBe(false);
  });

  test("Fetches all todos in the database using /todos endpoint", async () => {
    const agent = request.agent(server);
    await login(agent, "johndoe@example.com", "password");
    let res = await agent.get("/todos");
    let csrfToken = extractCSRFToken(res.text);

    await agent.post("/todos").send({
      title: "Buy xbox",
      dueDate: new Date().toISOString(),
      _csrf: csrfToken,
    });

    const response = await agent.get("/alltodos");
    const parsedResponse = JSON.parse(response.text);

    expect(parsedResponse.length).toBe(3);
    expect(parsedResponse[2].title).toBe("Buy xbox");
  });

  test("Deletes a todo with the given ID", async () => {
    const agent = request.agent(server);
    await login(agent, "johndoe@example.com", "password");
    let res = await agent.get("/todos");
    let csrfToken = extractCSRFToken(res.text);

    await agent.post("/todos").send({
      title: "Defeat Thanos",
      dueDate: new Date().toISOString(),
      _csrf: csrfToken,
    });

    const response = await agent.get("/alltodos");
    const parsedResponse = JSON.parse(response.text);

    const todoID = parsedResponse[parsedResponse.length - 1].id;

    res = await agent.get("/todos");
    csrfToken = extractCSRFToken(res.text);

    const deleteResponse = await agent.delete(`/todos/${todoID}`).send({
      _csrf: csrfToken,
    });
    console.log(deleteResponse.text);
    expect(deleteResponse.statusCode).toBe(200);

    const reresponse = await agent.get("/alltodos");
    const reresponseParsed = JSON.parse(reresponse.text);
    expect(reresponseParsed.length).toBe(parsedResponse.length - 1);
    expect(reresponseParsed.find((todo) => todo.id === todoID)).toBe(undefined);
  });

  test("Check if User A can access User B's todos", async () => {
    const agent = request.agent(server);
    await login(agent, "johndoe@example.com", "password");
    let res = await agent.get("/todos");
    let csrfToken = extractCSRFToken(res.text);

    await agent.post("/todos").send({
      title: "John Doe's todo",
      dueDate: new Date().toISOString(),
      _csrf: csrfToken,
    });

    const response = await agent.get("/alltodos");
    const parsedResponse = JSON.parse(response.text);
    const todoID = parsedResponse[parsedResponse.length - 1].id;
    globalTodoId = todoID;

    await logout(agent);
    await login(agent, "foobar@example.com", "foobar");
    res = await agent.get("/todos");
    csrfToken = extractCSRFToken(res.text);

    const accessResponse = await agent.get(`/alltodos`);
    const accessParsedResponse = JSON.parse(accessResponse.text);
    const todo = accessParsedResponse.find((todo) => todo.id === todoID);
    expect(todo).toBe(undefined);
  });
  test("Check if User A can mark User B's todos as complete", async () => {
    const agent = request.agent(server);
    await login(agent, "foobar@example.com", "foobar");
    const todoID = globalTodoId;

    let res = await agent.get("/todos");
    let csrfToken = extractCSRFToken(res.text);

    const updateTodo = await agent.put(`/todos/${todoID}`).send({
      _csrf: csrfToken,
      completed: true,
    });

    expect(updateTodo.statusCode).toBe(404);
  });
  test("Check if User A can delete User B's todos", async () => {
    const agent = request.agent(server);
    await login(agent, "foobar@example.com", "foobar");
    const todoID = globalTodoId;

    let res = await agent.get("/todos");
    let csrfToken = extractCSRFToken(res.text);

    const deleteTodo = await agent.delete(`/todos/${todoID}`).send({
      _csrf: csrfToken,
    });

    expect(deleteTodo.statusCode).toBe(404);
  });
});
