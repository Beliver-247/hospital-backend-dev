import bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';
import Otp from '../../models/payments/Otp.js';

const OTP_TTL_MIN = Number(process.env.OTP_TTL_MIN || 5);

export async function generatePaymentOtp({ target, meta }) {
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const codeHash = await bcrypt.hash(code, 8);
  const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60 * 1000);
  const otp = await Otp.create({ purpose: 'PAYMENT', codeHash, target, meta, expiresAt });

  // Always return the plain OTP to the caller service so it can be delivered via email/SMS.
  // The API response can still choose to hide this (handled in cardPayment.service.js).
  return { otpRefId: String(otp._id), code, expiresAt: otp.expiresAt };
}

export async function verifyPaymentOtp({ otpRefId, code }) {
  const otp = await Otp.findById(otpRefId);
  if (!otp || otp.purpose !== 'PAYMENT') return { ok: false, reason: 'NOT_FOUND' };
  if (otp.consumedAt) return { ok: false, reason: 'ALREADY_USED' };
  if (otp.expiresAt.getTime() < Date.now()) return { ok: false, reason: 'EXPIRED' };

  const ok = await bcrypt.compare(code, otp.codeHash);
  if (!ok) return { ok: false, reason: 'INVALID' };

  otp.consumedAt = new Date();
  await otp.save();
  return { ok: true, otp };
}
