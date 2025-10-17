import Joi from 'joi';

export const createDoctorSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  name: Joi.string().trim().min(1).required(),
  doctorType: Joi.string()
    .valid(
      'Cardiologist',
      'Pediatric',
      'Dermatologist',
      'Orthopedic',
      'Neurologist',
      'Opthalmologist',
      'Outpatient Department (OPD)'
    )
    .required()
});

