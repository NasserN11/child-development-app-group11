const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const bcrypt = require("bcryptjs");

const dbPath = path.join(__dirname, "database.sqlite");
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) return console.error("Error opening database:", err.message);
  console.log("Connected to the SQLite database.");
});

db.serialize(() => {
  db.run(
    `
        CREATE TABLE IF NOT EXISTS tasks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          status TEXT NOT NULL
        )
        `,
    (err) => {
      if (err) console.error("Erron creating table:", err.message);
    },
  );

  db.run(`DELETE FROM tasks`);

  const stmt = db.prepare(`INSERT INTO tasks (title, status) VALUES (?, ?)`);

  stmt.run("Learn Express.js", "Done");
  stmt.run("Build a backend server", "in progress");
  stmt.run("Test the API route", "pending");

  stmt.finalize((err) => {
    if (err) console.error("Error inserting data:", err.message);
    else {
      console.log("Database successfully seeded with initial tasks!");
    }
  });
});

db.serialize(() => {
  db.run("DROP TABLE IF EXISTS users");

  db.run(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('parent', 'specialist', 'child'))
    )
`);

  const users = [
    { name: "Parent One", email: "parent@example.com", role: "parent" },
    {
      name: "Specialist One",
      email: "specialist1@example.com",
      role: "specialist",
    },
    {
      name: "Specialist Two",
      email: "specialist2@example.com",
      role: "specialist",
    },
    { name: "Child One", email: "child@example.com", role: "child" },
  ];

  const insertUser = db.prepare(
    "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
  );
  users.forEach((u) => {
    insertUser.run(u.name, u.email, bcrypt.hashSync("password123", 10), u.role);
  });

  insertUser.finalize(() => {
    db.all(
      "SELECT id, name, email, role, substr(password_hash, 1, 20) AS hash_start FROM users",
      [],
      (err, rows) => {
        console.table(rows);
        db.close();
      },
    );
  });
});
