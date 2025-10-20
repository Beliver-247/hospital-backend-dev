// src/services/reports/generators/AppointmentsListGenerator.js
import { BaseReportGenerator } from '../generators/BaseReportGenerator.js';
import Appointment from '../../../models/Appointment.js';

export class AppointmentsListGenerator extends BaseReportGenerator {
  async getData(filters = {}, options = {}) {
    const {
      status,
      specialization,
      startDate,
      endDate,
      start,
      end,
      doctor,
      location,
      includePatientDetails = false
    } = filters;

    const query = this.buildQuery(filters);

    const appointments = await Appointment.find(query)
      .populate({
        path: 'patient',
        select: 'personal.firstName personal.lastName personal.gender contact.phone contact.email contact.address'
      })
      .populate({
        path: 'doctor', 
        select: 'personal.firstName personal.lastName specialization'
      })
      .sort({ start: -1 });

    return appointments.map(appointment => 
      this.transformer.transform(appointment, includePatientDetails)
    );
  }

  buildQuery(filters = {}) {
    const {
      status,
      specialization,
      startDate,
      endDate,
      start,
      end,
      doctor,
      location
    } = filters;

    const query = {};

    if (status) query.status = status;
    if (specialization) query.specialization = specialization;
    if (doctor) query.doctor = doctor;
    if (location) query.location = { $regex: location, $options: 'i' };

    const actualStart = startDate || start;
    const actualEnd = endDate || end;

    if (actualStart || actualEnd) {
      query.start = {};
      
      if (actualStart) {
        const startDate = new Date(actualStart);
        if (!isNaN(startDate.getTime())) {
          query.start.$gte = startDate;
        }
      }
      
      if (actualEnd) {
        const endDate = new Date(actualEnd);
        if (!isNaN(endDate.getTime())) {
          endDate.setHours(23, 59, 59, 999);
          query.start.$lte = endDate;
        }
      }
    }

    return query;
  }

  formatData(data, format = 'json') {
    switch (format) {
      case 'csv':
        return this.toCSV(data);
      default:
        return {
          reportType: 'appointments_list',
          generatedAt: new Date().toISOString(),
          totalAppointments: data.length,
          data: data
        };
    }
  }

  toCSV(appointments) {
    if (appointments.length === 0) return '';

    const headers = [
      'Appointment ID', 'Patient Name', 'Doctor Name', 'Specialization', 
      'Reason', 'Start Time', 'End Time', 'Duration (min)', 
      'Location', 'Status', 'Reschedule Count', 'Created At'
    ];
    
    const rows = appointments.map(appointment => [
      appointment.appointmentId || '',
      appointment.patient.name || '',
      appointment.doctor.name || '',
      appointment.specialization || '',
      appointment.reason || '',
      appointment.start ? appointment.start.toISOString() : '',
      appointment.end ? appointment.end.toISOString() : '',
      appointment.durationMinutes || '',
      appointment.location || '',
      appointment.status || '',
      appointment.rescheduleCount || '',
      appointment.createdAt ? appointment.createdAt.toISOString() : ''
    ]);

    return [headers.join(','), ...rows.map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))].join('\n');
  }

  async generate(filters = {}, options = {}) {
    const data = await this.getData(filters, options);
    return this.formatData(data, options.format);
  }
}