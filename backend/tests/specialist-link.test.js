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

  test("Blocks linking until ownership verification exists (501)", async () => {
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

    expect(res.status).toBe(501);
  });
});