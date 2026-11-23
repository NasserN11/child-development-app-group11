const { all, run } = require("./eventsDb");
const { childAccessSql } = require("./eventService");

const fields = `id, child_id AS childId, created_by AS createdBy, title,
  description, start_time AS startTime, end_time AS endTime`;
const access = `EXISTS (SELECT 1 FROM users child ${childAccessSql} AND child.id = ?)`;

async function createEvent(db, childId, user, event) {
  const result = await run(db, `
    INSERT INTO events (child_id, created_by, title, description, start_time, end_time)
    SELECT ?, ?, ?, ?, ?, ? WHERE ${access}
  `, [childId, user.id, event.title, event.description, event.startTime, event.endTime,
    user.id, user.role, childId]);
  return result.changes ? { id: result.lastID, childId, createdBy: user.id, ...event } : null;
}

function listEvents(db, childId, user, start, end) {
  return all(db, `SELECT ${fields} FROM events
    WHERE child_id = ? AND julianday(start_time) >= julianday(?) AND julianday(start_time) < julianday(?) AND ${access}
    ORDER BY julianday(start_time), id`, [childId, start, end, user.id, user.role, childId]);
}

async function findOwnedEvent(db, childId, user, id) {
  const [event] = await all(db, `SELECT ${fields} FROM events
    WHERE child_id = ? AND id = ? AND created_by = ? AND ${access}`,
  [childId, id, user.id, user.id, user.role, childId]);
  return event;
}

function updateEvent(db, user, previous, next) {
  const { childId, id } = previous;
  return run(db, `UPDATE events SET title = ?, description = ?, start_time = ?, end_time = ?
    WHERE child_id = ? AND id = ? AND created_by = ? AND ${access}
      AND title = ? AND description IS ? AND start_time = ? AND end_time = ?`,
  [next.title, next.description, next.startTime, next.endTime, childId, id, user.id,
    user.id, user.role, childId, previous.title, previous.description, previous.startTime, previous.endTime]);
}

function deleteEvent(db, childId, user, id) {
  return run(db, `DELETE FROM events WHERE child_id = ? AND id = ? AND created_by = ? AND ${access}`,
  [childId, id, user.id, user.id, user.role, childId]);
}

module.exports = { createEvent, listEvents, findOwnedEvent, updateEvent, deleteEvent };
