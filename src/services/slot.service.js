import env from '../config/env.js';
import Appointment from '../models/Appointment.js';
import User from '../models/User.js';

function parseHm(hm) {
  const [h, m] = hm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) throw Object.assign(new Error('Bad HH:MM'), { status: 500 });
  return { h, m };
}

function toLocalDate(dateYMD, h, m) {
  // Create a Date at local server time for given Y-M-D and H:M, then derive UTC ISO
  const d = new Date(`${dateYMD}T00:00:00`);
  d.setHours(h, m, 0, 0);
  return d;
}

function* iterateSlots(dayStart, dayEnd, stepMinutes) {
  const stepMs = stepMinutes * 60 * 1000;
  for (let t = dayStart.getTime(); t + stepMs <= dayEnd.getTime(); t += stepMs) {
    yield { start: new Date(t), end: new Date(t + stepMs) };
  }
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

export async function getDoctorSlots({ doctorId, dateYMD, slotMinutes }) {
  // Verify doctor
  const doctor = await User.findById(doctorId).lean();
  if (!doctor || doctor.role !== 'DOCTOR') {
    const err = new Error('Doctor not found'); err.status = 404; throw err;
  }

  const step = Number(slotMinutes || env.apptSlotMinutes || 30);
  if (step <= 0 || step > 240) { const err = new Error('Invalid slotMinutes'); err.status = 400; throw err; }

  const { h: sh, m: sm } = parseHm(env.apptWorkStart || '09:00');
  const { h: eh, m: em } = parseHm(env.apptWorkEnd || '17:00');

  const dayStartLocal = toLocalDate(dateYMD, sh, sm);
  const dayEndLocal   = toLocalDate(dateYMD, eh, em);
  if (!(dayEndLocal > dayStartLocal)) { const err = new Error('Work hours misconfigured'); err.status = 500; throw err; }

  const dayStartUTC = new Date(dayStartLocal.toISOString());
  const dayEndUTC   = new Date(dayEndLocal.toISOString());

  // Busy = any active appt overlapping this window
  const busy = await Appointment.find({
    doctor: doctor._id,
    status: { $in: ['PENDING','CONFIRMED'] },
    start: { $lt: dayEndUTC },
    end:   { $gt: dayStartUTC }
  }).select('start end').lean();

  const slots = [];
  for (const s of iterateSlots(dayStartUTC, dayEndUTC, step)) {
    const clash = busy.some(b => overlaps(s.start, s.end, b.start, b.end));
    slots.push({
      start: s.start.toISOString(),
      end: s.end.toISOString(),
      available: !clash
    });
  }

  return { date: dateYMD, slotMinutes: step, slots };
}

// ⬇️ add near the top or bottom of slot.service.js
export function normalizeSlotRange(startISO, endISO) {
  const start = new Date(startISO);
  const end = new Date(endISO);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    const err = new Error('Invalid start/end');
    err.status = 400; throw err;
  }
  if (end <= start) {
    const err = new Error('end must be after start');
    err.status = 400; throw err;
  }
  return { start, end };
}
