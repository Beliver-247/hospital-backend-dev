import { Router } from 'express';
import validate from '../middleware/validate.js';
import { loginSchema } from '../validators/authSchemas.js';
import * as ctrl from '../controllers/auth.controller.js';

const r = Router();

r.post('/login', validate(loginSchema), ctrl.login);

export default r;
