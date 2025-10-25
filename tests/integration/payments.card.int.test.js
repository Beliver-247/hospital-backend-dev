import request from 'supertest';
import app from '../../src/app.js';
import { connectDB } from '../../src/config/db.js';
import mongoose from 'mongoose';
import { createUser, issueToken } from '../helpers/auth.js';

describe('Card Payments (integration)', () => {

  let server;
  let token;
  // Force notifyDriver to 'console' for OTP test
  beforeAll(async () => {
    // Patch env to always return devOtpCode (ESM compatible)
    const envModule = await import('../../src/config/env.js');
    const env = envModule.default || envModule;
    env.notifyDriver = 'console';
    process.env.NOTIFY_DRIVER = 'console';
    await connectDB();
    const user = await createUser({ email: 'payer@test.com', role: 'PATIENT', name: 'Payer' });
    token = issueToken(user);
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  test('initiate and confirm card payment with OTP', async () => {
    const breakdown = {
      consultationFee: 1000,
      labTests: 500,
      prescription: 250,
      processingFee: 50,
      other: 0
    };

    const initRes = await request(app)
      .post('/api/payments/card/initiate')
      .set('Authorization', `Bearer ${token}`)
      .send({
        breakdown,
        currency: 'LKR',
        card: {
          number: '4242424242424242',
          expMonth: 12,
          expYear: new Date().getFullYear() + 1,
          cvc: '123',
          name: 'Test Card',
          brand: 'VISA'
        }
      })
      .expect(201);

    expect(initRes.body.paymentId).toBeTruthy();
    expect(initRes.body.otpRefId).toBeTruthy();

    // In console driver + non-production env we return devOtpCode for test use
    const { paymentId, otpRefId, devOtpCode } = initRes.body;
    expect(devOtpCode).toMatch(/^\d{6}$/);

    const confirmRes = await request(app)
      .post(`/api/payments/card/${paymentId}/confirm`)
      .set('Authorization', `Bearer ${token}`)
      .send({ otpRefId, otpCode: devOtpCode })
      .expect(200);

    expect(confirmRes.body.payment.status).toBe('CAPTURED');

    // History should include the payment
    const listRes = await request(app)
      .get('/api/payments/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(listRes.body.total).toBeGreaterThanOrEqual(1);
  });
});
