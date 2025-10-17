// src/controllers/patient.controller.js
import * as patientService from '../services/patient.service.js';
import asyncHandler from '../utils/asyncHandler.js';

export const validateNew = asyncHandler(async (req, res) => {
  const { fieldErrors, duplicates } = await patientService.validateNew(req.body);
  res.json({ fieldErrors, duplicates });
});

export const create = asyncHandler(async (req, res) => {
  const { patient, created } = await patientService.create(req.body, req.user);
  if (!created) return res.status(200).json({ message: 'Already created', patientId: patient.patientId, patient });
  return res.status(201).json({ patientId: patient.patientId, patient });
});

// -------- NEW --------
export const getOne = asyncHandler(async (req, res) => {
  const doc = await patientService.getOne(req.params.id);
  if (!doc) return res.status(404).json({ message: 'Patient not found' });
  res.json(doc);
});

export const list = asyncHandler(async (req, res) => {
  const docs = await patientService.list({ q: req.query.q, limit: Number(req.query.limit || 20) });
  res.json({ items: docs });
});

export const update = asyncHandler(async (req, res) => {
  const doc = await patientService.update(req.params.id, req.body);
  if (!doc) return res.status(404).json({ message: 'Patient not found' });
  res.json({ message: 'Updated', patient: doc });
});
