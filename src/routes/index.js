// src/routes/index.js
import { Router } from 'express';
import authRoutes from './auth.routes.js';
import patientRoutes from './patient.routes.js';
import uploadRoutes from './upload.routes.js';
import reportRoutes from './report.routes.js';
import appointmentRoutes from './appointment.routes.js';
import doctorRoutes from './doctor.routes.js'; 
import usersRoutes from './users.routes.js';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ ok: true, service: 'hospital-backend', ts: new Date().toISOString() });
});

router.use('/auth', authRoutes);
router.use('/patients', patientRoutes);
router.use('/uploads', uploadRoutes); // <-- add this
router.use('/reports', reportRoutes); 
router.use('/appointments', appointmentRoutes);
router.use('/doctors', doctorRoutes);  
router.use('/users', usersRoutes); // <— add this

export default router;
