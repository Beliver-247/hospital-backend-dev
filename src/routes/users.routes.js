// src/routes/users.routes.js
import { Router } from 'express';
import auth from '../middleware/auth.js';
import permit from '../middleware/rbac.js';
import User from '../models/User.js';

const router = Router();

function escRx(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

router.get('/', auth, permit('PATIENT','DOCTOR','STAFF'), async (req, res, next) => {
  try {
    let { role, doctorType, specialization, q, limit = 100 } = req.query;

    const lim = Math.min(200, Math.max(1, Number(limit)));
    const typeRaw = (doctorType ?? specialization ?? '').toString().trim();

    const and = [];

    // role
    if (role) and.push({ role: String(role).toUpperCase() });
    else if (typeRaw) and.push({ role: 'DOCTOR' }); // default to doctors if a type is provided

    // Accept either doctorType OR specialization from DB (legacy + new)
    if (typeRaw) {
      const esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      and.push({
        $or: [
          { doctorType: typeRaw },
          { doctorType: { $regex: esc(typeRaw), $options: 'i' } },
          { specialization: typeRaw },
          { specialization: { $regex: esc(typeRaw), $options: 'i' } },
        ],
      });
    }

    // q search (name/email)
    if (q && String(q).trim()) {
      const rx = new RegExp(String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      and.push({ $or: [{ name: rx }, { email: rx }] });
    }

    const filter = and.length ? { $and: and } : {};

    const users = await User.find(filter)
      .select('_id name email role doctorType specialization')
      .sort({ name: 1 })
      .limit(lim)
      .lean();

    res.json({
      items: users.map(u => ({
        _id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        doctorType: u.doctorType ?? u.specialization ?? null, // expose unified field
      })),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
