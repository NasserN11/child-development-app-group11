process.env.JWT_SECRET = "test-secret";

const request = require("supertest");
const jwt = require("jsonwebtoken");
const { app, db } = require("../app");

afterAll((done) => {
  db.close(done);
});

describe("M2 - Link Specialist API", () => {
  test("Rejects requests without a token (401)", async () => {
    const res = await request(app)
      .post("/api/specialist-links")
      .send({});

    expect(res.status).toBe(401);
  });

  test("Rejects specialist users (403)", async () => {
    const token = jwt.sign(
      { id: 2, role: "specialist" },
      process.env.JWT_SECRET
    );

    const res = await request(app)
      .post("/api/specialist-links")
      .set("Authorization", `Bearer ${token}`)
      .send({
        childId: 4,
        specialistEmail: "specialist1@example.com",
        specialistType: "psychologist"
      });

    expect(res.status).toBe(403);
  });

  test("Rejects missing information (400)", async () => {
    const token = jwt.sign(
      { id: 1, role: "parent" },
      process.env.JWT_SECRET
    );

    const res = await request(app)
      .post("/api/specialist-links")
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  test("Rejects linking when parent does not own the child (403)", async () => {
    const token = jwt.sign(
      { id: 1, role: "parent" },
      process.env.JWT_SECRET
    );

    const res = await request(app)
      .post("/api/specialist-links")
      .set("Authorization", `Bearer ${token}`)
      .send({
        childId: 4,
        specialistEmail: "specialist1@example.com",
        specialistType: "psychologist"
      });

   expect(res.status).toBe(403);
  });
    test("Creates a specialist link (201) and rejects duplicates (409)", async () => {
    const token = jwt.sign(
      { id: 1, role: "parent" },
      process.env.JWT_SECRET
    );

    const run = (sql, params = []) =>
      new Promise((resolve, reject) => {
        db.run(sql, params, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

    await run("SAVEPOINT specialist_link_test");

    try {
      await run(
        "INSERT INTO parent_child_links (child_id, parent_id) VALUES (?, ?)",
        [4, 1]
      );

      const body = {
        childId: 4,
        specialistEmail: "specialist1@example.com",
        specialistType: "psychologist"
      };

      const first = await request(app)
        .post("/api/specialist-links")
        .set("Authorization", `Bearer ${token}`)
        .send(body);

      expect(first.status).toBe(201);

      const second = await request(app)
        .post("/api/specialist-links")
        .set("Authorization", `Bearer ${token}`)
        .send(body);

      expect(second.status).toBe(409);
    } finally {
      await run("ROLLBACK TO SAVEPOINT specialist_link_test");
      await run("RELEASE SAVEPOINT specialist_link_test");
    }
  });
});
describe("M2 - List and Unlink Specialists API", () => {
  const parentToken = jwt.sign(
    { id: 1, role: "parent" },
    process.env.JWT_SECRET
  );

  const run = (sql, params = []) =>
    new Promise((resolve, reject) => {
      db.run(sql, params, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

  test("Rejects requests without authentication (401)", async () => {
    const list = await request(app)
      .get("/api/children/4/specialists");

    const unlink = await request(app)
      .delete("/api/specialist-links/1");

    expect(list.status).toBe(401);
    expect(unlink.status).toBe(401);
  });

  test("Rejects specialist users (403)", async () => {
    const specialistToken = jwt.sign(
      { id: 2, role: "specialist" },
      process.env.JWT_SECRET
    );

    const list = await request(app)
      .get("/api/children/4/specialists")
      .set("Authorization", `Bearer ${specialistToken}`);

    const unlink = await request(app)
      .delete("/api/specialist-links/1")
      .set("Authorization", `Bearer ${specialistToken}`);

    expect(list.status).toBe(403);
    expect(unlink.status).toBe(403);
  });

  test("Lists and unlinks a specialist for the child's parent", async () => {
    await run("SAVEPOINT specialist_unlink_list_test");

    try {
      await run(
        "INSERT INTO parent_child_links (child_id, parent_id) VALUES (?, ?)",
        [4, 1]
      );

      // Create a link for testing
      const created = await request(app)
        .post("/api/specialist-links")
        .set("Authorization", `Bearer ${parentToken}`)
        .send({
          childId: 4,
          specialistEmail: "specialist1@example.com",
          specialistType: "psychologist"
        });

      expect(created.status).toBe(201);

      const linkId = created.body.linkId;

      // List linked specialists
      const list = await request(app)
        .get("/api/children/4/specialists")
        .set("Authorization", `Bearer ${parentToken}`);

      expect(list.status).toBe(200);
      expect(list.body.specialists).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            linkId,
            specialistEmail: "specialist1@example.com"
          })
        ])
      );

      // Another parent cannot access this child
      const otherParentToken = jwt.sign(
        { id: 99, role: "parent" },
        process.env.JWT_SECRET
      );

      const forbiddenList = await request(app)
        .get("/api/children/4/specialists")
        .set("Authorization", `Bearer ${otherParentToken}`);

      const forbiddenUnlink = await request(app)
        .delete(`/api/specialist-links/${linkId}`)
        .set("Authorization", `Bearer ${otherParentToken}`);

      expect(forbiddenList.status).toBe(403);
      expect(forbiddenUnlink.status).toBe(404);

      // Unlink the specialist
      const unlink = await request(app)
        .delete(`/api/specialist-links/${linkId}`)
        .set("Authorization", `Bearer ${parentToken}`);

      expect(unlink.status).toBe(200);

      // Confirm the specialist is no longer linked
      const afterUnlink = await request(app)
        .get("/api/children/4/specialists")
        .set("Authorization", `Bearer ${parentToken}`);

      expect(afterUnlink.status).toBe(200);
      expect(
        afterUnlink.body.specialists.some(
          (specialist) => specialist.linkId === linkId
        )
      ).toBe(false);

      // Cannot unlink the same link twice
      const duplicateUnlink = await request(app)
        .delete(`/api/specialist-links/${linkId}`)
        .set("Authorization", `Bearer ${parentToken}`);

      expect(duplicateUnlink.status).toBe(404);
    } finally {
      // Remove all temporary test data
      await run("ROLLBACK TO SAVEPOINT specialist_unlink_list_test");
      await run("RELEASE SAVEPOINT specialist_unlink_list_test");
    }
  });
});
describe("M2 - Additional Authorization and API Tests", () => {
  const parentToken = jwt.sign(
    { id: 1, role: "parent" },
    process.env.JWT_SECRET
  );

  const body = {
    childId: 4,
    specialistEmail: "specialist1@example.com",
    specialistType: "psychologist"
  };

  const run = (sql, params = []) =>
    new Promise((resolve, reject) => {
      db.run(sql, params, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

  test("Rejects JWT signed with an invalid secret (401)", async () => {
    const invalidToken = jwt.sign(
      { id: 1, role: "parent" },
      "incorrect-secret"
    );

    const results = await Promise.all([
      request(app)
        .post("/api/specialist-links")
        .set("Authorization", `Bearer ${invalidToken}`)
        .send(body),

      request(app)
        .get("/api/children/4/specialists")
        .set("Authorization", `Bearer ${invalidToken}`),

      request(app)
        .delete("/api/specialist-links/1")
        .set("Authorization", `Bearer ${invalidToken}`)
    ]);

    results.forEach((result) => {
      expect(result.status).toBe(401);
    });
  });

  test("Rejects expired JWT (401)", async () => {
    const expiredToken = jwt.sign(
      { id: 1, role: "parent" },
      process.env.JWT_SECRET,
      { expiresIn: -1 }
    );

    const result = await request(app)
      .post("/api/specialist-links")
      .set("Authorization", `Bearer ${expiredToken}`)
      .send(body);

    expect(result.status).toBe(401);
  });

  test("Rejects invalid child and link IDs (400)", async () => {
    const create = await request(app)
      .post("/api/specialist-links")
      .set("Authorization", `Bearer ${parentToken}`)
      .send({ ...body, childId: -1 });

    const list = await request(app)
      .get("/api/children/invalid/specialists")
      .set("Authorization", `Bearer ${parentToken}`);

    const unlink = await request(app)
      .delete("/api/specialist-links/invalid")
      .set("Authorization", `Bearer ${parentToken}`);

    expect(create.status).toBe(400);
    expect(list.status).toBe(400);
    expect(unlink.status).toBe(400);
  });

  test("Rejects unauthorized parent and unregistered specialist", async () => {
    await run("SAVEPOINT specialist_auth_test");

    try {
      await run(
        "INSERT INTO parent_child_links (child_id, parent_id) VALUES (?, ?)",
        [4, 1]
      );

      const otherParentToken = jwt.sign(
        { id: 99, role: "parent" },
        process.env.JWT_SECRET
      );

      const forbidden = await request(app)
        .post("/api/specialist-links")
        .set("Authorization", `Bearer ${otherParentToken}`)
        .send(body);

      expect(forbidden.status).toBe(403);

      const unregistered = await request(app)
        .post("/api/specialist-links")
        .set("Authorization", `Bearer ${parentToken}`)
        .send({
          ...body,
          specialistEmail: "unknown-specialist@example.com"
        });

      expect(unregistered.status).toBe(404);
    } finally {
      await run("ROLLBACK TO SAVEPOINT specialist_auth_test");
      await run("RELEASE SAVEPOINT specialist_auth_test");
    }
  });
});