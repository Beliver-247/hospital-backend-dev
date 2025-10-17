import mongoose from 'mongoose';

const DocumentSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['ID', 'REPORT'], required: true },
    url: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const PatientSchema = new mongoose.Schema(
  {
    patientId: { type: String }, // we'll generate this; no index per your request
    personal: {
      firstName: { type: String, required: true },
      lastName: { type: String, required: true },
      dob: { type: String, required: true }, // ISO string
      age: { type: Number },
      gender: { type: String, enum: ['MALE', 'FEMALE', 'OTHER'], required: true },
      nic: { type: String, default: null },
      passport: { type: String, default: null }
    },
    contact: {
      address: { type: String, default: '' },
      phone: { type: String, default: null },
      email: { type: String, default: null }
    },
    medical: {
      history: { type: String, default: '' },
      allergies: { type: [String], default: [] },
      conditions: { type: [String], default: [] }
    },
    documents: { type: [DocumentSchema], default: [] },
    createdBy: { userId: String, role: String },
    meta: {
      submissionId: { type: String, default: null } // for idempotency
    }
  },
  { timestamps: true }
);

export default mongoose.model('Patient', PatientSchema);
