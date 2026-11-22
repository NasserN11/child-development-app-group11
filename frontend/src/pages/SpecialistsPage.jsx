
import { useState } from 'react';
import { apiFetch } from '../api';
import './SpecialistsPage.css';
export default function SpecialistsPage() {
  const [childId, setChildId] = useState('');
  const [specialists, setSpecialists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

const [specialistEmail, setSpecialistEmail] = useState('');
const [specialistType, setSpecialistType] = useState('');
const [saving, setSaving] = useState(false);
const [success, setSuccess] = useState('');

const [removingLinkId, setRemovingLinkId] = useState(null);



  async function handleLoadSpecialists(event) {
    event.preventDefault();

    const id = Number(childId);

    if (!Number.isSafeInteger(id) || id <= 0) {
      setError('Please enter a valid child ID.');
      return;
    }
    setLoading(true);
    setError('');
    setLoaded(false);
    setSpecialists([]);

    try {
      const data = await apiFetch(
        `/api/children/${id}/specialists`
      );

      setSpecialists(data.specialists);
      setLoaded(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

async function handleAddSpecialist(event) {
  event.preventDefault();

  if (!loaded) {
    setError('Please load your child first.');
    return;
  }

  setSaving(true);
  setError('');
  setSuccess('');

  try {
    await apiFetch('/api/specialist-links', {
      method: 'POST',
      body: JSON.stringify({
        childId: Number(childId),
        specialistEmail: specialistEmail.trim(),
        specialistType: specialistType
      })
    });

    const data = await apiFetch(
      `/api/children/${Number(childId)}/specialists`
    );

    setSpecialists(data.specialists);
    setSpecialistEmail('');
    setSpecialistType('');
    setSuccess('Specialist linked successfully.');
  } catch (err) {
    setError(err.message);
  } finally {
    setSaving(false);
  }
}


async function handleRemoveSpecialist(linkId, specialistName) {
  const confirmed = window.confirm(
    `Are you sure you want to unlink ${specialistName}?`
  );

  if (!confirmed) {
    return;
  }

  setRemovingLinkId(linkId);
  setError('');
  setSuccess('');

  try {
    await apiFetch(`/api/specialist-links/${linkId}`, {
      method: 'DELETE'
    });

    setSpecialists((currentSpecialists) =>
      currentSpecialists.filter(
        (specialist) => specialist.linkId !== linkId
      )
    );

    setSuccess('Specialist unlinked successfully.');
  } catch (err) {
    setError(err.message);
  } finally {
    setRemovingLinkId(null);
  }
}

  return (
<div className="specialists-page">
      <h1>Specialists</h1>

      <p className="page-subtitle">
        Manage specialists linked to your child.
      </p>

      <section className="card">
        <h2>Select Child</h2>

        <form onSubmit={handleLoadSpecialists}>
          <label htmlFor="childId">Child ID</label>

          <input
            id="childId"
            type="number"
            min="1"
            value={childId}
            onChange={(event) => {
              setChildId(event.target.value);
              setLoaded(false);
              setError('');
            }}
          />

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Load Specialists'}
          </button>
        </form>
      </section>

<section className="card">
  <h2>Add Specialist</h2>

  <form onSubmit={handleAddSpecialist}>
    <div>
      <label htmlFor="specialistEmail">
        Specialist Email
      </label>

      <input
        id="specialistEmail"
        type="email"
        required
        value={specialistEmail}
        onChange={(event) =>
          setSpecialistEmail(event.target.value)
        }
      />
    </div>

    <div>
      <label htmlFor="specialistType">
        Specialist Type
      </label>

      <select
        id="specialistType"
        required
        value={specialistType}
        onChange={(event) =>
          setSpecialistType(event.target.value)
        }
      >
        <option value="">Select type</option>
        <option value="Psychologist">Psychologist</option>
        <option value="Speech Therapist">
          Speech Therapist
        </option>
        <option value="Occupational Therapist">
          Occupational Therapist
        </option>
        <option value="Other">Other</option>
      </select>
    </div>

    <button
      type="submit"
      className="btn btn-primary"
      disabled={saving || !loaded}
    >
      {saving ? 'Adding...' : 'Add Specialist'}
    </button>
  </form>
</section>

{success && (
  <p role="status">{success}</p>
)}

      {error && (
        <p className="error-text">{error}</p>
      )}

      <section className="card">
        <h2>Linked Specialists</h2>

        {loaded && specialists.length === 0 && (
          <p>No specialists linked to this child.</p>
        )}

        {loaded && specialists.length > 0 && (
          <ul>
            {specialists.map((specialist) => (
              <li key={specialist.linkId}>
                <strong>{specialist.specialistName}</strong>
                {' — '}
                {specialist.specialistType}
                {' — '}
                {specialist.specialistEmail}

{' '}

<button
  type="button"
  className="btn"
  disabled={removingLinkId !== null}
  onClick={() =>
    handleRemoveSpecialist(
      specialist.linkId,
      specialist.specialistName
    )
  }
>
  {removingLinkId === specialist.linkId
    ? 'Removing...'
    : 'Remove'}
</button>

              </li>
            ))}
          </ul>
        )}

        {!loaded && !loading && (
          <p>Select a child to view specialists.</p>
        )}
      </section>
    </div>
  );
}
