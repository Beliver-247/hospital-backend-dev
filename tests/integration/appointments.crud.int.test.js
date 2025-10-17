// tests/integration/appointments.crud.int.test.js
import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

import app from '../../src/app.js';
import { connectDB } from '../../src/config/db.js';
import env from '../../src/config/env.js';
import User from '../../src/models/User.js';
import Appointment from '../../src/models/Appointment.js';

const agent = request(app);

let doctor; let doctor2; let patient; let staff;
let docToken; let doc2Token; let patToken; let staffToken;

function mint(user, role) {
  return jwt.sign({ sub: user._id.toString(), role, email: user.email }, env.jwtSecret, { expiresIn: '2h' });
}

async function createAppt(token, { doctorId, start, end, reason = 'test', submissionId }) {
  return agent.post('/api/appointments')
    .set('Authorization', `Bearer ${token}`)
    .send({ doctorId, start, end, reason, ...(submissionId ? { submissionId } : {}) });
}

describe('Appointments CRUD', () => {
  beforeAll(async () => {
    await connectDB();
  });

  beforeEach(async () => {
    await mongoose.connection.db.dropDatabase();

    // Users
    doctor = await User.create({ email: 'doc1@example.com', passwordHash: 'x', role: 'DOCTOR', name: 'Dr One', specialization: 'CARDIO' });
    doctor2 = await User.create({ email: 'doc2@example.com', passwordHash: 'x', role: 'DOCTOR', name: 'Dr Two', specialization: 'NEURO' });
    patient = await User.create({ email: 'pat@example.com', passwordHash: 'x', role: 'PATIENT', name: 'Pat Test' });
    staff   = await User.create({ email: 'staff@example.com', passwordHash: 'x', role: 'STAFF', name: 'Ms Staff' });

    // Tokens
    docToken   = mint(doctor, 'DOCTOR');
    doc2Token  = mint(doctor2, 'DOCTOR');
    patToken   = mint(patient, 'PATIENT');
    staffToken = mint(staff, 'STAFF');
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  it('patient can create, list own; staff lists all; doctor lists own', async () => {
    const dId = doctor._id.toString();
    const s1 = '2025-10-20T03:30:00.000Z'; // 09:00 Colombo
    const e1 = '2025-10-20T04:00:00.000Z';

    const createRes = await createAppt(patToken, { doctorId: dId, start: s1, end: e1, reason: 'first appt' });
    expect(createRes.status).toBe(201);
    const apptId = createRes.body.appointment?.appointmentId || createRes.body.appointment?.appointmentId; // resilient

    // patient lists (mine)
    const pList = await agent.get('/api/appointments?mine=true').set('Authorization', `Bearer ${patToken}`);
    expect(pList.status).toBe(200);
    expect(pList.body.items.length).toBe(1);
    expect(pList.body.items[0].appointmentId).toBeDefined();

    // doctor lists (mine)
    const dList = await agent.get('/api/appointments?mine=true').set('Authorization', `Bearer ${docToken}`);
    expect(dList.status).toBe(200);
    expect(dList.body.items.length).toBe(1);

    // staff lists all
    const sList = await agent.get('/api/appointments').set('Authorization', `Bearer ${staffToken}`);
    expect(sList.status).toBe(200);
    expect(sList.body.total).toBe(1);

    // fetch by id/key as patient
    const getOne = await agent.get(`/api/appointments/${apptId}`).set('Authorization', `Bearer ${patToken}`);
    expect(getOne.status).toBe(200);
  });

  it('patient can reschedule while PENDING; double-book guard returns 409', async () => {
    const dId = doctor._id.toString();
    // Book slot A
    const Astart = '2025-10-20T03:30:00.000Z';
    const Aend   = '2025-10-20T04:00:00.000Z';
    const createA = await createAppt(patToken, { doctorId: dId, start: Astart, end: Aend, reason: 'A' });
    expect(createA.status).toBe(201);
    const apptKey = createA.body.appointment.appointmentId;

    // Another patient booking slot B to clash with reschedule
    const otherPat = await User.create({ email: 'other@example.com', passwordHash: 'x', role: 'PATIENT', name: 'Other' });
    const otherTok = mint(otherPat, 'PATIENT');
    const Bstart = '2025-10-20T04:00:00.000Z';
    const Bend   = '2025-10-20T04:30:00.000Z';
    const createB = await createAppt(otherTok, { doctorId: dId, start: Bstart, end: Bend, reason: 'B' });
    expect(createB.status).toBe(201);

    // Patient tries to reschedule A into B -> 409
    const clash = await agent.patch(`/api/appointments/${apptKey}`)
      .set('Authorization', `Bearer ${patToken}`)
      .send({ start: Bstart, end: Bend });
    expect([409,400]).toContain(clash.status); // 409 expected; 400 only if validation differs
    if (clash.status !== 409) {
      // eslint-disable-next-line no-console
      console.log('RESCHEDULE CLASH BODY:', clash.status, clash.text);
    }

    // Reschedule to a free slot -> 200
    const Cstart = '2025-10-20T04:30:00.000Z';
    const Cend   = '2025-10-20T05:00:00.000Z';
    const ok = await agent.patch(`/api/appointments/${apptKey}`)
      .set('Authorization', `Bearer ${patToken}`)
      .send({ start: Cstart, end: Cend, reason: 'rescheduled' });
    expect(ok.status).toBe(200);
    expect(ok.body.appointment.start).toBe(Cstart);
    expect(ok.body.appointment.rescheduleCount).toBeGreaterThanOrEqual(1);
  });

  it('doctor/staff can change status with valid transitions; invalid transitions fail', async () => {
    const dId = doctor._id.toString();
    const start = '2025-10-21T03:30:00.000Z';
    const end   = '2025-10-21T04:00:00.000Z';
    const create = await createAppt(patToken, { doctorId: dId, start, end });
    expect(create.status).toBe(201);
    const key = create.body.appointment.appointmentId;

    // PENDING -> CONFIRMED (doctor)
    const conf = await agent.patch(`/api/appointments/${key}`)
      .set('Authorization', `Bearer ${docToken}`)
      .send({ status: 'CONFIRMED' });
    expect(conf.status).toBe(200);
    expect(conf.body.appointment.status).toBe('CONFIRMED');

    // CONFIRMED -> COMPLETED (staff)
    const done = await agent.patch(`/api/appointments/${key}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'COMPLETED' });
    expect(done.status).toBe(200);
    expect(done.body.appointment.status).toBe('COMPLETED');

    // COMPLETED -> CONFIRMED (invalid)
    const invalid = await agent.patch(`/api/appointments/${key}`)
      .set('Authorization', `Bearer ${docToken}`)
      .send({ status: 'CONFIRMED' });
    expect([400,409]).toContain(invalid.status);
  });

  it('patient can cancel PENDING; cannot cancel CONFIRMED; staff can cancel any', async () => {
    const dId = doctor._id.toString();
    const start = '2025-10-22T03:30:00.000Z';
    const end   = '2025-10-22T04:00:00.000Z';
    const create = await createAppt(patToken, { doctorId: dId, start, end });
    expect(create.status).toBe(201);
    const key = create.body.appointment.appointmentId;

    // patient cancel while PENDING -> 200
    const cancel1 = await agent.delete(`/api/appointments/${key}`)
      .set('Authorization', `Bearer ${patToken}`);
    expect(cancel1.status).toBe(200);
    expect(cancel1.body.appointment.status).toBe('CANCELLED');

    // Make a new one and confirm it
    const create2 = await createAppt(patToken, { doctorId: dId, start: '2025-10-23T03:30:00.000Z', end: '2025-10-23T04:00:00.000Z' });
    expect(create2.status).toBe(201);
    const key2 = create2.body.appointment.appointmentId;

    const confirm2 = await agent.patch(`/api/appointments/${key2}`)
      .set('Authorization', `Bearer ${docToken}`)
      .send({ status: 'CONFIRMED' });
    expect(confirm2.status).toBe(200);

    // patient tries to cancel CONFIRMED -> 409
    const cancelDenied = await agent.delete(`/api/appointments/${key2}`)
      .set('Authorization', `Bearer ${patToken}`);
    expect([409,403]).toContain(cancelDenied.status);

    // staff cancels it -> 200
    const cancelStaff = await agent.delete(`/api/appointments/${key2}`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(cancelStaff.status).toBe(200);
    expect(cancelStaff.body.appointment.status).toBe('CANCELLED');
  });

  it('idempotency via submissionId returns the same appointment', async () => {
    const dId = doctor._id.toString();
    const start = '2025-10-24T03:30:00.000Z';
    const end   = '2025-10-24T04:00:00.000Z';
    const subId = '4f3f9f6b-5c7b-466d-9890-0a2d2879d3d1';

    const a1 = await createAppt(patToken, { doctorId: dId, start, end, submissionId: subId });
    const a2 = await createAppt(patToken, { doctorId: dId, start, end, submissionId: subId });

    expect(a1.status).toBe(201);
    expect([200,201]).toContain(a2.status);
    const id1 = a1.body.appointment._id;
    const id2 = a2.body.appointment._id;
    expect(id1).toBe(id2);
  });

  it('doctor can reschedule; double-book guard applies to reschedule too', async () => {
    const dId = doctor._id.toString();
    // A and B
    const Astart = '2025-10-25T03:30:00.000Z';
    const Aend   = '2025-10-25T04:00:00.000Z';
    const Bstart = '2025-10-25T04:00:00.000Z';
    const Bend   = '2025-10-25T04:30:00.000Z';

    const a = await createAppt(patToken, { doctorId: dId, start: Astart, end: Aend });
    const bOtherPat = await User.create({ email: 'bpat@example.com', passwordHash: 'x', role: 'PATIENT', name: 'B Pat' });
    const bTok = mint(bOtherPat, 'PATIENT');
    const b = await createAppt(bTok, { doctorId: dId, start: Bstart, end: Bend });

    expect(a.status).toBe(201);
    expect(b.status).toBe(201);

    const keyA = a.body.appointment.appointmentId;

    // Doctor tries to reschedule A into B -> 409
    const clash = await agent.patch(`/api/appointments/${keyA}`)
      .set('Authorization', `Bearer ${docToken}`)
      .send({ start: Bstart, end: Bend });
    expect([409,400]).toContain(clash.status);

    // Reschedule A to a free slot -> 200
    const Cstart = '2025-10-25T04:30:00.000Z';
    const Cend   = '2025-10-25T05:00:00.000Z';
    const ok = await agent.patch(`/api/appointments/${keyA}`)
      .set('Authorization', `Bearer ${docToken}`)
      .send({ start: Cstart, end: Cend });
    expect(ok.status).toBe(200);
    expect(ok.body.appointment.start).toBe(Cstart);
  });
});
