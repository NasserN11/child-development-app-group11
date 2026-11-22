// M4 - Tasks
//   POST  /api/children/:childId/tasks           assign a task (parent, linked specialist)
//   GET   /api/children/:childId/tasks           list tasks, optional ?weekStart=YYYY-MM-DD
//   PATCH /api/children/:childId/tasks/:taskId   child marks done, OR assigner changes due date
//
// Mounted in app.js behind requireAuth and authorizeChildAccess, so by the time
// a request reaches these handlers req.childId and req.childRole are set.

const express = require("express");
const { run, get, all } = require("../dbAsync");

const DEVELOPMENT_AREAS = ["Cognitive", "Language", "Social-Emotional", "Motor"];

const TASK_SELECT = `
  SELECT t.id, t.child_id, t.assigned_by, u.name AS assigned_by_name,
         t.title, t.description, t.development_area, t.due_date,
         t.status, t.completed_at
  FROM tasks t
  JOIN users u ON u.id = t.assigned_by
`;

// Accepts only real calendar dates written as YYYY-MM-DD.
function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function addDays(value, days) {
  const d = new Date(`${value}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

module.exports = function tasksRouter(db) {
  const router = express.Router({ mergeParams: true });

  // ---- Create a task ------------------------------------------------------
  router.post("/", async (req, res) => {
    if (req.childRole === "child") {
      return res.status(403).json({ error: "Children cannot assign tasks" });
    }

    const { title, description = "", development_area, due_date } = req.body || {};
    const problems = [];

    if (typeof title !== "string" || title.trim() === "" || title.trim().length > 200) {
      problems.push("Title is required (maximum 200 characters)");
    }
    if (typeof description !== "string" || description.length > 1000) {
      problems.push("Description must be text of at most 1000 characters");
    }
    if (!DEVELOPMENT_AREAS.includes(development_area)) {
      problems.push(`Development area must be one of: ${DEVELOPMENT_AREAS.join(", ")}`);
    }
    if (!isValidDate(due_date)) {
      problems.push("Due date must be a valid date in the format YYYY-MM-DD");
    }
    if (problems.length > 0) {
      return res.status(400).json({ error: problems.join(". ") });
    }

    try {
      const result = await run(
        db,
        `INSERT INTO tasks
           (child_id, assigned_by, title, description, development_area, due_date, status)
         VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
        [req.childId, req.user.id, title.trim(), description.trim(), development_area, due_date],
      );
      const task = await get(db, `${TASK_SELECT} WHERE t.id = ?`, [result.lastID]);
      res.status(201).json(task);
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  });

  // ---- List tasks ---------------------------------------------------------
  router.get("/", async (req, res) => {
    const { weekStart } = req.query;
    let sql = `${TASK_SELECT} WHERE t.child_id = ?`;
    const params = [req.childId];

    if (weekStart !== undefined) {
      if (!isValidDate(weekStart)) {
        return res.status(400).json({ error: "weekStart must be a valid date in the format YYYY-MM-DD" });
      }
      // Tasks are counted in the week of their due date: [weekStart, weekStart + 7 days)
      sql += " AND t.due_date >= ? AND t.due_date < ?";
      params.push(weekStart, addDays(weekStart, 7));
    }

    sql += " ORDER BY t.due_date, t.id";

    try {
      res.json(await all(db, sql, params));
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  });

  // ---- Update a task ------------------------------------------------------
  // { "status": "done" }        -> only the child, only their own task
  // { "due_date": "YYYY-MM-DD" } -> only the person who assigned the task
  router.patch("/:taskId", async (req, res) => {
    const taskId = Number(req.params.taskId);
    if (!Number.isInteger(taskId) || taskId < 1) {
      return res.status(400).json({ error: "Invalid task id" });
    }

    const body = req.body || {};
    const keys = Object.keys(body);
    if (keys.length !== 1 || !["status", "due_date"].includes(keys[0])) {
      return res
        .status(400)
        .json({ error: "Send exactly one field: status or due_date" });
    }

    try {
      // The task must belong to the child in the URL, so another child's
      // task id can never be reached through this child's path.
      const task = await get(
        db,
        "SELECT * FROM tasks WHERE id = ? AND child_id = ?",
        [taskId, req.childId],
      );
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      if (keys[0] === "status") {
        if (req.childRole !== "child") {
          return res.status(403).json({ error: "Only the child can mark a task as done" });
        }
        if (body.status !== "done") {
          return res.status(400).json({ error: "Status can only be set to 'done'" });
        }
        if (task.status !== "done") {
          await run(
            db,
            "UPDATE tasks SET status = 'done', completed_at = ? WHERE id = ?",
            [new Date().toISOString(), taskId],
          );
        }
      } else {
        if (req.childRole === "child" || task.assigned_by !== req.user.id) {
          return res
            .status(403)
            .json({ error: "Only the person who assigned the task can change its due date" });
        }
        if (!isValidDate(body.due_date)) {
          return res.status(400).json({ error: "Due date must be a valid date in the format YYYY-MM-DD" });
        }
        await run(db, "UPDATE tasks SET due_date = ? WHERE id = ?", [body.due_date, taskId]);
      }

      res.json(await get(db, `${TASK_SELECT} WHERE t.id = ?`, [taskId]));
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  });

  return router;
};

module.exports.DEVELOPMENT_AREAS = DEVELOPMENT_AREAS;
