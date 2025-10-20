// src/services/reports/repositories/ReportRepository.js
import { IReportRepository } from '../interfaces/IReportRepository.js';
import Report from '../../../models/reports/Report.js';
import Patient from '../../../models/Patient.js';
import Appointment from '../../../models/Appointment.js';

export class ReportRepository extends IReportRepository {
  async save(reportData) {
    try {
      const report = new Report(reportData);
      await report.save();
      return report;
    } catch (error) {
      if (error.code === 11000) {
        console.warn('⚠️ Report not saved due to duplicate key');
        return null;
      }
      throw error;
    }
  }

  async findById(id) {
    const report = await Report.findById(id);
    if (!report) {
      throw new Error('Report not found');
    }
    return report;
  }

  async find(filters = {}, pagination = {}) {
    const {
      type = 'all',
      date,
      search
    } = filters;

    const {
      page = 1,
      limit = 10,
      sortBy = 'generatedAt',
      sortOrder = 'desc'
    } = pagination;

    const query = {};

    if (type && type !== 'all') {
      query.reportType = type;
    }

    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      
      query.generatedAt = {
        $gte: startDate,
        $lte: endDate
      };
    }

    if (search) {
      query.reportId = { $regex: search, $options: 'i' };
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const reports = await Report.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    const totalReports = await Report.countDocuments(query);
    const totalPages = Math.ceil(totalReports / limit);

    return {
      reports,
      pagination: {
        currentPage: page,
        totalPages,
        totalReports,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };
  }

  async delete(id) {
    const report = await Report.findByIdAndDelete(id);
    if (!report) {
      throw new Error('Report not found');
    }
    return report;
  }

  async getStats() {
    const totalPatients = await Patient.countDocuments();
    const patientsWithDocuments = await Patient.countDocuments({ 'documents.0': { $exists: true } });
    const totalAppointments = await Appointment.countDocuments();
    
    const genderStats = await Patient.aggregate([
      { $group: { _id: '$personal.gender', count: { $sum: 1 } } }
    ]);
    
    const appointmentStatusStats = await Appointment.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    return {
      totalPatients,
      patientsWithDocuments,
      totalAppointments,
      genderStats,
      appointmentStatusStats
    };
  }
}