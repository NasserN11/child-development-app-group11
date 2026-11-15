process.env.JWT_SECRET = 'test-secret';

const request = require('supertest');
const { app, db } = require('../app');

afterAll((done) => {
    db.close(done);
});

describe('POST /api/auth/login', () => {

    test('returns a token for correct credentials', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'parent@example.com', password: 'password123' });

        expect(res.status).toBe(200);
        expect(res.body.token).toBeDefined();
        expect(res.body.user.role).toBe('parent');
    });

    test('rejects a wrong password with 401', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'parent@example.com', password: 'wrongPassword' });

        expect(res.status).toBe(401);
    });

    test('gives the same 401 message for an unknown email', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'wrongEmail@example.com', password: 'password123' });

        expect(res.status).toBe(401);
        expect(res.body.error).toBe(res.body.error);
    });

    test('returns 400 when the password is missing', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'parent@example.com' });

        expect(res.status).toBe(400);
    });
});



describe('Get /api/me', () => {
    async function loginAs(email) {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email, password: 'password123' });
        return res.body.token;
    }

    test('rejects a request with no token', async () => {
        const res = await request(app).get('/api/me');
        expect(res.status).toBe(401);
    });

    test('rejects a tampered token', async () => {
        const token = await loginAs('parent@example.com');
        const res = await request(app)
            .get('/api/me')
            .set('Authorization', `Bearer ${token}tampered`);

        expect(res.status).toBe(401);
    });

    test('returns the user for a valid token, without the password hash', async () => {
        const token = await loginAs('specialist1@example.com');
        const res = await request(app)
            .get('/api/me')
            .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.role).toBe('specialist');
            expect(res.body.password_hash).toBeUndefined();
    });
});