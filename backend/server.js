const express = require('express');
const app = express();
const port = 5000;

const tasks = [
    { id: 1, title: 'Learn Express.js', status: 'completed' },
    { id: 2, title: 'Build a backend server', status: 'in progress' },
    { id: 3, title: 'Test the API route', status: 'pending' }
];

app.get('/api/tasks', (req, res) => {
    res.json(tasks);
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});