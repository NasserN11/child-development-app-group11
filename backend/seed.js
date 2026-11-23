const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const bcrypt = require("bcryptjs");
const { all, run, createEventsTable } = require("./eventsDb");
const { currentMonday } = require("./weekUtils");

async function seed(db, { demo = false, weekStart = currentMonday() } = {}) {
  await run(db, "PRAGMA foreign_keys = ON");
  await run(db, "BEGIN IMMEDIATE");
  try {
    await run(db, `CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      status TEXT NOT NULL
    )`);
    for (const [title, status] of [
      ["Learn Express.js", "Done"], ["Build a backend server", "in progress"],
      ["Test the API route", "pending"],
    ]) {
      await run(db, `INSERT INTO tasks (title, status)
        SELECT ?, ? WHERE NOT EXISTS (SELECT 1 FROM tasks WHERE title = ?)`,
      [title, status, title]);
    }

    await run(db, `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('parent', 'specialist', 'child'))
    )`);
    const users = [
      ["Parent One", "parent@example.com", "parent"],
      ["Specialist One", "specialist1@example.com", "specialist"],
      ["Specialist Two", "specialist2@example.com", "specialist"],
      ["Child One", "child@example.com", "child"],
    ];
    const ids = {};
    for (const [name, email, role] of users) {
      const matches = await all(db, "SELECT id, role FROM users WHERE email = ?", [email]);
      if (matches.length > 1 || (matches[0] && matches[0].role !== role)) {
        throw new Error("Conflicting seed account: " + email);
      }
      ids[email] = matches[0]?.id ?? (await run(db,
        "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
        [name, email, bcrypt.hashSync("password123", 10), role])).lastID;
    }

    await createEventsTable(db);
    const child = ids["child@example.com"];
    const parent = ids["parent@example.com"];
    const specialist = ids["specialist1@example.com"];
    for (const [creator, title, from, to] of [
      [parent, "Reading practice", "16:00", "16:30"],
      [specialist, "Speech therapy", "17:00", "17:45"],
    ]) {
      const start = new Date(weekStart + "T" + from + ":00+03:00").toISOString();
      const end = new Date(weekStart + "T" + to + ":00+03:00").toISOString();
      await run(db, `INSERT INTO events (child_id, created_by, title, start_time, end_time)
        SELECT ?, ?, ?, ?, ? WHERE NOT EXISTS (
          SELECT 1 FROM events WHERE child_id = ? AND created_by = ? AND title = ? AND start_time = ?
        )`, [child, creator, title, start, end, child, creator, title, start]);
    }

    if (demo) {
      await run(db, `CREATE TABLE IF NOT EXISTS parent_child_links (
        child_id INTEGER PRIMARY KEY REFERENCES users(id),
        parent_id INTEGER NOT NULL REFERENCES users(id)
      )`);
      await run(db, `CREATE TABLE IF NOT EXISTS specialist_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        parent_id INTEGER NOT NULL REFERENCES users(id),
        child_id INTEGER NOT NULL REFERENCES users(id),
        specialist_id INTEGER NOT NULL REFERENCES users(id),
        specialist_type TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(child_id, specialist_id)
      )`);
      await run(db, "INSERT INTO parent_child_links VALUES (?, ?) ON CONFLICT(child_id) DO NOTHING", [child, parent]);
      await run(db, `INSERT INTO specialist_links (parent_id, child_id, specialist_id, specialist_type)
        SELECT ?, ?, ?, 'psychologist' FROM parent_child_links WHERE child_id = ? AND parent_id = ?
        ON CONFLICT(child_id, specialist_id) DO NOTHING`, [parent, child, specialist, child, parent]);
    }

    await run(db, "COMMIT");
  } catch (err) {
    await run(db, "ROLLBACK");
    throw err;
  }
}

if (require.main === module) {
  const demo = process.argv.includes("--demo");
  const target = process.env.DATABASE_PATH;
  if (demo && !target) throw new Error("Set DATABASE_PATH to an isolated demo database");
  const db = new sqlite3.Database(target || path.join(__dirname, "database.sqlite"));
  seed(db, { demo }).then(() => console.log("Database seeded.")).catch(err => {
    console.error(err.message);
    process.exitCode = 1;
  }).finally(() => db.close());
}

module.exports = { seed };
