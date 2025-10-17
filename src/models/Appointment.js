// src/models/Appointment.js
import mongoose from 'mongoose';
const { Schema } = mongoose;

const AppointmentSchema = new Schema({
  appointmentId: { type: String, unique: true, index: true },
  patient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  doctor:  { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  specialization: { type: String },                 // denormalized from doctor
  reason: { type: String, maxlength: 500 },
  start:  { type: Date, required: true, index: true },
  end:    { type: Date, required: true },
  durationMinutes: { type: Number },                // optional denorm: end-start
  location: { type: String },                       // optional: room/clinic
  status: { type: String,
            enum: ['PENDING','CONFIRMED','CANCELLED','COMPLETED','NO_SHOW'],
            default: 'PENDING',
            index: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  submissionId: { type: String, index: true },
  rescheduleCount: { type: Number, default: 0 }
}, { timestamps: true });

AppointmentSchema.index(
  { doctor: 1, start: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['PENDING','CONFIRMED'] } } }
);

AppointmentSchema.pre('save', function(next) {
  if (this.start && this.end) {
    this.durationMinutes = Math.max(0, Math.round((this.end - this.start) / 60000));
  }
  next();
});

export default mongoose.model('Appointment', AppointmentSchema);
