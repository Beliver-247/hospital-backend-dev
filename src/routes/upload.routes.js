// src/routes/upload.routes.js
import { Router } from 'express';
import auth from '../middleware/auth.js';
import permit from '../middleware/rbac.js';
import { upload } from '../middleware/upload.js';
import * as ctrl from '../controllers/upload.controller.js';

const r = Router();

// multipart/form-data with field name "file"
// optional body field "type" = ID | REPORT
r.post('/', auth, permit('DOCTOR', 'STAFF'), upload.single('file'), ctrl.uploadSingle);

export default r;
