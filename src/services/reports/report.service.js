// src/services/report.service.js
import { AppointmentsListGenerator } from '../reports/generators/AppointmentsListGenerator.js';
import { AppointmentsStatsGenerator } from '../reports/generators/AppointmentsStatsGenerator.js';
import { PatientsListGenerator } from '../reports/generators/PatientsListGenerator.js';
import { AppointmentTransformer } from '../reports/transformers/AppointmentTransformer.js';
import { PatientTransformer } from '../reports/transformers/PatientTransformer.js';
import { ReportRepository } from '../reports/repositories/ReportRepository.js';

class ReportService {
  constructor() {
    this.reportTypes = {
      PATIENTS_LIST: 'patients_list',
      APPOINTMENTS_LIST: 'appointments_list',
      APPOINTMENTS_STATS: 'appointments_stats',
    };

    // Initialize dependencies
    this.reportRepository = new ReportRepository();
    
    // Initialize generators with their transformers
    this.generators = {
      [this.reportTypes.PATIENTS_LIST]: new PatientsListGenerator(new PatientTransformer()),
      [this.reportTypes.APPOINTMENTS_LIST]: new AppointmentsListGenerator(new AppointmentTransformer()),
      [this.reportTypes.APPOINTMENTS_STATS]: new AppointmentsStatsGenerator()
    };
  }

  async generateReport(type, filters = {}, options = {}) {
    const generator = this.generators[type];
    if (!generator) {
      throw new Error(`Unknown report type: ${type}`);
    }

    const result = await generator.generate(filters, options);
    
    // Save report to database
    await this.reportRepository.save({
      reportType: type,
      filters: filters || {},
      options: options || {},
      data: result,
      generatedAt: new Date(),
      recordCount: result?.totalPatients || result?.totalAppointments || result?.data?.length || 0
    });

    return result;
  }

  async getReportHistory(filters = {}, pagination = {}) {
    const result = await this.reportRepository.find(filters, pagination);
    
    // Transform the data for frontend
    const transformedReports = result.reports.map(report => 
      this.transformReportHistoryData(report)
    );

    return {
      reports: transformedReports,
      pagination: result.pagination
    };
  }

  async getReportById(reportId) {
    return await this.reportRepository.findById(reportId);
  }

  async deleteReport(reportId) {
    const report = await this.reportRepository.delete(reportId);
    
    return { 
      success: true, 
      message: 'Report deleted successfully',
      deletedReport: {
        id: report._id,
        reportId: report.reportId,
        type: report.reportType
      }
    };
  }

  async downloadReport(reportId, format = 'json') {
    const report = await this.reportRepository.findById(reportId);

    if (!report.data) {
      throw new Error('Report data is missing');
    }

    let content, filename, contentType;

    switch (format) {
      case 'csv':
        content = this.convertToCSV(report.data, report.reportType);
        filename = `${report.reportType}_${report.reportId || report._id}.csv`;
        contentType = 'text/csv';
        break;

      case 'json':
        content = JSON.stringify(report.data, null, 2);
        filename = `${report.reportType}_${report.reportId || report._id}.json`;
        contentType = 'application/json';
        break;

      default:
        throw new Error('Unsupported download format');
    }

    return {
      content,
      filename,
      contentType
    };
  }

  async getReportStats() {
    return await this.reportRepository.getStats();
  }

  getAvailableReports() {
    return Object.values(this.reportTypes);
  }

  getReportTypesForFilter() {
    return [
      { value: 'all', label: 'All Types' },
      { value: 'patients_list', label: 'Patient List' },
      { value: 'appointments_list', label: 'Appointments List' },
      { value: 'appointments_stats', label: 'Appointments Statistics' }
    ];
  }

  // Helper methods
  transformReportHistoryData(report) {
    const reportTypeMap = {
      'patients_list': 'Patient List',
      'appointments_list': 'Appointments List',
      'appointments_stats': 'Appointments Statistics'
    };

    let sizeInMB = '0.0';
    
    if (report.data) {
      try {
        const dataSize = JSON.stringify(report.data).length;
        sizeInMB = (dataSize / (1024 * 1024)).toFixed(1);
      } catch (error) {
        console.warn('Error calculating report size:', error);
        sizeInMB = '0.0';
      }
    }

    const reportId = report.reportId || `RPT_${report._id}`;

    return {
      id: report._id,
      reportId: reportId,
      type: reportTypeMap[report.reportType] || report.reportType,
      generatedAt: report.generatedAt,
      recordCount: report.recordCount || 0,
      status: 'completed',
      size: `${sizeInMB} MB`,
      filters: report.filters || {},
      reportType: report.reportType
    };
  }

  convertToCSV(data, reportType) {
    if (reportType === 'patients_list') {
      return this.patientsToCSV(data.data || []);
    } else if (reportType === 'appointments_list') {
      return this.appointmentsToCSV(data.data || []);
    } else {
      return this.statsToCSV(data);
    }
  }

  statsToCSV(statsData) {
    const headers = ['Metric', 'Value'];
    const rows = [];

    rows.push(['Report Type', statsData.reportType]);
    rows.push(['Generated At', statsData.generatedAt]);
    
    if (statsData.totalAppointments) {
      rows.push(['Total Appointments', statsData.totalAppointments]);
    }
    
    if (statsData.totalPatients) {
      rows.push(['Total Patients', statsData.totalPatients]);
    }

    if (statsData.statusStats && statsData.statusStats.length > 0) {
      rows.push(['', '']);
      rows.push(['Status Statistics', '']);
      statsData.statusStats.forEach(stat => {
        rows.push([stat._id, stat.count]);
      });
    }

    if (statsData.specializationStats && statsData.specializationStats.length > 0) {
      rows.push(['', '']);
      rows.push(['Specialization Statistics', '']);
      statsData.specializationStats.forEach(stat => {
        rows.push([stat._id, stat.count]);
      });
    }

    return [headers.join(','), ...rows.map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))].join('\n');
  }

  // Keep these for backward compatibility
  appointmentsToCSV(appointments) {
    const generator = new AppointmentsListGenerator(new AppointmentTransformer());
    return generator.toCSV(appointments);
  }

  patientsToCSV(patients) {
    const generator = new PatientsListGenerator(new PatientTransformer());
    return generator.toCSV(patients);
  }
}

export default new ReportService();