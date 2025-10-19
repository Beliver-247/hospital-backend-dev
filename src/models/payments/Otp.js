import mongoose from 'mongoose';

const OtpSchema = new mongoose.Schema(
  {
    purpose: { type: String, enum: ['PAYMENT'], required: true },
    codeHash: { type: String, required: true },
    target: { type: String, required: true }, // email or phone
    meta: { type: Object, default: {} }, // e.g., card last4, amount
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

OtpSchema.index({ purpose: 1, target: 1, expiresAt: 1 });

export default mongoose.model('Otp', OtpSchema);
