import { Router } from 'express';
import auth from '../middleware/auth.js';
import permit from '../middleware/rbac.js';
import validate from '../middleware/validate.js';
import { createDoctorSchema } from '../validators/doctorSchemas.js';
import * as ctrl from '../controllers/doctor.controller.js';

const r = Router();

// Only STAFF can manage doctors
r.get('/', auth, permit('STAFF'), ctrl.list);                // optional
r.post('/', auth, permit('STAFF'), validate(createDoctorSchema), ctrl.create);
r.delete('/:id', auth, permit('STAFF'), ctrl.remove);

export default r;
