const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const bcrypt = require("bcryptjs");

const dbPath = path.join(__dirname, "database.sqlite");
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) return console.error("Error opening database:", err.message);
  console.log("Connected to the SQLite database.");
});

db.serialize(() => {
  // tasks reference users, so tasks are dropped first and created last.
  db.run("DROP TABLE IF EXISTS tasks");
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
    { name: "Specialist One", email: "specialist1@example.com", role: "specialist" },
    { name: "Specialist Two", email: "specialist2@example.com", role: "specialist" },
    { name: "Child One", email: "child@example.com", role: "child" },
  ];

  const insertUser = db.prepare(
    "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
  );
  users.forEach((u) => {
    insertUser.run(u.name, u.email, bcrypt.hashSync("password123", 10), u.role);
  });
  insertUser.finalize();

  // M4 - Tasks (status is 'pending' or 'done'; due_date is YYYY-MM-DD)
  db.run(`
    CREATE TABLE tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      child_id INTEGER NOT NULL REFERENCES users(id),
      assigned_by INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      development_area TEXT NOT NULL
        CHECK (development_area IN ('Cognitive', 'Language', 'Social-Emotional', 'Motor')),
      due_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done')),
      completed_at TEXT
    )
  `);

  // Synthetic sample tasks for the seeded child, assigned by the seeded parent.
  const insertTask = db.prepare(`
    INSERT INTO tasks
      (child_id, assigned_by, title, description, development_area, due_date, status, completed_at)
    VALUES (
      (SELECT id FROM users WHERE email = 'child@example.com'),
      (SELECT id FROM users WHERE email = 'parent@example.com'),
      ?, ?, ?, ?, ?, ?
    )
  `);
  insertTask.run("Read for 20 minutes", "Read one chapter of a book.", "Language", "2026-11-23", "done", "2026-11-22T16:00:00.000Z");
  insertTask.run("Draw a picture", "Draw your favourite animal.", "Cognitive", "2026-11-25", "pending", null);
  insertTask.run("Throw a ball 10 times", "Practise throwing and catching.", "Motor", "2026-11-26", "pending", null);
  insertTask.run("Share a toy with a friend", "Take turns during play.", "Social-Emotional", "2026-11-27", "pending", null);
  insertTask.finalize();

  db.all(
    "SELECT id, name, email, role, substr(password_hash, 1, 20) AS hash_start FROM users",
    [],
    (err, rows) => {
      if (err) console.error("Error reading users:", err.message);
      else console.table(rows);
      console.log("Database successfully seeded (users and tasks).");
      db.close();
    },
  );
});
