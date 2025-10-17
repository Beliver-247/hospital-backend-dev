// src/services/patient.service.js
import mongoose from 'mongoose';
import Patient from '../models/Patient.js';
import { findDuplicates } from './duplicate.service.js';
import { nextPatientId } from './id.service.js';

export async function validateNew(data) {
  const fieldErrors = [];
  if (data.personal.age) {
    const dobYear = new Date(data.personal.dob).getFullYear();
    const ageApprox = new Date().getFullYear() - dobYear;
    if (Math.abs(ageApprox - data.personal.age) > 2) {
      fieldErrors.push({ path: 'personal.age', msg: 'Age does not match DOB approximately' });
    }
  }
  const dups = await findDuplicates({
    nic: data.personal.nic,
    passport: data.personal.passport,
    email: data.contact.email,
    phone: data.contact.phone,
    firstName: data.personal.firstName,
    lastName: data.personal.lastName,
    dob: data.personal.dob
  });
  return { fieldErrors, duplicates: dups };
}

export async function create(data, user) {
  if (data.submissionId) {
    const existing = await Patient.findOne({ 'meta.submissionId': data.submissionId }).lean();
    if (existing) return { patient: existing, created: false };
  }
  const patientId = await nextPatientId();
  const doc = await Patient.create({
    patientId,
    personal: data.personal,
    contact: data.contact,
    medical: data.medical,
    documents: data.documents || [],
    createdBy: { userId: user.id, role: user.role },
    meta: { submissionId: data.submissionId || null }
  });
  return { patient: doc.toObject(), created: true };
}

// -------- NEW --------
export async function getOne(idOrPid) {
  const isObjId = mongoose.isValidObjectId(idOrPid);
  const query = isObjId ? { _id: idOrPid } : { patientId: idOrPid };
  const doc = await Patient.findOne(query).lean();
  return doc;
}

export async function list({ q, limit = 20 }) {
  // simple search over name/email/phone/nic/passport
  const or = [];
  if (q) {
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    or.push(
      { 'personal.firstName': re },
      { 'personal.lastName': re },
      { 'contact.email': re },
      { 'contact.phone': re },
      { 'personal.nic': re },
      { 'personal.passport': re },
      { patientId: re }
    );
  }
  const filter = or.length ? { $or: or } : {};
  const docs = await Patient.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
  return docs;
}

export async function update(idOrPid, patch) {
  const isObjId = mongoose.isValidObjectId(idOrPid);
  const query = isObjId ? { _id: idOrPid } : { patientId: idOrPid };

  // Build $set only for provided fields
  const $set = {};
  if (patch.personal) $set['personal'] = patch.personal;
  if (patch.contact) $set['contact'] = patch.contact;
  if (patch.medical) $set['medical'] = patch.medical;
  if (patch.documents) $set['documents'] = patch.documents;

  const updated = await Patient.findOneAndUpdate(query, { $set }, { new: true }).lean();
  return updated;
}
