import mongoose from 'mongoose';
import { PaymentModel } from './Payment.js';

const CardDetailsSchema = new mongoose.Schema(
  {
    last4: { type: String, required: true },
    brand: { type: String, required: true },
    // Store only tokenized or masked data in DB. No raw PAN/CVV.
    token: { type: String, required: true }
  },
  { _id: false }
);

const CardPaymentSchema = new mongoose.Schema(
  {
    card: { type: CardDetailsSchema, required: true },
    otpRefId: { type: mongoose.Schema.Types.ObjectId, ref: 'Otp', required: true },
    authorizedAt: { type: Date },
    capturedAt: { type: Date }
  },
  { _id: false }
);

export const CardPaymentModel = PaymentModel.discriminator('CARD', CardPaymentSchema);

export default CardPaymentModel;
