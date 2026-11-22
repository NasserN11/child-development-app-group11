const { all, run } = require("./eventsDb");

async function createEvent(db, childId, createdBy, event) {
  const result = await run(db, `
    INSERT INTO events (child_id, created_by, title, description, start_time, end_time)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [childId, createdBy, event.title, event.description, event.startTime, event.endTime]);
  return { id: result.lastID, childId, createdBy, ...event };
}

function listEvents(db, childId, start, end) {
  return all(db, `SELECT id, child_id AS childId, created_by AS createdBy, title,
      description, start_time AS startTime, end_time AS endTime
    FROM events
    WHERE child_id = ? AND julianday(start_time) >= julianday(?) AND julianday(start_time) < julianday(?)
    ORDER BY julianday(start_time), id`, [childId, start, end]);
}

module.exports = { createEvent, listEvents };
