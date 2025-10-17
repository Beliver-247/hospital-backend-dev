import { Router } from 'express';
import auth from '../middleware/auth.js';
import permit from '../middleware/rbac.js';
import validate from '../middleware/validate.js';
import { createAppointmentSchema, updateAppointmentSchema } from '../validators/appointmentSchemas.js';
import * as ctrl from '../controllers/appointment.controller.js';

const router = Router();

router.use(auth);
router.get('/slots', permit('PATIENT','DOCTOR','STAFF'), ctrl.getSlots);
router.post('/', permit('PATIENT'), validate(createAppointmentSchema), ctrl.createAppointment);
router.get('/', permit('PATIENT','DOCTOR','STAFF'), /* optionally: validate(listAppointmentsSchema), */ ctrl.listAppointments);
router.get('/:id', permit('PATIENT','DOCTOR','STAFF'), ctrl.getAppointment);
router.patch('/:id', permit('PATIENT','DOCTOR','STAFF'), validate(updateAppointmentSchema), ctrl.updateAppointment);
router.delete('/:id', permit('PATIENT','DOCTOR','STAFF'), ctrl.cancelAppointment);

export default router;
