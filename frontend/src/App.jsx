import { useState, useEffect } from 'react';

function App() {
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    fetch('/api/tasks')
      .then((res) => res.json())
      .then((data) => setTasks(data))
      .catch((err) => console.error('Error fetching tasks:', err));
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Task Manager</h1>
      <ul>
        {tasks.map((task) => (
          <li key={task.id} style={{ marginBottom: '10px' }}>
            <strong>{task.title}</strong> - 
            <span style={{ color: task.status === 'completed' ? 'green' : 'orange' }}>
              {' '}{task.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
