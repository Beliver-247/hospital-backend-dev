import mongoose from 'mongoose';
import PaymentTypeModel from './PaymentType.js';

// CustomerPayment breakdown (consultation, labs, etc.)
export const CustomerPaymentSchema = new mongoose.Schema(
  {
    consultationFee: { type: Number, default: 0 },
    labTests: { type: Number, default: 0 },
    prescription: { type: Number, default: 0 },
    processingFee: { type: Number, default: 0 },
    other: { type: Number, default: 0 }
  },
  { _id: false }
);

const PaymentBaseSchema = new mongoose.Schema(
  {
  paymentType: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentType', required: true },
    status: {
      type: String,
      enum: ['PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED', 'CANCELLED'],
      default: 'PENDING'
    },
    currency: { type: String, default: 'LKR' },
    totalAmount: { type: Number, required: true },
    breakdown: { type: CustomerPaymentSchema, required: true },
    // Link to authenticated user and patient record
    customer: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: false }
    },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
    notes: { type: String, default: '' },
    createdBy: { id: String, role: String, email: String }
  },
  { timestamps: true, discriminatorKey: 'method' }
);

export const PaymentModel = mongoose.model('Payment', PaymentBaseSchema);

export default PaymentModel;
