export function getUser() {
    try {
        return JSON.parse(localStorage.getItem('user'));
    }   catch {
        return null;
    }
}

export function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
}