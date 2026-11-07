const sqlite3 = require('sqlite3').verbose();
const path = require('path');


const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) return console.error('Error opening database:', err.message);
    console.log('Connected to the SQLite database.');
});


db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS tasks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          status TEXT NOT NULL
        )
        `, (err) => {
            if (err) console.error('Erron creating table:', err.message);
        });

    db.run(`DELETE FROM tasks`);

    const stmt = db.prepare(`INSERT INTO tasks (title, status) VALUES (?, ?)`);

    stmt.run('Learn Express.js', 'Done');
    stmt.run('Build a backend server', 'in progress');
    stmt.run('Test the API route', 'pending');

    stmt.finalize((err) => {
        if (err) console.error('Error inserting data:', err.message);
        else {
            console.log('Database successfully seeded with initial tasks!');
            db.close();
        }
    })
})