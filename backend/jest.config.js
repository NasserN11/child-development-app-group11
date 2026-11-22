// Test files share one SQLite file, so run them one after another
// to avoid "database is locked" errors.
module.exports = { maxWorkers: 1 };
