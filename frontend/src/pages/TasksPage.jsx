import { useEffect, useState } from "react";
import { apiFetch } from "../api";
import { getUser } from "../auth";
import "./TasksPage.css";

// Must match the development areas the backend accepts.
const AREAS = ["Cognitive", "Language", "Social-Emotional", "Motor"];
const EMPTY_FORM = {
  title: "",
  description: "",
  development_area: AREAS[0],
  due_date: "",
};

function StatusBadge({ status }) {
  return (
    <span className={`status-badge status-${status}`}>
      {status === "done" ? "Done" : "Pending"}
    </span>
  );
}

export default function TasksPage() {
  const user = getUser();
  const isChild = user?.role === "child";

  const [children, setChildren] = useState([]);
  const [childId, setChildId] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [childrenLoaded, setChildrenLoaded] = useState(false);
  const [loadedFor, setLoadedFor] = useState(null); // child whose tasks were last loaded
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editDate, setEditDate] = useState("");

  // 1. Load the children this user may work with.
  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/children")
      .then((list) => {
        if (cancelled) return;
        setChildren(list);
        setChildId(list.length > 0 ? list[0].id : null);
        setChildrenLoaded(true);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setChildrenLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 2. Load the tasks of the selected child.
  useEffect(() => {
    if (childId === null) return;
    let cancelled = false;
    apiFetch(`/api/children/${childId}/tasks`)
      .then((list) => {
        if (cancelled) return;
        setTasks(list);
        setError("");
        setLoadedFor(childId);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setLoadedFor(childId);
      });
    return () => {
      cancelled = true;
    };
  }, [childId]);

  function replaceTask(updated) {
    setTasks((current) => current.map((t) => (t.id === updated.id ? updated : t)));
  }

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleCreate(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);
    try {
      const created = await apiFetch(`/api/children/${childId}/tasks`, {
        method: "POST",
        body: JSON.stringify(form),
      });
      setTasks((current) =>
        [...current, created].sort(
          (a, b) => a.due_date.localeCompare(b.due_date) || a.id - b.id,
        ),
      );
      setForm(EMPTY_FORM);
      setMessage("Task assigned.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkDone(task) {
    setError("");
    setMessage("");
    try {
      const updated = await apiFetch(`/api/children/${childId}/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "done" }),
      });
      replaceTask(updated);
      setMessage("Well done! Task marked as done.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSaveDueDate(task) {
    setError("");
    setMessage("");
    try {
      const updated = await apiFetch(`/api/children/${childId}/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ due_date: editDate }),
      });
      replaceTask(updated);
      setEditingId(null);
      setMessage("Due date updated.");
    } catch (err) {
      setError(err.message);
    }
  }

  // Still loading until the children, and then the selected child's tasks, have arrived.
  const loading = !childrenLoaded || (childId !== null && loadedFor !== childId);

  const selectedChild = children.find((c) => c.id === childId);

  return (
    <div className="tasks-page">
      <h1>{isChild ? "My tasks" : "Tasks"}</h1>
      <p className="page-subtitle">
        {isChild
          ? "Tap \"Mark as done\" when you finish a task."
          : "Assign tasks and follow their status."}
      </p>

      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="success-text" role="status">
          {message}
        </p>
      )}

      {!isChild && children.length > 1 && (
        <div className="card">
          <label htmlFor="child-select">Child</label>
          <select
            id="child-select"
            value={childId ?? ""}
            onChange={(e) => {
              setChildId(Number(e.target.value));
              setMessage("");
            }}
          >
            {children.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {!loading && children.length === 0 && !error && (
        <div className="card">
          {isChild
            ? "No child profile was found for this account."
            : "No children are linked to your account yet."}
        </div>
      )}

      {!isChild && childId !== null && (
        <form className="card tasks-form" onSubmit={handleCreate}>
          <h2>Assign a task{selectedChild ? ` to ${selectedChild.name}` : ""}</h2>

          <label htmlFor="task-title">Title</label>
          <input
            id="task-title"
            value={form.title}
            onChange={(e) => updateForm("title", e.target.value)}
            maxLength={200}
            required
          />

          <label htmlFor="task-description">Description</label>
          <textarea
            id="task-description"
            value={form.description}
            onChange={(e) => updateForm("description", e.target.value)}
            maxLength={1000}
            rows={3}
          />

          <div className="tasks-form-row">
            <div>
              <label htmlFor="task-area">Development area</label>
              <select
                id="task-area"
                value={form.development_area}
                onChange={(e) => updateForm("development_area", e.target.value)}
              >
                {AREAS.map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="task-due">Due date</label>
              <input
                id="task-due"
                type="date"
                value={form.due_date}
                onChange={(e) => updateForm("due_date", e.target.value)}
                required
              />
            </div>
          </div>

          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save task"}
          </button>
        </form>
      )}

      {loading && <p>Loading tasks...</p>}

      {!loading && childId !== null && tasks.length === 0 && (
        <div className="card">No tasks yet.</div>
      )}

      {/* Child view: simple cards with a "Mark as done" button */}
      {!loading && isChild && tasks.length > 0 && (
        <ul className="child-task-list">
          {tasks.map((task) => (
            <li key={task.id} className="card">
              <div className="child-task-head">
                <strong>{task.title}</strong>
                <StatusBadge status={task.status} />
              </div>
              {task.description && <p>{task.description}</p>}
              <p className="task-meta">
                Area: {task.development_area} · Due: {task.due_date}
              </p>
              {task.status === "pending" && (
                <button className="btn btn-primary" onClick={() => handleMarkDone(task)}>
                  Mark as done
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Parent / specialist view: table with status and assigner */}
      {!loading && !isChild && tasks.length > 0 && (
        <div className="card table-wrap">
          <table className="task-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Area</th>
                <th>Due date</th>
                <th>Status</th>
                <th>Assigned by</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id}>
                  <td>
                    <strong>{task.title}</strong>
                    {task.description && <div className="task-meta">{task.description}</div>}
                  </td>
                  <td>{task.development_area}</td>
                  <td>
                    {editingId === task.id ? (
                      <span className="inline-edit">
                        <input
                          type="date"
                          aria-label={`New due date for ${task.title}`}
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                        />
                        <button className="btn" onClick={() => handleSaveDueDate(task)}>
                          Save
                        </button>
                        <button className="btn" onClick={() => setEditingId(null)}>
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <>
                        {task.due_date}
                        {task.assigned_by === user?.id && (
                          <button
                            className="btn btn-small"
                            onClick={() => {
                              setEditingId(task.id);
                              setEditDate(task.due_date);
                            }}
                          >
                            Change
                          </button>
                        )}
                      </>
                    )}
                  </td>
                  <td>
                    <StatusBadge status={task.status} />
                  </td>
                  <td>{task.assigned_by === user?.id ? "You" : task.assigned_by_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
