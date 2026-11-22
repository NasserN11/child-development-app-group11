// OPTIONAL, for trying the app by hand. Not used by tests or CI.
// Run after `node seed.js`:   node seed-demo-links.js
//
// Gives the seeded accounts the relationships the screens need:
//   - parent@example.com owns Child One
//   - specialist1@example.com is linked to Child One
// (specialist2@example.com stays unlinked, so you can see the access rule work.)
// Do not run it before running the automated tests: the M2 tests expect these rows to be absent.

const { db } = require("./app");
const { run, get } = require("./dbAsync");

async function main() {
  // app.js creates the link tables when it starts; wait until they exist.
  for (let i = 0; i < 40; i++) {
    const row = await get(db, "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'parent_child_links'");
    if (row) break;
    await new Promise((r) => setTimeout(r, 50));
  }

  const parent = await get(db, "SELECT id FROM users WHERE email = 'parent@example.com'");
  const specialist = await get(db, "SELECT id FROM users WHERE email = 'specialist1@example.com'");
  const child = await get(db, "SELECT id FROM users WHERE email = 'child@example.com'");

  await run(db, "INSERT OR IGNORE INTO parent_child_links (child_id, parent_id) VALUES (?, ?)", [child.id, parent.id]);
  await run(
    db,
    `INSERT OR IGNORE INTO specialist_links (parent_id, child_id, specialist_id, specialist_type)
     VALUES (?, ?, ?, 'psychologist')`,
    [parent.id, child.id, specialist.id],
  );
  console.log("Demo links created: parent owns Child One, Specialist One is linked.");
  db.close();
}

main().catch((err) => {
  console.error(err);
  db.close();
});
