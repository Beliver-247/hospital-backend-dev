import Patient from '../models/Patient.js';

function escapeRegex(s = '') { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

export async function findDuplicates({ nic, passport, email, phone, firstName, lastName, dob }) {
  const or = [];
  if (nic) or.push({ 'personal.nic': nic });
  if (passport) or.push({ 'personal.passport': passport });
  if (email) or.push({ 'contact.email': email });
  if (phone) or.push({ 'contact.phone': phone });
  if (firstName && lastName && dob) {
    or.push({
      $and: [
        { 'personal.dob': dob },
        { 'personal.firstName': new RegExp(`^${escapeRegex(firstName)}`, 'i') },
        { 'personal.lastName': new RegExp(`^${escapeRegex(lastName)}`, 'i') }
      ]
    });
  }
  if (!or.length) return [];
  return Patient.find({ $or: or }).limit(5).lean();
}
