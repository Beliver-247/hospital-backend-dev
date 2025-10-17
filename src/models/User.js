import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['DOCTOR', 'STAFF', 'PATIENT'], required: true },
    name: { type: String, default: '' },
    // NEW FIELD ↓
    doctorType: {
      type: String,
      enum: [
        'Cardiologist',
        'Pediatric',
        'Dermatologist',
        'Orthopedic',
        'Neurologist',
        'Opthalmologist',
        'Outpatient Department (OPD)'
      ],
      default: null
    }
  },
  { timestamps: true }
);

// Speed up doctor filtering & name search
UserSchema.index({ role: 1, doctorType: 1 });       // new field
UserSchema.index({ role: 1, specialization: 1 });   // legacy field (if older docs used this)
UserSchema.index({ name: 1, email: 1 });

export default mongoose.model('User', UserSchema);
