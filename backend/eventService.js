const { all } = require("./eventsDb");

function positiveId(value) {
  return /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) > 0;
}

function instant(value) {
  if (typeof value !== "string") return null;
  const match = /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(value);
  if (!match) return null;
  const day = new Date(match[1] + "T00:00:00Z");
  const time = new Date(value);
  if (!Number.isFinite(+day) || day.toISOString().slice(0, 10) !== match[1] ||
      !Number.isFinite(+time) || time.toISOString().length !== 24) return null;
  return time.toISOString();
}

function eventInput(body = {}) {
  const { title, description = null, startTime, endTime } = body || {};
  const start = instant(startTime);
  const end = instant(endTime);
  if (typeof title !== "string" || !title.trim() ||
      (description !== null && typeof description !== "string") || !start || !end || end <= start) return null;
  return { title: title.trim(), description: description?.trim() || null, startTime: start, endTime: end };
}

const childAccessSql = `
  JOIN users actor ON actor.id = ? AND actor.role = ?
  WHERE child.role = 'child' AND (
    (actor.role = 'child' AND child.id = actor.id)
    OR (actor.role = 'parent' AND EXISTS (
      SELECT 1 FROM parent_child_links WHERE child_id = child.id AND parent_id = actor.id
    ))
    OR (actor.role = 'specialist' AND EXISTS (
      SELECT 1 FROM specialist_links WHERE child_id = child.id AND specialist_id = actor.id
    ))
  )
`;

async function canAccessChild(db, user, childId) {
  if (!positiveId(user?.id) || !["parent", "specialist", "child"].includes(user.role)) return false;
  const rows = await all(db, `SELECT child.id FROM users child
    ${childAccessSql} AND child.id = ?`, [user.id, user.role, childId]);
  return rows.length > 0;
}

function accessibleChildren(db, user) {
  return all(db, `SELECT child.id, child.name FROM users child
    ${childAccessSql} ORDER BY child.name, child.id`, [user.id, user.role]);
}

module.exports = { positiveId, eventInput, canAccessChild, accessibleChildren, childAccessSql };
