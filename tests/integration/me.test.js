const request = require('supertest');
const app = require('../../app');

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn((token, getKey, opts, cb) => {
    // allow optional opts param
    if (typeof opts === 'function') cb = opts;
    // Simulate successful verification with sub
    cb(null, { sub: 'user_123' });
  }),
}));

jest.mock('../../config/clerk', () => ({
  getUserById: jest.fn(async (id) => ({
    id: 'user_123',
    public_metadata: { roles: ['admin'] },
    email_addresses: [{ email_address: 'admin@example.com' }],
    first_name: 'Admin',
    last_name: 'User',
  })),
}));

describe('GET /api/me', () => {
  test('returns 401 without Authorization header', async () => {
    const res = await request(app).get('/api/me');
    expect(res.status).toBe(401);
  });

  test('returns user object with valid token', async () => {
    const res = await request(app).get('/api/me').set('Authorization', 'Bearer faketoken');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', 'user_123');
    expect(res.body).toHaveProperty('email', 'admin@example.com');
    expect(res.body).toHaveProperty('roles');
    expect(Array.isArray(res.body.roles)).toBe(true);
  });
});
