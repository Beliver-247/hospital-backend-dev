import * as svc from '../services/doctor.service.js';

export async function create(req, res) {
  const result = await svc.createDoctor(req.body);
  if (!result.ok && result.reason === 'email_exists') {
    return res.status(409).json({ message: 'Email already exists' });
  }
  return res.status(201).json({ user: result.user });
}

export async function remove(req, res) {
  const { id } = req.params;
  const { deletedCount } = await svc.deleteDoctor(id);
  if (!deletedCount) return res.status(404).json({ message: 'Doctor not found' });
  return res.json({ message: 'Doctor deleted' });
}

// optional list (useful for UI)
export async function list(req, res) {
  const items = await svc.listDoctors({ q: req.query.q, limit: Number(req.query.limit || 50) });
  return res.json({ items });
}
