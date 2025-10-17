// node scripts/seedAppointments.js
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import User from '../src/models/User.js';
import Appointment from '../src/models/Appointment.js';
import { nextAppointmentId } from '../src/services/id.service.js';

function iso(y, m, d, hh, mm) {
  // Asia/Colombo +5:30 -> return UTC ISO for given local time
  const local = new Date(Date.UTC(y, m - 1, d, hh - 5, mm - 30, 0, 0));
  return local.toISOString();
}

async function createAppt({ patient, doctor, startISO, endISO, status = 'PENDING', reason }) {
  const appointmentId = await nextAppointmentId();
  return Appointment.create({
    appointmentId,
    patient: patient._id,
    doctor: doctor._id,
    specialization: doctor.specialization,
    reason,
    start: new Date(startISO),
    end: new Date(endISO),
    status,
    createdBy: patient._id
  });
}

(async () => {
  try {
    await connectDB();
    const doc = await User.findOne({ role: 'DOCTOR' });
    const pat = await User.findOne({ role: 'PATIENT' });
    if (!doc || !pat) throw new Error('Need at least one DOCTOR and one PATIENT user');

    const appts = [
      { startISO: iso(2025,10,20,9,0), endISO: iso(2025,10,20,9,30), status: 'CONFIRMED', reason: 'ECG review' },
      { startISO: iso(2025,10,20,9,30), endISO: iso(2025,10,20,10,0), status: 'PENDING',   reason: 'BP follow-up' },
      { startISO: iso(2025,10,21,11,0), endISO: iso(2025,10,21,11,30), status: 'CANCELLED', reason: 'Migraine consult' }
    ];

    for (const a of appts) {
      await createAppt({ patient: pat, doctor: doc, ...a });
    }
    console.log('✅ Seeded appointments');
  } catch (e) {
    console.error('❌ Seed failed:', e);
  } finally {
    await mongoose.connection.close();
  }
})();
