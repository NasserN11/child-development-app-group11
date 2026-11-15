
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "database.sqlite");

function createEventsTable() {
  const db = new sqlite3.Database(dbPath);

  db.run(
    `CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      child_id INTEGER NOT NULL,
      created_by INTEGER NOT NULL,
      title TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      FOREIGN KEY (child_id) REFERENCES users(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )`,
    (err) => {
      if (err) {
        console.error("Error creating events table:", err.message);
      } else {
        console.log("Events table is ready.");
      }
      db.close();
    }
  );
}

module.exports = { createEventsTable };
