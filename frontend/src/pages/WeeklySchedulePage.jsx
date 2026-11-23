import { useEffect, useState } from 'react';
import { apiFetch } from '../api';
import { getUser } from '../auth';
import './WeeklySchedulePage.css';

const timeZone = 'Europe/Istanbul';
const localDate = new Intl.DateTimeFormat('en-CA', { timeZone, dateStyle: 'short' });
const dayLabel = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC', weekday: 'long', month: 'short', day: 'numeric',
});
const eventDateTime = new Intl.DateTimeFormat('sv-SE', {
  timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
});

function addDays(value, days) {
  const date = new Date(value + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function thisMonday() {
  const date = localDate.format(new Date());
  return addDays(date, -((new Date(date + 'T00:00:00Z').getUTCDay() + 6) % 7));
}

function istanbulDateTime(value) {
  return eventDateTime.format(new Date(value)).replace(' ', 'T');
}

function toInstant(value) {
  const wallTime = Date.parse(value + ':00Z');
  let instant = wallTime;
  for (let attempt = 0; attempt < 3; attempt++) {
    const displayed = istanbulDateTime(instant);
    if (displayed === value) return new Date(instant).toISOString();
    instant += wallTime - Date.parse(displayed + ':00Z');
  }
  return null;
}

function WeekSelector({ week, setWeek }) {
  return (
    <nav className="schedule-week" aria-label="Calendar week">
      <button className="btn" onClick={() => setWeek(addDays(week, -7))}>Previous week</button>
      <span>{week} to {addDays(week, 6)}</span>
      <button className="btn" onClick={() => setWeek(addDays(week, 7))}>Next week</button>
      <button className="btn" onClick={() => setWeek(thisMonday())}>This week</button>
    </nav>
  );
}

function EventForm({ event, week, saving, onSave, onCancel }) {
  function submit(e) {
    e.preventDefault();
    const values = new FormData(e.currentTarget);
    const startTime = toInstant(values.get('startTime'));
    const endTime = toInstant(values.get('endTime'));
    if (!startTime || !endTime) {
      e.currentTarget.elements.startTime.setCustomValidity('Choose a valid time in Europe/Istanbul.');
      e.currentTarget.reportValidity();
      return;
    }
    onSave({ title: values.get('title'), description: values.get('description'), startTime, endTime });
  }

  return (
    <form className="schedule-form" onSubmit={submit}
      onInput={e => e.currentTarget.elements.startTime.setCustomValidity('')}>
      <h2>{event.id ? 'Edit event' : 'Add event'}</h2>
      <fieldset disabled={saving}>
        <label>Title<input name="title" required defaultValue={event.title} /></label>
        <label>Start<input name="startTime" type="datetime-local" required
          defaultValue={event.startTime ? istanbulDateTime(event.startTime) : week + 'T09:00'} /></label>
        <label>End<input name="endTime" type="datetime-local" required
          defaultValue={event.endTime ? istanbulDateTime(event.endTime) : week + 'T10:00'} /></label>
        <label>Description<textarea name="description" defaultValue={event.description ?? ''} /></label>
        <button className="btn" type="submit">{saving ? 'Saving…' : 'Save event'}</button>
        <button className="btn" type="button" onClick={onCancel}>Cancel</button>
      </fieldset>
    </form>
  );
}

export default function WeeklySchedulePage() {
  const user = getUser();
  const canWrite = ['parent', 'specialist'].includes(user?.role);
  const [week, setWeek] = useState(thisMonday);
  const [children, setChildren] = useState(null);
  const [childId, setChildId] = useState('');
  const [events, setEvents] = useState(null);
  const [childrenError, setChildrenError] = useState('');
  const [eventsError, setEventsError] = useState('');
  const [actionError, setActionError] = useState('');
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [revision, setRevision] = useState(0);
  const endpoint = '/api/children/' + childId + '/events';

  useEffect(() => {
    const controller = new AbortController();
    apiFetch('/api/schedule/children', { signal: controller.signal })
      .then(data => {
        setChildren(data.children);
        setChildId(String(data.children[0]?.id ?? ''));
      })
      .catch(error => {
        if (!controller.signal.aborted) setChildrenError(error.message);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!childId) return;
    const controller = new AbortController();
    apiFetch(endpoint + '?weekStart=' + week, { signal: controller.signal })
      .then(data => {
        if (!controller.signal.aborted) setEvents(data.events);
      })
      .catch(error => {
        if (!controller.signal.aborted) setEventsError(error.message);
      });
    return () => controller.abort();
  }, [childId, endpoint, week, revision]);

  function changeView(setValue, value) {
    setEvents(null);
    setEventsError('');
    setActionError('');
    setEditing(null);
    setValue(value);
    setRevision(current => current + 1);
  }

  async function changeEvent(method, id, body) {
    setSaving(true);
    setActionError('');
    try {
      await apiFetch(endpoint + (id ? '/' + id : ''), { method, body: JSON.stringify(body) });
      setEditing(null);
      setEventsError('');
      setRevision(value => value + 1);
    } catch (error) {
      setActionError(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="weekly-schedule">
      <h1>Weekly schedule</h1>
      {childrenError && <p role="alert">{childrenError}</p>}
      {!children && !childrenError && <p role="status">Loading children…</p>}
      {children?.length === 0 && <p>No children are linked to this account.</p>}
      {childId && <>
        <div className="schedule-controls">
          <label>Child <select value={childId} disabled={saving}
            onChange={e => changeView(setChildId, e.target.value)}>
            {children.map(child => <option key={child.id} value={child.id}>{child.name}</option>)}
          </select></label>
          <span>All times in Europe/Istanbul</span>
          {canWrite && <button className="btn" disabled={saving}
            onClick={() => { setEditing({}); setActionError(''); }}>Add event</button>}
        </div>
        <fieldset className="schedule-navigation" disabled={saving}>
          <WeekSelector week={week} setWeek={value => changeView(setWeek, value)} />
        </fieldset>
        {actionError && <p role="alert">{actionError}</p>}
        {editing && <EventForm key={editing.id ?? 'new'} event={editing} week={week} saving={saving}
          onSave={body => changeEvent(editing.id ? 'PATCH' : 'POST', editing.id, body)}
          onCancel={() => { setEditing(null); setActionError(''); }} />}
        {eventsError && <p role="alert">{eventsError}</p>}
        {!events && !eventsError && <p role="status">Loading events…</p>}
        {events && !events.length && <p>No events this week.</p>}
        {events && <div className="schedule-days">
          {Array.from({ length: 7 }, (_, offset) => {
            const date = addDays(week, offset);
            return (
              <section key={date} className="schedule-day">
                <h2>{dayLabel.format(new Date(date + 'T00:00:00Z'))}</h2>
                {events.filter(event => istanbulDateTime(event.startTime).startsWith(date)).map(event => (
                  <article key={event.id} className="schedule-event">
                    <h3>{event.title}</h3>
                    <p>{istanbulDateTime(event.startTime).slice(11)} – {' '}
                      {istanbulDateTime(event.endTime).replace(date + 'T', '').replace('T', ' ')}</p>
                    {event.description && <p>{event.description}</p>}
                    {canWrite && event.createdBy === user.id && <div className="schedule-actions">
                      <button className="btn" disabled={saving}
                        onClick={() => { setEditing(event); setActionError(''); }}>Edit</button>
                      <button className="btn" disabled={saving} onClick={() => {
                        if (window.confirm('Delete this event?')) changeEvent('DELETE', event.id);
                      }}>Delete</button>
                    </div>}
                  </article>
                ))}
              </section>
            );
          })}
        </div>}
      </>}
    </section>
  );
}
