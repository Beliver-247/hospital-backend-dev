// src/validators/patientSchemas.js
import Joi from 'joi';

const personalSchema = Joi.object({
  firstName: Joi.string().trim().required(),
  lastName: Joi.string().trim().required(),
  dob: Joi.string().isoDate().required(),
  age: Joi.number().integer().min(0).max(150).allow(null),
  gender: Joi.string().valid('MALE', 'FEMALE', 'OTHER').required(),
  nic: Joi.string().allow(null, ''),
  passport: Joi.string().allow(null, '')
});

const contactSchema = Joi.object({
  address: Joi.string().allow('', null),
  phone: Joi.string().pattern(/^\+?[0-9]{7,15}$/).allow(null, ''),
  email: Joi.string().email().allow(null, '')
});

const medicalSchema = Joi.object({
  history: Joi.string().allow('', null),
  allergies: Joi.array().items(Joi.string()).default([]),
  conditions: Joi.array().items(Joi.string()).default([])
});

export const validatePayload = Joi.object({
  personal: personalSchema.required(),
  contact: contactSchema.required(),
  medical: medicalSchema.required(),
  documents: Joi.array().items(
    Joi.object({
      type: Joi.string().valid('ID', 'REPORT').required(),
      url: Joi.string().uri().required()
    })
  ).default([]),
  submissionId: Joi.string().uuid().optional()
});

// NEW: partial update schema
export const updatePayload = Joi.object({
  personal: personalSchema.fork(Object.keys(personalSchema.describe().keys), (s) => s.optional()),
  contact: contactSchema.fork(Object.keys(contactSchema.describe().keys), (s) => s.optional()),
  medical: medicalSchema.fork(Object.keys(medicalSchema.describe().keys), (s) => s.optional()),
  documents: Joi.array().items(
    Joi.object({
      type: Joi.string().valid('ID', 'REPORT').required(),
      url: Joi.string().uri().required()
    })
  ),
}).min(1); // must send at least one field
