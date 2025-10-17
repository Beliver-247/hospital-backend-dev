import 'dotenv/config';

const required = ['ATLAS_URI', 'JWT_SECRET'];
for (const k of required) {
  if (!process.env[k]) throw new Error(`Missing env var: ${k}`);
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  atlasUri: process.env.ATLAS_URI,
  jwtSecret: process.env.JWT_SECRET,
  // new (with sane defaults)
  apptSlotMinutes: Number(process.env.APPT_SLOT_MINUTES || 30),
  apptWorkStart: process.env.APPT_WORK_START || "09:00",
  apptWorkEnd: process.env.APPT_WORK_END || "17:00",
  blockPatientOverlap:
  String(process.env.APPT_BLOCK_PATIENT_OVERLAP || "true") === "true",
  notifyEnabled: String(process.env.NOTIFY_ENABLED || "false") === "true",
  notifyDriver: process.env.NOTIFY_DRIVER || "console", // future: 'smtp', 'twilio', etc.
};

export default env;
