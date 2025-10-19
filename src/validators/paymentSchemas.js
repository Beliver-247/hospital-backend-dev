import Joi from 'joi';
import mongoose from 'mongoose';

const objectId = () =>
  Joi.string().custom(
    (v, helpers) => (mongoose.Types.ObjectId.isValid(v) ? v : helpers.error('any.invalid')),
    'ObjectId'
  );

export const breakdownSchema = Joi.object({
  consultationFee: Joi.number().min(0).required(),
  labTests: Joi.number().min(0).required(),
  prescription: Joi.number().min(0).required(),
  processingFee: Joi.number().min(0).required(),
  other: Joi.number().min(0).default(0)
});

export const initiateCardPaymentSchema = Joi.object({
  breakdown: breakdownSchema.required(),
  currency: Joi.string().default('LKR'),
  // raw card input only for initiating OTP, not persisted directly
  card: Joi.object({
    number: Joi.string().creditCard().required(),
    expMonth: Joi.number().integer().min(1).max(12).required(),
    expYear: Joi.number().integer().min(new Date().getFullYear()).max(2100).required(),
    cvc: Joi.string().pattern(/^\d{3,4}$/).required(),
    name: Joi.string().required(),
    brand: Joi.string().required()
  }).required(),
  // patientId and doctorId are derived server-side
  patientId: objectId().optional(),
  doctorId: objectId().optional(),
  notes: Joi.string().allow('').max(500).optional()
});

export const confirmCardPaymentSchema = Joi.object({
  otpCode: Joi.string().length(6).pattern(/^\d{6}$/).required(),
  otpRefId: objectId().required()
});

export const updatePaymentSchema = Joi.object({
  notes: Joi.string().allow('').max(500),
  status: Joi.string().valid('CANCELLED', 'REFUNDED')
});

export const listPaymentsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  method: Joi.string().valid('CARD', 'CASH', 'INSURANCE'),
  status: Joi.string(),
  from: Joi.date().iso(),
  to: Joi.date().iso()
});
