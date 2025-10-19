// src/models/payments/PaymentType.js
import mongoose from 'mongoose';

const PaymentTypeSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['card', 'cash', 'insurance'],
    required: true
  },
  description: {
    type: String,
    default: ''
  }
}, { timestamps: true });

export default mongoose.model('PaymentType', PaymentTypeSchema);