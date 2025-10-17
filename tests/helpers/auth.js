import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../../src/models/User.js';
import env from '../../src/config/env.js';

export async function createUser({ email, role, password = 'secret', name = '' }) {
  const passwordHash = await bcrypt.hash(password, 10);
  return User.create({ email, passwordHash, role, name });
}

export function issueToken(userDoc) {
  return jwt.sign({ sub: userDoc._id, role: userDoc.role, email: userDoc.email }, env.jwtSecret, {
    expiresIn: '8h'
  });
}
