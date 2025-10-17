// src/routes/patient.routes.js
import { Router } from 'express';
import auth from '../middleware/auth.js';
import permit from '../middleware/rbac.js';
import validate from '../middleware/validate.js';
import { validatePayload, updatePayload } from '../validators/patientSchemas.js';
import * as ctrl from '../controllers/patient.controller.js';

const r = Router();

// Search/list (optional q param)
r.get('/', auth, permit('DOCTOR', 'STAFF'), ctrl.list);

// Get by Mongo _id OR by patientId (same param)
r.get('/:id', auth, permit('DOCTOR', 'STAFF'), ctrl.getOne);

// Pre-check for duplicates + field-level validation
r.post('/validate', auth, permit('DOCTOR', 'STAFF'), validate(validatePayload), ctrl.validateNew);

// Create patient
r.post('/', auth, permit('DOCTOR', 'STAFF'), validate(validatePayload), ctrl.create);

// Update partial (for “Update existing record” path)
r.patch('/:id', auth, permit('DOCTOR', 'STAFF'), validate(updatePayload), ctrl.update);

export default r;
