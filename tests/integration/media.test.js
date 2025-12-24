const request = require('supertest');
const app = require('../../app');
const path = require('path');

jest.mock('../../config/cloudinary', () => ({
  cloudinary: {
    uploader: {
      upload: jest.fn(async (filePath) => ({
        secure_url: 'https://res.cloudinary.com/demo/image/upload/v12345/sample.jpg',
        public_id: 'sample',
        bytes: 12345,
        format: 'jpg',
        resource_type: 'image',
      })),
    },
    utils: {
      api_sign_request: jest.fn(() => 'sig123'),
    },
  },
  configure: jest.fn(),
}));

jest.mock('../../modules/media/media.service', () => ({
  createMediaFromUpload: jest.fn(async ({ filePath, filename }) => ({ _id: 'm1', url: 'https://res.cloudinary.com/demo/image/upload/v12345/sample.jpg', filename })),
}));

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn((token, getKey, opts, cb) => {
    if (typeof opts === 'function') cb = opts;
    cb(null, { sub: 'user_admin' });
  }),
}));

jest.mock('../../config/clerk', () => ({ getUserById: jest.fn(async () => ({ id: 'user_admin', public_metadata: { roles: ['admin'] }, email_addresses: [{ email_address: 'admin@example.com' }] })) }));

describe('Media upload', () => {
  test('POST /api/media/upload requires auth', async () => {
    const res = await request(app).post('/api/media/upload');
    expect(res.status).toBe(401);
  });

  test('POST /api/media/upload success', async () => {
    const res = await request(app)
      .post('/api/media/upload')
      .set('Authorization', 'Bearer token_admin')
      .attach('file', path.resolve(__dirname, '../fixtures/sample.jpg'));

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('_id');
  });

  test('POST /api/media/upload forbidden for non-editor/admin', async () => {
    // Override clerk mock to return a 'user' role
    const clerk = require('../../config/clerk');
    clerk.getUserById.mockImplementationOnce(async () => ({ id: 'user_1', public_metadata: { roles: ['user'] }, email_addresses: [{ email_address: 'user@example.com' }] }));

    // Don't attach file to avoid request stream reset when server rejects early
    const res = await request(app)
      .post('/api/media/upload')
      .set('Authorization', 'Bearer token_user');

    expect(res.status).toBe(403);
  });

  test('POST /api/media/sign requires auth', async () => {
    const res = await request(app).post('/api/media/sign');
    expect(res.status).toBe(401);
  });

  test('POST /api/media/sign success for admin/editor', async () => {
    const res = await request(app)
      .post('/api/media/sign')
      .set('Authorization', 'Bearer token_admin')
      .send({ folder: 'pages', public_id: 'myfile' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('signature');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('apiKey');
  });
});
