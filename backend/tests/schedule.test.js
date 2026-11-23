const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const request = require("supertest");
const sqlite3 = require("sqlite3");
const { seed } = require("../seed");
const { all, run } = require("../eventsDb");

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "team11-schedule-"));
process.env.DATABASE_PATH = path.join(directory, "test.sqlite");
process.env.JWT_SECRET = "schedule-integration-secret";
const { app, db } = require("../app");
const week = "2026-11-23";
const endpoint = "/api/children/4/events";
const event = {
  title: " Piano lesson ",
  description: "Bring sheet music",
  startTime: "2026-11-23T08:00:00+03:00",
  endTime: "2026-11-23T08:30:00+03:00",
  createdBy: 99,
  childId: 99,
};
const accounts = {};

beforeAll(async () => {
  const fixtures = new sqlite3.Database(process.env.DATABASE_PATH);
  try {
    await seed(fixtures, { demo: true, weekStart: week });
    await seed(fixtures, { demo: true, weekStart: week });
    await run(fixtures, `INSERT INTO users (name, email, password_hash, role)
      SELECT 'Other Child', 'other@example.com', password_hash, 'child'
      FROM users WHERE email = 'child@example.com'`);
  } finally {
    await new Promise((resolve, reject) => fixtures.close(err => err ? reject(err) : resolve()));
  }
  for (const email of ["parent", "specialist1", "specialist2", "child", "other"]) {
    const login = await request(app).post("/api/auth/login")
      .send({ email: email + "@example.com", password: "password123" });
    expect(login.status).toBe(200);
    accounts[email] = login.body;
  }
});

afterAll(async () => {
  await new Promise((resolve, reject) => db.close(err => err ? reject(err) : resolve()));
  fs.rmSync(directory, { recursive: true, force: true });
});

function as(account, method, url = endpoint) {
  return request(app)[method](url).set("Authorization", "Bearer " + accounts[account].token);
}

test("seed is repeatable and exposes only the authorized children", async () => {
  const [row] = await all(db, "SELECT count(*) AS count FROM events");
  expect(row.count).toBe(2);
  expect(await all(db, "PRAGMA foreign_key_check")).toEqual([]);
  for (const account of ["parent", "specialist1", "child"]) {
    const result = await as(account, "get", "/api/schedule/children");
    expect(result.body.children).toEqual([{ id: 4, name: "Child One" }]);
  }
  const unlinked = await as("specialist2", "get", "/api/schedule/children");
  expect(unlinked.body.children).toEqual([]);
});

test("requires authentication and rejects access outside the actor's children", async () => {
  expect((await request(app).get(endpoint).query({ weekStart: week })).status).toBe(401);
  for (const account of ["specialist2", "other"]) {
    expect((await as(account, "get").query({ weekStart: week })).status).toBe(403);
    expect((await as(account, "post").send(event)).status).toBe(403);
  }
  const other = "/api/children/" + accounts.other.user.id + "/events";
  expect((await as("parent", "get", other).query({ weekStart: week })).status).toBe(403);
  expect((await as("child", "post").send(event)).status).toBe(403);
  expect((await as("child", "patch", endpoint + "/1").send(event)).status).toBe(403);
  expect((await as("child", "delete", endpoint + "/1")).status).toBe(403);
});

test("validates impossible dates, empty fields and time ordering", async () => {
  for (const fields of [
    { title: " " },
    { startTime: "2026-02-30T08:00:00+03:00" },
    { startTime: event.endTime },
    { endTime: "2026-11-22T08:30:00+03:00" },
  ]) {
    expect((await as("parent", "post").send({ ...event, ...fields })).status).toBe(400);
  }
  expect((await as("parent", "get").query({ weekStart: "2026-11-24" })).status).toBe(400);
});

test("creates, lists, edits and deletes persisted records with creator-only access", async () => {
  const linked = await as("specialist1", "post").send(event);
  expect(linked.status).toBe(201);
  expect(linked.body).toMatchObject({
    childId: 4, createdBy: accounts.specialist1.user.id, title: "Piano lesson",
    startTime: "2026-11-23T05:00:00.000Z",
  });
  const id = linked.body.id;
  const item = endpoint + "/" + id;
  expect((await as("parent", "patch", item).send({ title: "Other title" })).status).toBe(404);
  expect((await as("parent", "delete", item)).status).toBe(404);
  expect((await as("specialist1", "patch", item).send({ endTime: event.startTime })).status).toBe(400);
  const updated = await as("specialist1", "patch", item).send({ title: "Updated title" });
  expect(updated.status).toBe(200);
  expect(updated.body.description).toBe(event.description);
  const read = await as("child", "get").query({ weekStart: week });
  expect(read.body.events).toEqual(expect.arrayContaining([
    expect.objectContaining({ id, title: "Updated title" }),
  ]));
  const reader = new sqlite3.Database(process.env.DATABASE_PATH);
  try {
    expect(await all(reader, "SELECT title FROM events WHERE id = ?", [id])).toEqual([{ title: "Updated title" }]);
  } finally {
    await new Promise((resolve, reject) => reader.close(err => err ? reject(err) : resolve()));
  }
  expect((await as("specialist1", "delete", item)).status).toBe(204);
  expect((await as("specialist1", "delete", item)).status).toBe(404);
});

test("includes Istanbul Monday midnight and excludes the next Monday", async () => {
  const times = [
    ["2026-11-22T20:59:00Z", "2026-11-22T21:30:00Z"],
    ["2026-11-22T21:00:00Z", "2026-11-22T21:30:00Z"],
    ["2026-11-29T20:59:00Z", "2026-11-29T21:30:00Z"],
    ["2026-11-29T21:00:00Z", "2026-11-29T21:30:00Z"],
  ];
  const ids = [];
  for (const [startTime, endTime] of times) {
    const created = await as("parent", "post").send({ ...event, startTime, endTime });
    expect(created.status).toBe(201);
    ids.push(created.body.id);
  }
  const result = await as("child", "get").query({ weekStart: week });
  expect(result.status).toBe(200);
  expect(result.body.events.map(row => row.id).filter(id => ids.includes(id))).toEqual(ids.slice(1, 3));
});

test("revoked specialists lose access even to their own events", async () => {
  const created = await as("specialist1", "post").send(event);
  expect(created.status).toBe(201);
  const [link] = await all(db, "SELECT id FROM specialist_links WHERE specialist_id = ?", [accounts.specialist1.user.id]);
  const revoked = await as("parent", "delete", "/api/specialist-links/" + link.id);
  expect(revoked.status).toBe(200);
  const item = endpoint + "/" + created.body.id;
  expect((await as("specialist1", "get").query({ weekStart: week })).status).toBe(403);
  expect((await as("specialist1", "patch", item).send({ title: "Revoked" })).status).toBe(403);
  expect((await as("specialist1", "delete", item)).status).toBe(403);
});

test("upgrades the original events table while keeping its records", async () => {
  const legacy = new sqlite3.Database(":memory:");
  try {
    await run(legacy, `CREATE TABLE events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      child_id INTEGER NOT NULL REFERENCES users(id),
      created_by INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL
    )`);
    await run(legacy, `INSERT INTO events VALUES
      (99, 4, 1, 'Existing event', '2026-11-23T00:00:00+03:00', '2026-11-23T01:00:00+03:00')`);
    await seed(legacy, { weekStart: week });
    const [row] = await all(legacy, "SELECT title, description FROM events WHERE id = 99");
    expect(row).toEqual({ title: "Existing event", description: null });
    expect(await all(legacy, "PRAGMA foreign_key_check")).toEqual([]);
  } finally {
    await new Promise((resolve, reject) => legacy.close(err => err ? reject(err) : resolve()));
  }
});

test("uses Istanbul's historical winter offset when listing a week", async () => {
  const historical = await as("parent", "post").send({
    ...event,
    startTime: "2015-01-11T22:03:00Z",
    endTime: "2015-01-11T22:30:00Z",
  });
  expect(historical.status).toBe(201);
  const included = await as("child", "get").query({ weekStart: "2015-01-12" });
  expect(included.body.events).toEqual([expect.objectContaining({ id: historical.body.id })]);
  const previous = await as("child", "get").query({ weekStart: "2015-01-05" });
  expect(previous.body.events).toEqual([]);
});
