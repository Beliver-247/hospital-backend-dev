import Joi from "joi";
import mongoose from "mongoose";

const objectId = () =>
  Joi.string().custom(
    (v, helpers) =>
      mongoose.Types.ObjectId.isValid(v) ? v : helpers.error("any.invalid"),
    "ObjectId"
  );

export const listAppointmentsSchema = Joi.object({
  mine: Joi.string().valid("true", "false"),
  doctorId: objectId(),
  patientId: objectId(),
  from: Joi.date().iso(),
  to: Joi.date().iso(),
  status: Joi.string(), // comma-separated
  q: Joi.string(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

export const createAppointmentSchema = Joi.object({
  doctorId: objectId().required(),
  start: Joi.date().iso().required(),
  end: Joi.date().iso().greater(Joi.ref("start")).required(),
  reason: Joi.string().max(500).allow("").optional(),
  submissionId: Joi.string().guid({ version: "uuidv4" }).optional(),
});

export const updateAppointmentSchema = Joi.object({
  doctorId: objectId(),
  start: Joi.date().iso(),
  end: Joi.date()
    .iso()
    .when("start", { is: Joi.exist(), then: Joi.required() }),
  reason: Joi.string().max(500),
  status: Joi.string().valid(
    "PENDING",
    "CONFIRMED",
    "CANCELLED",
    "COMPLETED",
    "NO_SHOW"
  ),
}).min(1);
