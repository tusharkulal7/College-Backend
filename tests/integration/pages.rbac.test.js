const request = require('supertest');
const app = require('../../app');

// Mock jwt.verify to map token values to user ids
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn((token, getKey, opts, cb) => {
    if (typeof opts === 'function') cb = opts;
    const map = {
      'token_user': { sub: 'user_user' },
      'token_admin': { sub: 'user_admin' },
      'token_super': { sub: 'user_super' },
    };
    const payload = map[token] || null;
    if (!payload) return cb(new Error('invalid token'));
    cb(null, payload);
  }),
}));

// Mock Clerk to return users with different roles
jest.mock('../../config/clerk', () => ({
  getUserById: jest.fn(async (id) => {
    const users = {
      'user_user': { id: 'user_user', public_metadata: { roles: ['user'] }, email_addresses: [{ email_address: 'user@example.com' }], first_name: 'Normal', last_name: 'User' },
      'user_admin': { id: 'user_admin', public_metadata: { roles: ['admin'] }, email_addresses: [{ email_address: 'admin@example.com' }], first_name: 'Admin', last_name: 'User' },
      'user_super': { id: 'user_super', public_metadata: { roles: ['superadmin'] }, email_addresses: [{ email_address: 'super@example.com' }], first_name: 'Super', last_name: 'Admin' },
    };
    return users[id];
  }),
}));

// Mock page.service so tests don't depend on DB
jest.mock('../../modules/pages/page.service', () => ({
  createPage: jest.fn(async (data) => ({ _id: 'page1', ...data })),
  updatePage: jest.fn(async (id, update) => ({ _id: id, ...update })),
  deletePage: jest.fn(async (id) => ({ deleted: 1 })),
}));

const { createPage, updatePage, deletePage } = require('../../modules/pages/page.service');

describe('Pages RBAC', () => {
  const newPage = { title: { en: 'Test', kn: '' }, slug: 'test', content: { en: 'body', kn: '' } };

  test('POST /api/pages - 401 without token', async () => {
    const res = await request(app).post('/api/pages').send(newPage);
    expect(res.status).toBe(401);
  });

  test('POST /api/pages - 403 for normal user', async () => {
    const res = await request(app).post('/api/pages').set('Authorization', 'Bearer token_user').send(newPage);
    expect(res.status).toBe(403);
  });

  test('POST /api/pages - 201 for admin', async () => {
    const res = await request(app).post('/api/pages').set('Authorization', 'Bearer token_admin').send(newPage);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('_id');
    expect(createPage).toHaveBeenCalled();
  });

  test('PUT /api/pages/:id - 403 for normal user', async () => {
    const res = await request(app).put('/api/pages/page1').set('Authorization', 'Bearer token_user').send({ title: { en: 'X', kn: '' } });
    expect(res.status).toBe(403);
  });

  test('PUT /api/pages/:id - 200 for admin', async () => {
    const res = await request(app).put('/api/pages/page1').set('Authorization', 'Bearer token_admin').send({ title: { en: 'X', kn: '' } });
    expect(res.status).toBe(200);
    expect(updatePage).toHaveBeenCalled();
  });

  test('DELETE /api/pages/:id - 403 for admin', async () => {
    const res = await request(app).delete('/api/pages/page1').set('Authorization', 'Bearer token_admin');
    expect(res.status).toBe(403);
  });

  test('DELETE /api/pages/:id - 204 for superadmin', async () => {
    const res = await request(app).delete('/api/pages/page1').set('Authorization', 'Bearer token_super');
    expect(res.status).toBe(204);
    expect(deletePage).toHaveBeenCalledWith('page1');
  });
});
