import bcrypt from 'bcryptjs';
import User from '../models/User.js';

export async function createDoctor({ email, password, name, doctorType }) {
  const existing = await User.findOne({ email }).lean();
  if (existing) return { ok: false, reason: 'email_exists' };

  const passwordHash = await bcrypt.hash(password, 10);
  const doc = await User.create({
    email,
    passwordHash,
    role: 'DOCTOR',
    name,
    doctorType
  });

  return {
    ok: true,
    user: {
      id: String(doc._id),
      email: doc.email,
      role: doc.role,
      name: doc.name,
      doctorType: doc.doctorType
    }
  };
}


export async function deleteDoctor(id) {
  const res = await User.deleteOne({ _id: id, role: 'DOCTOR' });
  return { deletedCount: res.deletedCount || 0 };
}

// optional helpers if you want a table of doctors in UI
export async function listDoctors({ q, limit = 50 }) {
  const filter = { role: 'DOCTOR' };
  if (q) {
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    Object.assign(filter, { $or: [{ email: re }, { name: re }] });
  }
  const docs = await User.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
  return docs.map(d => ({
  id: String(d._id),
  email: d.email,
  name: d.name,
  role: d.role,
  doctorType: d.doctorType
}));

}
