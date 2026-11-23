// GET /api/children
// The children the logged-in user may work with. The frontend needs this to
// know which child to show (parent: own children, specialist: linked children,
// child: themselves).

const express = require("express");
const { all } = require("../dbAsync");

module.exports = function childrenRouter(db) {
  const router = express.Router();

  router.get("/", async (req, res) => {
    try {
      let rows = [];

      if (req.user.role === "parent") {
        rows = await all(
          db,
          `SELECT u.id, u.name
           FROM parent_child_links p
           JOIN users u ON u.id = p.child_id
           WHERE p.parent_id = ? AND u.role = 'child'
           ORDER BY u.name`,
          [req.user.id],
        );
      } else if (req.user.role === "specialist") {
        rows = await all(
          db,
          `SELECT u.id, u.name
           FROM specialist_links l
           JOIN users u ON u.id = l.child_id
           WHERE l.specialist_id = ?
           ORDER BY u.name`,
          [req.user.id],
        );
      } else if (req.user.role === "child") {
        rows = await all(db, "SELECT id, name FROM users WHERE id = ?", [req.user.id]);
      }

      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  });

  return router;
};
