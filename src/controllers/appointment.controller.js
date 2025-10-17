import asyncHandler from "../utils/asyncHandler.js";
import * as svc from "../services/appointment.service.js";
import { getDoctorSlots } from "../services/slot.service.js";

export const createAppointment = asyncHandler(async (req, res) => {
  if (req.user.role !== "PATIENT")
    return res.status(403).json({ message: "Forbidden" });

  const { doctorId, start, end, reason, submissionId } = req.body;
  const appt = await svc.createAppointment({
    patientUser: req.user,
    doctorId,
    startISO: start,
    endISO: end,
    reason,
    submissionId,
  });
  res.status(201).json({ appointment: appt });
});

export const getAppointment = asyncHandler(async (req, res) => {
  const appt = await svc.getAppointmentByIdOrKey(req.params.id, req.user);
  res.json({ appointment: appt });
});

export const listAppointments = asyncHandler(async (req, res) => {
  const data = await svc.listAppointmentsService({ requester: req.user, query: req.query });
  res.json(data);
});

export const getSlots = asyncHandler(async (req, res) => {
  const { doctorId, date, slotMinutes } = req.query;
  if (!doctorId || !date) {
    console.error('getSlots missing query:', req.query); // 1-line debug
    return res.status(400).json({ message: 'doctorId and date are required' });
  }
  const data = await getDoctorSlots({ doctorId, dateYMD: date, slotMinutes });
  res.json(data);
});

export const updateAppointment = asyncHandler(async (req, res) => {
  const updated = await svc.updateAppointmentService({
    requester: req.user,
    idOrKey: req.params.id,
    patch: req.body
  });
  res.json({ appointment: updated });
});

export const cancelAppointment = asyncHandler(async (req, res) => {
  const appt = await svc.cancelAppointmentService({ requester: req.user, idOrKey: req.params.id });
  res.json({ appointment: appt, message: 'Cancelled' });
});
