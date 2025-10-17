// src/services/appointment.service.js
import mongoose from 'mongoose';
import Appointment from '../models/Appointment.js';
import User from '../models/User.js';
import { nextAppointmentId } from './id.service.js';
import { normalizeSlotRange } from './slot.service.js';
import env from '../config/env.js'
import { notifyAppointment } from './notify.service.js';

/* -------------------------- helpers / utilities -------------------------- */

function assert(cond, msg, status = 400) {
  if (!cond) { const e = new Error(msg); e.status = status; throw e; }
}

async function throwIfClash({ doctorId, start, end, excludeId = null, patientId = null }) {
  // Any active appointment overlapping [start, end) for this doctor blocks the slot
  const q = {
    doctor: doctorId,
    status: { $in: ['PENDING', 'CONFIRMED'] },
    start: { $lt: end },
    end:   { $gt: start }
  };
  // doctor clash always blocks
  const or = [{ doctor: doctorId }];

  // optional patient self-overlap across doctors
  if (env.blockPatientOverlap && patientId) {
    or.push({ patient: patientId });
  }
  q.$or = or;

  if (excludeId) q._id = { $ne: excludeId };

  const exists = await Appointment.exists(q);
  if (exists) {
    const err = new Error('Selected time slot is already booked');
    err.status = 409;
    throw err;
  }
}

function fallbackAppointmentId() {
  const year = new Date().getFullYear();
  return `APT-${year}-${String(Date.now()).slice(-6)}`;
}

function idOrKeyToQuery(idOrKey) {
  return /^[A-Z]{3}-\d{4}-\d{6}$/.test(idOrKey)
    ? { appointmentId: idOrKey }
    : { _id: idOrKey };
}

/* --------------------------------- create -------------------------------- */

export async function createAppointment({ patientUser, doctorId, startISO, endISO, reason, submissionId }) {
  // verify doctor
  const doctor = await User.findById(doctorId).lean();
  assert(doctor && doctor.role === 'DOCTOR', 'Doctor not found', 404);

  // idempotency
  if (submissionId) {
    const existing = await Appointment.findOne({ submissionId, patient: patientUser.id });
    if (existing) return existing;
  }

  const { start, end } = normalizeSlotRange(startISO, endISO);

  // app-level clash guard
  await throwIfClash({ doctorId: doctor._id, start, end, patientId: patientUser.id });

  // generate appointmentId with safe fallback
  let appointmentId;
  try {
    appointmentId = await nextAppointmentId();
  } catch (e) {
    console.error('nextAppointmentId failed, using fallback:', e?.message || e);
    appointmentId = fallbackAppointmentId();
  }

  const appt = new Appointment({
    appointmentId,
    patient: patientUser.id,
    doctor: doctor._id,
    specialization: doctor.specialization || undefined,
    reason,
    start,
    end,
    status: 'PENDING',
    createdBy: patientUser.id,
    submissionId: submissionId || undefined
  });

  try {
    const saved = await appt.save();
    const populated = await saved.populate([
      { path: 'patient', select: 'name email role' },
      { path: 'doctor',  select: 'name email role specialization' }
    ]);

    // Notify (no-op in tests)
    await notifyAppointment({
      action: 'CREATED',
      appointment: populated,
      actor: { id: patientUser.id, role: 'PATIENT', email: patientUser.email }
    });

    return populated;
  } catch (e) {
    if (e.code === 11000) {
      const err = new Error('Selected time slot is already booked');
      err.status = 409; throw err;
    }
    throw e;
  }
}

/* ----------------------------------- get ---------------------------------- */

export async function getAppointmentByIdOrKey(idOrKey, requester) {
  const q = idOrKeyToQuery(idOrKey);

  const appt = await Appointment.findOne(q)
    .populate('patient', 'name email role')
    .populate('doctor', 'name email role specialization')
    .lean();

  assert(appt, 'Appointment not found', 404);

  const isPatient = requester.role === 'PATIENT' && String(appt.patient._id) === String(requester.id);
  const isDoctor  = requester.role === 'DOCTOR'  && String(appt.doctor._id)  === String(requester.id);
  const isStaff   = requester.role === 'STAFF';
  assert(isPatient || isDoctor || isStaff, 'Forbidden', 403);

  return appt;
}

/* ---------------------------------- list ---------------------------------- */

export async function listAppointmentsService({ requester, query }) {
  const {
    mine,
    doctorId,
    patientId,
    from,
    to,
    status,
    q,
    page = 1,
    limit = 20
  } = query;

  const filter = {};

  if (requester.role === 'PATIENT') {
    // patients only see their own
    filter.patient = requester.id;
  } else if (requester.role === 'DOCTOR') {
    // doctors only see their own
    filter.doctor = requester.id;
  } else if (requester.role === 'STAFF') {
    if (doctorId && mongoose.Types.ObjectId.isValid(doctorId)) filter.doctor = doctorId;
    if (patientId && mongoose.Types.ObjectId.isValid(patientId)) filter.patient = patientId;
    // if mine=true for staff, ignore (staff sees all unless filtered)
    void mine;
  }

  // time range
  if (from || to) {
    filter.start = {};
    if (from) filter.start.$gte = new Date(from);
    if (to)   filter.start.$lte = new Date(to);
  }

  // status
  if (status) {
    const arr = String(status).split(',').map(s => s.trim().toUpperCase());
    filter.status = { $in: arr };
  }

  // quick search
  const ors = [];
  if (q) {
    const rx = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    ors.push({ appointmentId: rx });
  }
  const finalFilter = ors.length ? { $and: [filter, { $or: ors }] } : filter;

  const pageN = Math.max(1, Number(page));
  const limitN = Math.min(100, Math.max(1, Number(limit)));
  const skip = (pageN - 1) * limitN;

  const [items, total] = await Promise.all([
    Appointment.find(finalFilter)
      .sort({ start: -1 })
      .skip(skip)
      .limit(limitN)
      .populate('patient', 'name email role')
      .populate('doctor', 'name email role specialization')
      .lean(),
    Appointment.countDocuments(finalFilter)
  ]);

  return { items, total, page: pageN, limit: limitN };
}

/* --------------------------------- update --------------------------------- */

export async function updateAppointmentService({ requester, idOrKey, patch }) {
  const q = idOrKeyToQuery(idOrKey);
  const appt = await Appointment.findOne(q);
  assert(appt, 'Appointment not found', 404);

  const isOwnerPatient = requester.role === 'PATIENT' && String(appt.patient) === String(requester.id);
  const isOwnerDoctor  = requester.role === 'DOCTOR'  && String(appt.doctor)  === String(requester.id);
  const isStaff        = requester.role === 'STAFF';

  // PATIENT: can modify own PENDING appt (doctor/time/reason)
  if (requester.role === 'PATIENT') {
    assert(isOwnerPatient, 'Forbidden', 403);
    assert(appt.status === 'PENDING', 'Cannot modify a non-pending appointment', 409);

    const { doctorId, start, end, reason } = patch;

    if (doctorId) {
      const doc = await User.findById(doctorId).lean();
      assert(doc && doc.role === 'DOCTOR', 'Doctor not found', 404);
      appt.doctor = doc._id;
      appt.specialization = doc.specialization || appt.specialization;
    }

    if (start || end) {
      assert(start && end, 'Both start and end required when rescheduling');
      const { start: s, end: e } = normalizeSlotRange(start, end);
      // clash check against other active appointments
      await throwIfClash({ doctorId: appt.doctor, start: s, end: e, excludeId: appt._id, patientId: appt.patient });
      appt.start = s;
      appt.end = e;
      appt.rescheduleCount += 1;
    }

    if (typeof reason === 'string') appt.reason = reason;

    appt.updatedBy = requester.id;
  }

  // DOCTOR / STAFF
  if (requester.role === 'DOCTOR' || requester.role === 'STAFF') {
    assert(isOwnerDoctor || isStaff, 'Forbidden', 403);

    // Optional reschedule
    if (patch.doctorId) {
      const doc = await User.findById(patch.doctorId).lean();
      assert(doc && doc.role === 'DOCTOR', 'Doctor not found', 404);
      appt.doctor = doc._id;
      appt.specialization = doc.specialization || appt.specialization;
    }
    if (patch.start || patch.end) {
      assert(patch.start && patch.end, 'Both start and end required when rescheduling');
      const { start: s, end: e } = normalizeSlotRange(patch.start, patch.end);
      await throwIfClash({ doctorId: appt.doctor, start: s, end: e, excludeId: appt._id });
      appt.start = s;
      appt.end = e;
      appt.rescheduleCount += 1;
    }

    // Status transitions
    if (patch.status) {
      const curr = appt.status;
      const next = String(patch.status).toUpperCase();
      const ok =
        (curr === 'PENDING'   && ['CONFIRMED','CANCELLED'].includes(next)) ||
        (curr === 'CONFIRMED' && ['COMPLETED','NO_SHOW','CANCELLED'].includes(next)) ||
        (curr === next); // idempotent
      assert(ok, `Invalid status transition ${curr} → ${next}`);
      appt.status = next;
    }

    appt.updatedBy = requester.id;
  }

  // Decide notification action
  let actionForNotify = 'UPDATED';
  const changedTimeOrDoctor = !!(patch.start || patch.end || patch.doctorId);
  if (changedTimeOrDoctor) actionForNotify = 'RESCHEDULED';
  if (patch.status) actionForNotify = 'STATUS_CHANGED';

  try {
    const saved = await appt.save();
    const populated = await saved.populate([
      { path: 'patient', select: 'name email role' },
      { path: 'doctor',  select: 'name email role specialization' }
    ]);

    await notifyAppointment({
      action: actionForNotify,
      appointment: populated,
      actor: { id: requester.id, role: requester.role, email: requester.email }
    });

    return populated;
  } catch (e) {
    if (e.code === 11000) {
      const err = new Error('Selected time slot is already booked');
      err.status = 409; throw err;
    }
    throw e;
  }
}

/* --------------------------------- cancel --------------------------------- */

export async function cancelAppointmentService({ requester, idOrKey }) {
  const q = idOrKeyToQuery(idOrKey);
  const appt = await Appointment.findOne(q);
  assert(appt, 'Appointment not found', 404);

  const isOwnerPatient = requester.role === 'PATIENT' && String(appt.patient) === String(requester.id);
  const isOwnerDoctor  = requester.role === 'DOCTOR'  && String(appt.doctor)  === String(requester.id);
  const isStaff        = requester.role === 'STAFF';

  if (requester.role === 'PATIENT') {
    assert(isOwnerPatient, 'Forbidden', 403);
    assert(appt.status === 'PENDING', 'Only pending appointments can be cancelled by patient', 409);
  } else if (requester.role === 'DOCTOR') {
    assert(isOwnerDoctor || isStaff, 'Forbidden', 403);
  }
  // staff can always cancel

  appt.status = 'CANCELLED';
  appt.updatedBy = requester.id;

  const saved = await appt.save();
  const populated = await saved.populate([
    { path: 'patient', select: 'name email role' },
    { path: 'doctor',  select: 'name email role specialization' }
  ]);

  await notifyAppointment({
    action: 'CANCELLED',
    appointment: populated,
    actor: { id: requester.id, role: requester.role, email: requester.email }
  });

  return populated;
}
