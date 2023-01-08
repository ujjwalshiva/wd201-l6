const app = require("./app");
let port = 3000;
if (typeof process.env.PORT !== "undefined") {
  port = process.env.PORT;
}

app.listen(port, () => {
  console.log("Started express server at port " + port);
});
