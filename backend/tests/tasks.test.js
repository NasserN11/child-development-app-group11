process.env.JWT_SECRET = "test-secret";

const request = require("supertest");
const jwt = require("jsonwebtoken");
const { app, db } = require("../app");
const { run, get, all } = require("../dbAsync");

let parent, specialist1, specialist2, child, otherParent, otherChild;

function tokenFor(user) {
  return jwt.sign({ id: user.id, role: user.role }, "test-secret", { expiresIn: "1h" });
}

function call(method, url, user, body) {
  const req = request(app)[method](url);
  if (user) req.set("Authorization", `Bearer ${tokenFor(user)}`);
  return body ? req.send(body) : req;
}

async function userByEmail(email) {
  return get(db, "SELECT id, role FROM users WHERE email = ?", [email]);
}

// Creates a user for the tests if it does not exist yet.
async function ensureUser(name, email, role) {
  let user = await userByEmail(email);
  if (!user) {
    await run(
      db,
      "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, 'not-used', ?)",
      [name, email, role],
    );
    user = await userByEmail(email);
  }
  return user;
}

// specialist_links and parent_child_links are created by app.js at start-up; wait until they exist.
async function waitForTables() {
  for (let i = 0; i < 40; i++) {
    const rows = await all(
      db,
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('specialist_links', 'parent_child_links')",
    );
    if (rows.length === 2) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("link tables were not created");
}

// Removes everything these tests created, so other test files start from a clean database.
async function cleanUp() {
  await run(db, "DELETE FROM tasks WHERE title LIKE 'TEST %'");
  if (child && otherChild) {
    await run(db, "DELETE FROM specialist_links WHERE child_id IN (?, ?)", [child.id, otherChild.id]);
    await run(db, "DELETE FROM parent_child_links WHERE child_id IN (?, ?)", [child.id, otherChild.id]);
  }
  await run(db, "DELETE FROM users WHERE email LIKE '%@test.example'");
}

function link(specialist, childUser, parentUser) {
  return run(
    db,
    `INSERT OR IGNORE INTO specialist_links (parent_id, child_id, specialist_id, specialist_type)
     VALUES (?, ?, ?, 'psychologist')`,
    [parentUser.id, childUser.id, specialist.id],
  );
}

function unlink(specialist, childUser) {
  return run(db, "DELETE FROM specialist_links WHERE child_id = ? AND specialist_id = ?", [
    childUser.id,
    specialist.id,
  ]);
}

const validTask = {
  title: "TEST Read for 20 minutes",
  description: "Read one chapter.",
  development_area: "Language",
  due_date: "2030-03-04",
};

async function createTaskAs(user, childUser, overrides = {}) {
  const res = await call("post", `/api/children/${childUser.id}/tasks`, user, { ...validTask, ...overrides });
  expect(res.status).toBe(201);
  return res.body;
}

beforeAll(async () => {
  await waitForTables();
  parent = await userByEmail("parent@example.com");
  specialist1 = await userByEmail("specialist1@example.com");
  specialist2 = await userByEmail("specialist2@example.com");
  child = await userByEmail("child@example.com");
  otherParent = await ensureUser("Other Parent", "other-parent@test.example", "parent");
  otherChild = await ensureUser("Other Child", "other-child@test.example", "child");

  // Start from a clean state, then: parent owns child, otherParent owns otherChild,
  // specialist1 is linked to the child, specialist2 is not.
  await run(db, "DELETE FROM specialist_links WHERE child_id IN (?, ?)", [child.id, otherChild.id]);
  await run(db, "DELETE FROM parent_child_links WHERE child_id IN (?, ?)", [child.id, otherChild.id]);
  await run(db, "INSERT INTO parent_child_links (child_id, parent_id) VALUES (?, ?)", [child.id, parent.id]);
  await run(db, "INSERT INTO parent_child_links (child_id, parent_id) VALUES (?, ?)", [otherChild.id, otherParent.id]);
  await link(specialist1, child, parent);
});

afterAll(async () => {
  await cleanUp();
  await new Promise((resolve) => db.close(resolve));
});

describe("Access control for task routes", () => {
  test("rejects a request without a token (401)", async () => {
    const res = await call("get", `/api/children/${child.id}/tasks`, null);
    expect(res.status).toBe(401);
  });

  test("an unlinked specialist cannot assign a task and nothing is saved (403)", async () => {
    const before = await get(db, "SELECT COUNT(*) AS n FROM tasks");
    const res = await call("post", `/api/children/${child.id}/tasks`, specialist2, validTask);
    const after = await get(db, "SELECT COUNT(*) AS n FROM tasks");

    expect(res.status).toBe(403);
    expect(after.n).toBe(before.n);
  });

  test("an unlinked specialist cannot list tasks (403)", async () => {
    const res = await call("get", `/api/children/${child.id}/tasks`, specialist2);
    expect(res.status).toBe(403);
  });

  test("a parent who does not own the child is rejected (403)", async () => {
    const create = await call("post", `/api/children/${child.id}/tasks`, otherParent, validTask);
    const list = await call("get", `/api/children/${child.id}/tasks`, otherParent);
    expect(create.status).toBe(403);
    expect(list.status).toBe(403);
  });

  test("a specialist loses access right after being unlinked, even with a valid token", async () => {
    await link(specialist2, child, parent);
    const allowed = await call("post", `/api/children/${child.id}/tasks`, specialist2, validTask);
    expect(allowed.status).toBe(201);

    await unlink(specialist2, child);
    const create = await call("post", `/api/children/${child.id}/tasks`, specialist2, validTask);
    const list = await call("get", `/api/children/${child.id}/tasks`, specialist2);
    expect(create.status).toBe(403);
    expect(list.status).toBe(403);
  });

  test("rejects an invalid child id (400)", async () => {
    const res = await call("get", "/api/children/abc/tasks", parent);
    expect(res.status).toBe(400);
  });
});

describe("POST /api/children/:childId/tasks", () => {
  test("a linked specialist creates a pending task", async () => {
    const task = await createTaskAs(specialist1, child);
    expect(task.status).toBe("pending");
    expect(task.assigned_by).toBe(specialist1.id);
    expect(task.child_id).toBe(child.id);
    expect(task.development_area).toBe("Language");
    expect(task.completed_at).toBeNull();
  });

  test("the owning parent creates a task", async () => {
    const task = await createTaskAs(parent, child, { development_area: "Motor" });
    expect(task.assigned_by).toBe(parent.id);
  });

  test("a child cannot assign tasks (403)", async () => {
    const res = await call("post", `/api/children/${child.id}/tasks`, child, validTask);
    expect(res.status).toBe(403);
  });

  test("rejects a development area outside the four allowed values (400)", async () => {
    const res = await call("post", `/api/children/${child.id}/tasks`, parent, {
      ...validTask,
      development_area: "Sports",
    });
    expect(res.status).toBe(400);
  });

  test("rejects a missing title (400)", async () => {
    const res = await call("post", `/api/children/${child.id}/tasks`, parent, { ...validTask, title: "  " });
    expect(res.status).toBe(400);
  });

  test("rejects an impossible due date (400)", async () => {
    const res = await call("post", `/api/children/${child.id}/tasks`, parent, {
      ...validTask,
      due_date: "2030-02-30",
    });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/children/:childId/tasks", () => {
  test("the child sees their own tasks and nobody else's", async () => {
    await createTaskAs(parent, child, { title: "TEST own task" });
    await createTaskAs(otherParent, otherChild, { title: "TEST other child's task" });

    const res = await call("get", `/api/children/${child.id}/tasks`, child);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.every((t) => t.child_id === child.id)).toBe(true);
    expect(res.body.some((t) => t.title === "TEST other child's task")).toBe(false);
  });

  test("a child cannot read another child's tasks (403)", async () => {
    const res = await call("get", `/api/children/${otherChild.id}/tasks`, child);
    expect(res.status).toBe(403);
  });

  test("filters by the week of the due date", async () => {
    // 2031-01-06 is a Monday; the week is 2031-01-06 to 2031-01-12.
    await createTaskAs(parent, child, { title: "TEST in week", due_date: "2031-01-12" });
    await createTaskAs(parent, child, { title: "TEST next week", due_date: "2031-01-13" });
    await createTaskAs(parent, child, { title: "TEST week before", due_date: "2031-01-05" });

    const res = await call("get", `/api/children/${child.id}/tasks?weekStart=2031-01-06`, parent);
    expect(res.status).toBe(200);
    expect(res.body.map((t) => t.title)).toEqual(["TEST in week"]);
  });

  test("rejects an invalid weekStart (400)", async () => {
    const res = await call("get", `/api/children/${child.id}/tasks?weekStart=tomorrow`, parent);
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/children/:childId/tasks/:taskId", () => {
  test("the child marks their own task done and the assigner sees it", async () => {
    const task = await createTaskAs(specialist1, child, { title: "TEST to complete" });

    const patch = await call("patch", `/api/children/${child.id}/tasks/${task.id}`, child, { status: "done" });
    expect(patch.status).toBe(200);
    expect(patch.body.status).toBe("done");
    expect(patch.body.completed_at).not.toBeNull();

    const list = await call("get", `/api/children/${child.id}/tasks`, specialist1);
    const seen = list.body.find((t) => t.id === task.id);
    expect(seen.status).toBe("done");
  });

  test("a child cannot complete another child's task (403 or 404) and it stays pending", async () => {
    const task = await createTaskAs(parent, child, { title: "TEST protected task" });

    const viaOtherPath = await call("patch", `/api/children/${child.id}/tasks/${task.id}`, otherChild, { status: "done" });
    const viaOwnPath = await call("patch", `/api/children/${otherChild.id}/tasks/${task.id}`, otherChild, { status: "done" });

    expect(viaOtherPath.status).toBe(403);
    expect(viaOwnPath.status).toBe(404);

    const row = await get(db, "SELECT status FROM tasks WHERE id = ?", [task.id]);
    expect(row.status).toBe("pending");
  });

  test("a specialist cannot mark a task done (403)", async () => {
    const task = await createTaskAs(specialist1, child, { title: "TEST not by specialist" });
    const res = await call("patch", `/api/children/${child.id}/tasks/${task.id}`, specialist1, { status: "done" });
    expect(res.status).toBe(403);
  });

  test("the child cannot set a task back to pending (400)", async () => {
    const task = await createTaskAs(parent, child, { title: "TEST no pending" });
    const res = await call("patch", `/api/children/${child.id}/tasks/${task.id}`, child, { status: "pending" });
    expect(res.status).toBe(400);
  });

  test("the assigner can change the due date", async () => {
    const task = await createTaskAs(specialist1, child, { title: "TEST move due date" });
    const res = await call("patch", `/api/children/${child.id}/tasks/${task.id}`, specialist1, { due_date: "2030-04-01" });
    expect(res.status).toBe(200);
    expect(res.body.due_date).toBe("2030-04-01");
  });

  test("only the assigner can change the due date (403 for parent, child)", async () => {
    const task = await createTaskAs(specialist1, child, { title: "TEST due date owner" });
    const byParent = await call("patch", `/api/children/${child.id}/tasks/${task.id}`, parent, { due_date: "2030-04-02" });
    const byChild = await call("patch", `/api/children/${child.id}/tasks/${task.id}`, child, { due_date: "2030-04-02" });
    expect(byParent.status).toBe(403);
    expect(byChild.status).toBe(403);
  });

  test("rejects an invalid due date (400)", async () => {
    const task = await createTaskAs(parent, child, { title: "TEST bad due date" });
    const res = await call("patch", `/api/children/${child.id}/tasks/${task.id}`, parent, { due_date: "soon" });
    expect(res.status).toBe(400);
  });

  test("rejects other fields such as title (400)", async () => {
    const task = await createTaskAs(parent, child, { title: "TEST fixed title" });
    const res = await call("patch", `/api/children/${child.id}/tasks/${task.id}`, parent, { title: "Changed" });
    expect(res.status).toBe(400);
  });

  test("returns 404 for a task that does not exist", async () => {
    const res = await call("patch", `/api/children/${child.id}/tasks/999999`, child, { status: "done" });
    expect(res.status).toBe(404);
  });
});

describe("GET /api/children", () => {
  test("a parent sees only their own children", async () => {
    const res = await call("get", "/api/children", parent);
    expect(res.status).toBe(200);
    expect(res.body.map((c) => c.id)).toEqual([child.id]);
  });

  test("a linked specialist sees the linked child, an unlinked one sees none", async () => {
    const linked = await call("get", "/api/children", specialist1);
    expect(linked.body.map((c) => c.id)).toContain(child.id);

    await unlink(specialist2, child);
    const unlinked = await call("get", "/api/children", specialist2);
    expect(unlinked.body).toEqual([]);
  });

  test("a child sees only themselves", async () => {
    const res = await call("get", "/api/children", child);
    expect(res.body.map((c) => c.id)).toEqual([child.id]);
  });

  test("rejects a request without a token (401)", async () => {
    const res = await call("get", "/api/children", null);
    expect(res.status).toBe(401);
  });
});
