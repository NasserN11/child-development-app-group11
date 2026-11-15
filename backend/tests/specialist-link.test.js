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