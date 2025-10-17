// tests/integration/appointments.slots.test.js
import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

import app from '../../src/app.js';
import { connectDB } from '../../src/config/db.js';
import env from '../../src/config/env.js';
import User from '../../src/models/User.js';
import Appointment from '../../src/models/Appointment.js';

const agent = request(app);

// ---- IMPORTANT: declare variables in outer scope ----
let doctor;
let patient;
let docToken;
let patToken;

describe('GET /api/appointments/slots', () => {
  beforeAll(async () => {
    await connectDB();
  });

  beforeEach(async () => {
    // fresh DB per test
    await mongoose.connection.db.dropDatabase();

    // create users (passwordHash unused in this test)
    doctor = await User.create({
      email: 'doc@example.com',
      passwordHash: 'x',
      role: 'DOCTOR',
      name: 'Dr. Slot',
      specialization: 'CARDIO',
    });

    patient = await User.create({
      email: 'patient@example.com',
      passwordHash: 'x',
      role: 'PATIENT',
      name: 'Pat Ient',
    });

    // mint JWTs directly (no bcrypt / login)
    docToken = jwt.sign(
      { sub: doctor._id.toString(), role: 'DOCTOR', email: doctor.email },
      env.jwtSecret,
      { expiresIn: '1h' }
    );

    patToken = jwt.sign(
      { sub: patient._id.toString(), role: 'PATIENT', email: patient.email },
      env.jwtSecret,
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    // clean shutdown
    await mongoose.connection.close();
  });

  it('lists 30-min slots and marks a booked one unavailable', async () => {
    // 09:00 Asia/Colombo == 03:30Z
    const startISO = '2025-10-20T03:30:00.000Z';
    const endISO   = '2025-10-20T04:00:00.000Z';

    // create one appointment to block that slot
    const createRes = await agent
      .post('/api/appointments')
      .set('Authorization', `Bearer ${patToken}`)   // <-- uses outer-scoped token
      .send({
        doctorId: doctor._id.toString(),
        start: startISO,
        end: endISO,
        reason: 'test',
      });

    if (createRes.status !== 201) {
      // print server error once if it fails
      // eslint-disable-next-line no-console
      console.log('CREATE FAIL:', createRes.status, createRes.text);
    }
    expect(createRes.status).toBe(201);

    // ask for slots
    const slotsRes = await agent
      .get(`/api/appointments/slots?doctorId=${doctor._id.toString()}&date=2025-10-20&slotMinutes=30`)
      .set('Authorization', `Bearer ${docToken}`);

    expect(slotsRes.status).toBe(200);
    const { slots, slotMinutes } = slotsRes.body;
    expect(slotMinutes).toBe(30);

    // the exact booked slot should be unavailable
    const blocked = slots.find((s) => s.start === startISO && s.end === endISO);
    expect(blocked).toBeDefined();
    expect(blocked.available).toBe(false);

    // a neighbor (04:00Z–04:30Z) should be available if within work hours
    const neighbor = slots.find((s) => s.start === '2025-10-20T04:00:00.000Z');
    if (neighbor) expect(neighbor.available).toBe(true);
  });

  it('requires doctorId and date', async () => {
    const res = await agent
      .get('/api/appointments/slots')
      .set('Authorization', `Bearer ${patToken}`);
    expect(res.status).toBe(400);
  });
});
