const { run } = require("./eventsDb");

async function createEvent(db, childId, createdBy, event) {
  const result = await run(db, `
    INSERT INTO events (child_id, created_by, title, description, start_time, end_time)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [childId, createdBy, event.title, event.description, event.startTime, event.endTime]);
  return { id: result.lastID, childId, createdBy, ...event };
}

module.exports = { createEvent };
