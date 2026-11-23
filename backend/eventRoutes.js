const express = require("express");
const { positiveId, eventInput, canAccessChild } = require("./eventService");
const { createEvent, listEvents } = require("./eventRepository");

const { weekBounds } = require("./weekUtils");

function eventRoutes(db, ready) {
  const router = express.Router();
  const events = "/children/:childId/events";

  router.use("/children/:childId/events", async (req, res, next) => {
    if (!positiveId(req.params.childId)) return res.status(400).json({ error: "Valid childId is required" });
    const childId = Number(req.params.childId);
    if (!(await canAccessChild(db, req.user, childId))) {
      return res.status(403).json({ error: "Forbidden" });
    }
    await ready;
    res.locals.childId = childId;
    next();
  });

  router.get(events, async (req, res) => {
    const { weekStart } = req.query;
    const bounds = weekBounds(weekStart);
    if (!bounds) return res.status(400).json({ error: "weekStart must be a Monday in YYYY-MM-DD format" });
    const { childId } = res.locals;
    res.json({ childId, weekStart, events: await listEvents(db, childId, ...bounds) });
  });

  router.post(events, async (req, res) => {
    if (req.user.role === "child") return res.status(403).json({ error: "Forbidden" });
    const event = eventInput(req.body);
    if (!event) return res.status(400).json({ error: "Provide a title and valid timestamps with the end after the start" });
    res.status(201).json(await createEvent(db, res.locals.childId, req.user.id, event));
  });

  router.use((err, req, res, next) => {
    console.error("Schedule database error:", err.message);
    res.status(500).json({ error: "Database error" });
  });
  return router;
}

module.exports = { eventRoutes };
