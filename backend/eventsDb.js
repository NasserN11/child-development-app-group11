const createEventsSql = `
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    child_id INTEGER NOT NULL REFERENCES users(id),
    created_by INTEGER NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    description TEXT,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    CHECK (julianday(end_time) > julianday(start_time))
  )
`;

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
  });
}

async function createEventsTable(db) {
  await run(db, createEventsSql);
  const columns = await all(db, "PRAGMA table_info(events)");
  if (!columns.some(({ name }) => name === "description")) {
    await run(db, "ALTER TABLE events ADD COLUMN description TEXT");
  }
  await run(db, "CREATE INDEX IF NOT EXISTS events_child_start ON events(child_id, start_time)");
}

module.exports = { createEventsTable, run, all };
