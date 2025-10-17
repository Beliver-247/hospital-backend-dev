import request from 'supertest';
import app from '../../src/app.js';
import { createUser } from '../helpers/auth.js';

describe('Auth -> POST /api/auth/login', () => {
  test('logs in with valid credentials', async () => {
    await createUser({ email: 'doc@example.com', role: 'DOCTOR', password: 'secret', name: 'Dr. T' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'doc@example.com', password: 'secret' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user).toMatchObject({ email: 'doc@example.com', role: 'DOCTOR' });
  });

  test('rejects invalid password', async () => {
    await createUser({ email: 'doc2@example.com', role: 'DOCTOR', password: 'secret' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'doc2@example.com', password: 'wrong' });

    expect(res.status).toBe(401);
  });
});
