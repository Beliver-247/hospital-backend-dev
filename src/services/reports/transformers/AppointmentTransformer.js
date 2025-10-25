// src/services/reports/transformers/AppointmentTransformer.js
import { BaseTransformer } from './BaseTransformer.js';

export class AppointmentTransformer extends BaseTransformer {
  transform(appointment, includePatientDetails = false) {
    const transformed = {
      appointmentId: appointment.appointmentId,
      patient: {
        id: appointment.patient?._id,
        name: appointment.patient ? 
          `${appointment.patient.personal?.firstName || ''} ${appointment.patient.personal?.lastName || ''}`.trim() : 
          'Unknown Patient',
        gender: appointment.patient?.personal?.gender,
        phone: appointment.patient?.contact?.phone
      },
      doctor: {
        id: appointment.doctor?._id,
        name: appointment.doctor ? 
          `${appointment.doctor.personal?.firstName || ''} ${appointment.doctor.personal?.lastName || ''}`.trim() : 
          'Unknown Doctor',
        specialization: appointment.doctor?.specialization || appointment.specialization
      },
      specialization: appointment.specialization,
      reason: appointment.reason,
      start: appointment.start,
      end: appointment.end,
      durationMinutes: appointment.durationMinutes,
      location: appointment.location,
      status: appointment.status,
      rescheduleCount: appointment.rescheduleCount,
      createdAt: appointment.createdAt,
      updatedAt: appointment.updatedAt
    };

    if (includePatientDetails && appointment.patient) {
      transformed.patient.details = {
        email: appointment.patient.contact?.email,
        address: appointment.patient.contact?.address
      };
    }

    return transformed;
  }
}