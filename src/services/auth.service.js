import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import env from '../config/env.js';

export async function login({ email, password }) {
  const user = await User.findOne({ email }).lean();
  if (!user) return null;

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;

  const token = jwt.sign({ sub: user._id, role: user.role, email: user.email }, env.jwtSecret, {
    expiresIn: '8h'
  });

  return {
    token,
    user: { id: String(user._id), email: user.email, role: user.role, name: user.name }
  };
}
