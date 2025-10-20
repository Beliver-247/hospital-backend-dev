// src/services/reports/generators/AppointmentsStatsGenerator.js
import { BaseReportGenerator } from './BaseReportGenerator.js';
import Appointment from '../../../models/Appointment.js';

export class AppointmentsStatsGenerator extends BaseReportGenerator {
  async generate(filters = {}, options = {}) {
    const { startDate, endDate, specialization } = filters;

    const dateFilter = this.buildQuery(filters);

    const totalAppointments = await Appointment.countDocuments(dateFilter);

    const statusStats = await Appointment.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const specializationStats = await Appointment.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$specialization', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    return {
      reportType: 'appointments_stats',
      generatedAt: new Date().toISOString(),
      totalAppointments,
      dateRange: { start: startDate, end: endDate },
      statusStats: statusStats || [],
      specializationStats: specializationStats || []
    };
  }

  buildQuery(filters = {}) {
    const { startDate, endDate, specialization } = filters;

    const dateFilter = {};
    
    if (startDate || endDate) {
      dateFilter.start = {};
      if (startDate) {
        const start = new Date(startDate);
        if (!isNaN(start.getTime())) {
          dateFilter.start.$gte = start;
        }
      }
      if (endDate) {
        const end = new Date(endDate);
        if (!isNaN(end.getTime())) {
          end.setHours(23, 59, 59, 999);
          dateFilter.start.$lte = end;
        }
      }
    }

    if (specialization) {
      dateFilter.specialization = specialization;
    }

    return dateFilter;
  }
}