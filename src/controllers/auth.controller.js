import * as authService from '../services/auth.service.js';

export async function login(req, res) {
  const result = await authService.login(req.body);
  if (!result) return res.status(401).json({ message: 'Invalid credentials' });
  res.json(result);
}
