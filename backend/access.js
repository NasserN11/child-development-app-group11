// Access control for every request about one child.
//
// A valid JWT only proves WHO the user is. This middleware checks, in the
// database and on every request, whether that user may touch THIS child:
//   - child:      the user is that child
//   - parent:     the child is owned by this parent (parent_child_links, from M2)
//   - specialist: a row exists in specialist_links right now
// So an unlinked specialist is rejected immediately, even with a valid token.

const { get } = require("./dbAsync");

async function getChildRole(db, user, childId) {
  if (user.role === "child") {
    return user.id === childId ? "child" : null;
  }

  if (user.role === "parent") {
    const row = await get(
      db,
      "SELECT child_id FROM parent_child_links WHERE child_id = ? AND parent_id = ?",
      [childId, user.id],
    );
    return row ? "parent" : null;
  }

  if (user.role === "specialist") {
    const row = await get(
      db,
      "SELECT id FROM specialist_links WHERE child_id = ? AND specialist_id = ?",
      [childId, user.id],
    );
    return row ? "specialist" : null;
  }

  return null;
}

// Use after requireAuth, on routes that contain :childId.
// Sets req.childId (number) and req.childRole ('parent' | 'specialist' | 'child').
function authorizeChildAccess(db) {
  return async (req, res, next) => {
    const childId = Number(req.params.childId);
    if (!Number.isInteger(childId) || childId < 1) {
      return res.status(400).json({ error: "Invalid child id" });
    }

    try {
      const role = await getChildRole(db, req.user, childId);
      if (!role) {
        return res
          .status(403)
          .json({ error: "You do not have access to this child" });
      }
      req.childId = childId;
      req.childRole = role;
      next();
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  };
}

module.exports = { authorizeChildAccess, getChildRole };
