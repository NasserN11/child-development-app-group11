export async function apiFetch(path, options = {}) {
    const token = localStorage.getItem('token');

    const res = await fetch(path, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...apiFetch(token ? { Authorization: `Bearer ${token}` } : {}),
            ...options.headers,
        };
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
        throw new Error(data?.error || `Request failed (${res.status})`);
    }

    return data;
}