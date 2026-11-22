const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
const port = 5000;

app.use(express.json());

function requireAuth(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: "Missing token" });
  }

  const token = header.slice(7);

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

const dbPath = path.join(__dirname, "database.sqlite");
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error("Database connection error:", err.message);
});
// Enable SQLite foreign key constraints
db.run("PRAGMA foreign_keys = ON");

// M2 - Specialist linking database
db.run(`
  CREATE TABLE IF NOT EXISTS specialist_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_id INTEGER NOT NULL,
    child_id INTEGER NOT NULL,
    specialist_id INTEGER NOT NULL,
    specialist_type TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(child_id, specialist_id),
    FOREIGN KEY (parent_id) REFERENCES users(id),
    FOREIGN KEY (child_id) REFERENCES users(id),
    FOREIGN KEY (specialist_id) REFERENCES users(id)
  )
`);
// M2 - Parent-child ownership reference
db.run(`
  CREATE TABLE IF NOT EXISTS parent_child_links (
    child_id INTEGER PRIMARY KEY,
    parent_id INTEGER NOT NULL,
    FOREIGN KEY (child_id) REFERENCES users(id),
    FOREIGN KEY (parent_id) REFERENCES users(id)
  )
`);
// M2 - Parent authorization
function requireParent(req, res, next) {
  if (req.user.role !== "parent") {
    return res.status(403).json({
      error: "Only parents can link specialists"
    });
  }

  next();
}
// M2 - Link specialist API
app.post("/api/specialist-links", requireAuth, requireParent, (req, res) => {
 const { childId, specialistEmail, specialistType } = req.body || {};

  if (
    !Number.isInteger(childId) ||
    childId <= 0 ||
    typeof specialistEmail !== "string" ||
    !specialistEmail.trim() ||
    typeof specialistType !== "string" ||
    !specialistType.trim()
  ) {
    return res.status(400).json({
      error: "Valid childId, specialistEmail and specialistType are required"
    });
  }

    // M2 - Verify parent owns the selected child
  db.get(
    `SELECT 1
     FROM parent_child_links pcl
     JOIN users child ON child.id = pcl.child_id
     WHERE pcl.child_id = ?
       AND pcl.parent_id = ?
       AND child.role = 'child'`,
    [childId, req.user.id],
    (err, row) => {
      if (err) {
        return res.status(500).json({
          error: "Database error"
        });
      }

      if (!row) {
        return res.status(403).json({
          error: "You can only link specialists to your own child"
        });
      }

      // M2 - Check if the specialist is registered
      db.get(
        "SELECT id FROM users WHERE email = ? AND role = 'specialist'",
        [specialistEmail.trim()],
        (specialistErr, specialist) => {
          if (specialistErr) {
            return res.status(500).json({
              error: "Database error"
            });
          }

          if (!specialist) {
            return res.status(404).json({
              error: "Registered specialist not found"
            });
          }

                 // M2 - Create specialist link
          db.run(
            `INSERT INTO specialist_links
             (parent_id, child_id, specialist_id, specialist_type)
             VALUES (?, ?, ?, ?)`,
            [
              req.user.id,
              childId,
              specialist.id,
              specialistType.trim()
            ],
            function (linkErr) {
              if (linkErr) {
                if (
                  linkErr.code === "SQLITE_CONSTRAINT" &&
                  linkErr.message.includes("UNIQUE constraint failed")
                ) {
                  return res.status(409).json({
                    error: "Specialist already linked to this child"
                  });
                }

                return res.status(500).json({
                  error: "Database error"
                });
              }

              return res.status(201).json({
                message: "Specialist linked successfully",
                linkId: this.lastID
              });
            }
          );
        }
      );
    }
  );
});
// M2 - List specialists linked to a child
app.get("/api/children/:childId/specialists", requireAuth, requireParent, (req, res) => {
  const childId = Number(req.params.childId);

  if (!Number.isSafeInteger(childId) || childId <= 0) {
    return res.status(400).json({ error: "Valid childId is required" });
  }

  // Verify that the parent owns this child
  db.get(
    `SELECT 1
     FROM parent_child_links pcl
     JOIN users child ON child.id = pcl.child_id
     WHERE pcl.child_id = ?
       AND pcl.parent_id = ?
       AND child.role = 'child'`,
    [childId, req.user.id],
    (err, ownership) => {
      if (err) {
        return res.status(500).json({ error: "Database error" });
      }

      if (!ownership) {
        return res.status(403).json({
          error: "You can only view specialists linked to your own child"
        });
      }

      // Retrieve specialists linked to this child
      db.all(
        `SELECT
           sl.id AS linkId,
           u.id AS specialistId,
           u.name AS specialistName,
           u.email AS specialistEmail,
           sl.specialist_type AS specialistType,
           sl.created_at AS linkedAt
         FROM specialist_links sl
         JOIN users u ON u.id = sl.specialist_id
         WHERE sl.child_id = ?
           AND sl.parent_id = ?
         ORDER BY sl.created_at DESC, sl.id DESC`,
        [childId, req.user.id],
        (listErr, specialists) => {
          if (listErr) {
            return res.status(500).json({ error: "Database error" });
          }

          return res.status(200).json({
            childId,
            specialists
          });
        }
      );
    }
  );
});
// M2 - Unlink specialist from a child
app.delete("/api/specialist-links/:linkId", requireAuth, requireParent, (req, res) => {
  const linkId = Number(req.params.linkId);

  if (!Number.isSafeInteger(linkId) || linkId <= 0) {
    return res.status(400).json({
      error: "Valid linkId is required"
    });
  }

  // Delete only if the parent owns the linked child
  db.run(
    `DELETE FROM specialist_links
     WHERE id = ?
       AND parent_id = ?
       AND EXISTS (
         SELECT 1
         FROM parent_child_links pcl
         JOIN users child ON child.id = pcl.child_id
         WHERE pcl.child_id = specialist_links.child_id
           AND pcl.parent_id = ?
           AND child.role = 'child'
       )`,
    [linkId, req.user.id, req.user.id],
    function (err) {
      if (err) {
        return res.status(500).json({
          error: "Database error"
        });
      }

      if (this.changes === 0) {
        return res.status(404).json({
          error: "Specialist link not found or access denied"
        });
      }

      return res.status(200).json({
        message: "Specialist unlinked successfully"
      });
    }
  );
});
app.get("/api/tasks", (req, res) => {
  db.all("SELECT * FROM tasks", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    res.json(rows);
  });
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
    if (err) return res.status(500).json({ error: "Server error" });

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" },
    );

    res.json({
      token,
      user: { id: user.id, name: user.name, role: user.role },
    });
  });
});

app.get("/api/me", requireAuth, (req, res) => {
  db.get(
    "SELECT id, name, email, role FROM users WHERE id = ?",
    [req.user.id],
    (err, user) => {
      if (err) return res.status(500).json({ error: "Server error" });
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json(user);
    },
  );
});


module.exports = { app, db };