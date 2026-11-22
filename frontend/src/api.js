import { logout } from './auth';

export async function apiFetch(path, options = {}) {
    const token = localStorage.getItem('token');

    const res = await fetch(path, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...options.headers,
        }
    });

    const data = await res.json().catch(() => null);

    if (res.status === 401 && token && !path.startsWith('/api/auth/')) {
        logout();
        window.location.href = '/login';
        throw new Error('Session expired. Please sign in again.');
    }

    if (!res.ok) {
        throw new Error(data?.error || `Request failed (${res.status})`);
    }

    return data;
}