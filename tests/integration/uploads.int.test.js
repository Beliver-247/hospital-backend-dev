import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import app from '../../src/app.js';
import { createUser, issueToken } from '../helpers/auth.js';

describe('Uploads -> POST /api/uploads', () => {
  let token;
  const tmpFile = path.resolve('uploads', 'test.pdf');

  beforeEach(async () => {
    const doc = await createUser({ email: 'doc@example.com', role: 'DOCTOR', password: 'secret' });
    token = issueToken(doc);
    // create a tiny fake PDF buffer (valid enough for test)
    fs.writeFileSync(tmpFile, Buffer.from('%PDF-1.4\n%EOF'));
  });

  afterEach(() => {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  });

  test('accepts a PDF and returns a URL', async () => {
    const res = await request(app)
      .post('/api/uploads')
      .set('Authorization', `Bearer ${token}`)
      .field('type', 'ID')
      .attach('file', tmpFile);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('url');
    expect(res.body).toHaveProperty('filename');
  });

  test('rejects unsupported file type', async () => {
    const badFile = path.resolve('uploads', 'bad.txt');
    fs.writeFileSync(badFile, 'hello');
    const res = await request(app)
      .post('/api/uploads')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', badFile);

    // multer throws -> our error handler should 500 or 400 depending on filter
    expect([400, 500]).toContain(res.status);

    if (fs.existsSync(badFile)) fs.unlinkSync(badFile);
  });
});
