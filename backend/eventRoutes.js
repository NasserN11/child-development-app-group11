const express = require("express");
const { positiveId, eventInput, canAccessChild, accessibleChildren } = require("./eventService");
const { createEvent, listEvents, findOwnedEvent, updateEvent, deleteEvent } = require("./eventRepository");
const { weekBounds } = require("./weekUtils");

function forbidden(res) {
  return res.status(403).json({ error: "Forbidden" });
}

function invalidEvent(res) {
  return res.status(400).json({ error: "Provide a title and valid timestamps with the end after the start" });
}

function eventRoutes(db, ready, requireAuth) {
  const router = express.Router();
  const events = "/children/:childId/events";
  const item = events + "/:eventId";

  router.get("/schedule/children", requireAuth, async (req, res) => {
    if (!positiveId(req.user?.id) || !["parent", "specialist", "child"].includes(req.user.role)) {
      return forbidden(res);
    }
    res.json({ children: await accessibleChildren(db, req.user) });
  });

  router.use(events, requireAuth, async (req, res, next) => {
    if (!positiveId(req.params.childId)) return res.status(400).json({ error: "Valid childId is required" });
    const childId = Number(req.params.childId);
    if (!(await canAccessChild(db, req.user, childId))) return forbidden(res);
    await ready;
    res.locals.childId = childId;
    next();
  });

  router.get(events, async (req, res) => {
    const { weekStart } = req.query;
    const bounds = weekBounds(weekStart);
    if (!bounds) return res.status(400).json({ error: "weekStart must be a Monday in YYYY-MM-DD format" });
    const { childId } = res.locals;
    res.json({ childId, weekStart, events: await listEvents(db, childId, req.user, ...bounds) });
  });

  router.post(events, async (req, res) => {
    if (req.user.role === "child") return forbidden(res);
    const event = eventInput(req.body);
    if (!event) return invalidEvent(res);
    const created = await createEvent(db, res.locals.childId, req.user, event);
    if (!created) return forbidden(res);
    res.status(201).json(created);
  });

  router.patch(item, async (req, res) => {
    if (req.user.role === "child") return forbidden(res);
    if (!positiveId(req.params.eventId)) return res.status(400).json({ error: "Valid eventId is required" });
    const previous = await findOwnedEvent(db, res.locals.childId, req.user, Number(req.params.eventId));
    if (!previous) return res.status(404).json({ error: "Event not found" });
    const fields = ["title", "description", "startTime", "endTime"];
    if (!req.body || !fields.some(field => Object.hasOwn(req.body, field))) return invalidEvent(res);
    const event = eventInput({ ...previous, ...req.body });
    if (!event) return invalidEvent(res);
    const result = await updateEvent(db, req.user, previous, event);
    if (!result.changes) return res.status(409).json({ error: "Event or access changed. Refresh and try again." });
    res.json({ id: previous.id, childId: previous.childId, createdBy: previous.createdBy, ...event });
  });

  router.delete(item, async (req, res) => {
    if (req.user.role === "child") return forbidden(res);
    if (!positiveId(req.params.eventId)) return res.status(400).json({ error: "Valid eventId is required" });
    const result = await deleteEvent(db, res.locals.childId, req.user, Number(req.params.eventId));
    if (!result.changes) return res.status(404).json({ error: "Event not found" });
    res.sendStatus(204);
  });

  router.use((err, req, res, next) => {
    console.error("Schedule database error:", err.message);
    res.status(500).json({ error: "Database error" });
  });
  return router;
}

module.exports = { eventRoutes };
