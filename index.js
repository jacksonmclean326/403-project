let express = require("express");
let app = express();
let path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
let bodyParser = require("body-parser");
let session = require("express-session");

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(express.static(path.join(__dirname, "public")));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

const port = process.env.PORT || 3001;

const knex = require("knex")({
  client: "pg",
  connection: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT),
  },
});

app.use(
  session({
    secret: process.env.SESSION_SECRET || "cougar_bytes_secret",
    resave: false,
    saveUninitialized: false,
  }),
);

// Send anyone who hasn't logged in back to the home page
function requireLogin(req, res, next) {
  if (req.session.loggedIn) {
    next();
  } else {
    res.redirect("/");
  }
}

app.get("/", (req, res) => {
  res.render("index", { loggedIn: req.session.loggedIn });
});

app.post("/login", (req, res) => {
  knex
    .select()
    .from("user")
    .where("email", req.body.username)
    .andWhere("password", req.body.password)
    .then((users) => {
      if (users.length === 0) {
        req.session.loggedIn = false;
        res.send(
          "<script>alert('cannot log in'); window.location.href = '/';</script>",
        );
      } else {
        req.session.loggedIn = true;
        res.redirect("/");
      }
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send("Database error: " + err.message);
    });
});

app.get("/users", requireLogin, (req, res) => {
  knex
    .select("email", "first_name", "last_name")
    .from("user")
    .then((users) => {
      res.render("users", { users });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send("Database error: " + err.message);
    });
});

app.get("/budgets", requireLogin, async (req, res) => {
  try {
    const goals = await knex.select().from("goal");
    res.render("budgets", { goals });
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error: " + err.message);
  }
});

app.post("/addGoal", requireLogin, async (req, res) => {
  const goal = req.body;
  try {
    await knex("goal").insert(goal);
    res.redirect("/budgets");
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error: " + err.message);
  }
});

app.post("/editGoal/:id", requireLogin, async (req, res) => {
  const id = Number(req.params.id);
  const goal = req.body;

  try {
    await knex("goal").where({ id }).update(goal);
    res.redirect("/budgets");
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error: " + err.message);
  }
});

app.post("/deleteGoal/:id", requireLogin, async (req, res) => {
  try {
    await knex("goal").where({ id: req.params.id }).delete();
    res.redirect("/budgets");
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error: " + err.message);
  }
});

app.get("/addUser", requireLogin, (req, res) => {
  res.render("add");
});

app.post("/addUser", requireLogin, async (req, res) => {
  const newUser = req.body;
  try {
    await knex.insert(newUser).into("user");
    res.redirect("/users");
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error: " + err.message);
  }
});

app.get("/editUser/:email", requireLogin, async (req, res) => {
  try {
    const email = req.params.email;
    const user = await knex.select().from("user").where({ email }).first();
    if (!user) {
      res.status(500).send("Database error: " + err.message);
      res.redirect("users");
    } else {
      res.render("edit", { user });
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error: " + err.message);
  }
});

app.post("/editUser/:email", requireLogin, async (req, res) => {
  try {
    const email = req.params.email;
    await knex("user").update(req.body).where({ email });
    res.redirect("/users");
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error: " + err.message);
  }
});

app.post("/deleteUser/:email", requireLogin, async (req, res) => {
  try {
    const email = req.params.email;
    await knex("user").delete().where({ email });
    res.redirect("/users");
  } catch (err) {
    console.error(err);
    res.status(500).sendFile("Database error: " + err.message);
  }
});

app.get("/logout", (req, res) => {
  res.session.destroy(() => {
    res.redirect("/");
  });
});

app.listen(port, () =>
  console.log(
    `The server is listening for a client on http://localhost:${port}`,
  ),
);
