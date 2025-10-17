// src/services/report.service.js
import Patient from '../models/Patient.js';
import Appointment from '../models/Appointment.js';
import Report from '../models/Report.js';

class ReportService {
  constructor() {
    this.reportTypes = {
      PATIENTS_LIST: 'patients_list',
      APPOINTMENTS_LIST: 'appointments_list',
      APPOINTMENTS_STATS: 'appointments_stats',
    };

    // Bind all methods to ensure proper 'this' context
    this.generateReport = this.generateReport.bind(this);
    this.generatePatientsList = this.generatePatientsList.bind(this);
    this.generateAppointmentsList = this.generateAppointmentsList.bind(this);
    this.generateAppointmentsStats = this.generateAppointmentsStats.bind(this);
    this.saveReportToDB = this.saveReportToDB.bind(this);
    this.getReportHistory = this.getReportHistory.bind(this);
    this.getReportById = this.getReportById.bind(this);
    this.deleteReport = this.deleteReport.bind(this);
    this.downloadReport = this.downloadReport.bind(this);
    this.getReportStats = this.getReportStats.bind(this);
    this.getAvailableReports = this.getAvailableReports.bind(this);
  }

  async generateReport(type, filters = {}, options = {}) {
    try {
      let result;
      switch (type) {
        case this.reportTypes.PATIENTS_LIST:
          result = await this.generatePatientsList(filters, options);
          break;
        case this.reportTypes.APPOINTMENTS_LIST:
          result = await this.generateAppointmentsList(filters, options);
          break;
        case this.reportTypes.APPOINTMENTS_STATS:
          result = await this.generateAppointmentsStats(filters, options);
          break;
        default:
          throw new Error(`Unknown report type: ${type}`);
      }

      await this.saveReportToDB(type, filters, options, result);
      return result;
    } catch (error) {
      throw new Error(`Report generation failed: ${error.message}`);
    }
  }

  async saveReportToDB(type, filters, options, result) {
    try {
      const reportData = {
        reportType: type,
        filters: filters || {},
        options: options || {},
        data: result || {},
        generatedAt: new Date(),
        recordCount: result?.totalPatients || result?.totalAppointments || result?.data?.length || 0
      };

      const report = new Report(reportData);
      await report.save();
      
      console.log('✅ Report saved successfully with ID:', report._id);
      return report;
      
    } catch (error) {
      console.error('❌ Failed to save report to DB:', error.message);
      
      // If it's a duplicate key error, log it but don't break the report generation
      if (error.code === 11000) {
        console.warn('⚠️ Report not saved due to duplicate key, but report generation completed successfully');
      }
      
      // Return null to indicate save failed, but don't throw error
      return null;
    }
  }

  // WORKING APPOINTMENTS LIST METHOD
  async generateAppointmentsList(filters = {}, options = {}) {
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

    const {
      format = 'json',
      includePatientDetails = false
    } = options;

    console.log('🔍 APPOINTMENTS FILTERS:', { status, specialization, startDate, endDate, start, end });

    // Build base query
    const query = {};

    // Text filters
    if (status) query.status = status;
    if (specialization) query.specialization = specialization;
    if (doctor) query.doctor = doctor;
    if (location) query.location = { $regex: location, $options: 'i' };

    // DATE FILTERING - SIMPLE AND EFFECTIVE
    const actualStart = startDate || start;
    const actualEnd = endDate || end;

    if (actualStart || actualEnd) {
      query.start = {};
      
      if (actualStart) {
        // Parse date string (YYYY-MM-DD) and create start of day in local timezone
        const startDate = new Date(actualStart);
        if (!isNaN(startDate.getTime())) {
          query.start.$gte = startDate;
          console.log(`📅 Start date filter: ${startDate}`);
        }
      }
      
      if (actualEnd) {
        // Parse date string (YYYY-MM-DD) and create end of day in local timezone
        const endDate = new Date(actualEnd);
        if (!isNaN(endDate.getTime())) {
          endDate.setHours(23, 59, 59, 999);
          query.start.$lte = endDate;
          console.log(`📅 End date filter: ${endDate}`);
        }
      }
    }

    console.log('🎯 FINAL QUERY:', JSON.stringify(query, null, 2));

    try {
      // Execute query
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

      console.log(`✅ Found ${appointments.length} appointments`);

      // Debug: Show what we found
      if (appointments.length > 0) {
        console.log('📋 Matched appointments:');
        appointments.forEach(apt => {
          console.log(`   - ${apt.start} | ${apt.status} | ${apt.specialization}`);
        });
      }

      const transformedAppointments = appointments.map(appointment => 
        this.transformAppointmentData(appointment, includePatientDetails)
      );

      return this.formatAppointmentsReport(transformedAppointments, format);
    } catch (error) {
      console.error('❌ Error fetching appointments:', error);
      throw error;
    }
  }

  // SIMPLE APPOINTMENTS STATS
  async generateAppointmentsStats(filters = {}, options = {}) {
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

    try {
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
    } catch (error) {
      console.error('Error generating stats:', error);
      throw error;
    }
  }

  // PATIENTS LIST
  async generatePatientsList(filters = {}, options = {}) {
    const {
      gender,
      ageRange,
      startDate,
      endDate,
      hasDocuments
    } = filters;

    const {
      format = 'json',
      includeDocuments = false
    } = options;

    console.log('🔍 PATIENTS FILTERS:', filters);

    const query = {};

    // Gender filter
    if (gender) {
      query['personal.gender'] = gender.toUpperCase();
    }

    // Age filter
    if (ageRange) {
      let minAge, maxAge;
      if (typeof ageRange === 'object') {
        minAge = parseInt(ageRange.min) || 0;
        maxAge = parseInt(ageRange.max) || 100;
      } else {
        const range = ageRange.split('-');
        minAge = parseInt(range[0]) || 0;
        maxAge = parseInt(range[1]) || 100;
      }
      query['personal.age'] = { $gte: minAge, $lte: maxAge };
    }

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        if (!isNaN(start.getTime())) {
          query.createdAt.$gte = start;
        }
      }
      if (endDate) {
        const end = new Date(endDate);
        if (!isNaN(end.getTime())) {
          end.setHours(23, 59, 59, 999);
          query.createdAt.$lte = end;
        }
      }
    }

    // Documents filter
    if (hasDocuments !== undefined) {
      if (hasDocuments === 'true' || hasDocuments === true) {
        query['documents.0'] = { $exists: true };
      } else {
        query.documents = { $size: 0 };
      }
    }

    console.log('🎯 PATIENTS QUERY:', JSON.stringify(query, null, 2));

    try {
      const patients = await Patient.find(query).sort({ createdAt: -1 });
      console.log(`✅ Found ${patients.length} patients`);

      const transformedPatients = patients.map(patient => 
        this.transformPatientData(patient, includeDocuments)
      );

      return this.formatPatientsReport(transformedPatients, format);
    } catch (error) {
      console.error('❌ Error fetching patients:', error);
      throw error;
    }
  }

  // Get report history with filtering and pagination
  async getReportHistory(filters = {}, pagination = {}) {
    try {
      const {
        type = 'all',
        status = 'all',
        date,
        search
      } = filters;

      const {
        page = 1,
        limit = 10,
        sortBy = 'generatedAt',
        sortOrder = 'desc'
      } = pagination;

      // Build query
      const query = {};

      // Report type filter
      if (type && type !== 'all') {
        query.reportType = type;
      }

      // Date filter
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

      // Search filter (by reportId)
      if (search) {
        query.reportId = { $regex: search, $options: 'i' };
      }

      console.log('Report history query:', query);

      // Calculate pagination
      const skip = (page - 1) * limit;
      const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

      // Execute query - DON'T exclude data, we need it for size calculation
      const reports = await Report.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean();

      // Get total count for pagination
      const totalReports = await Report.countDocuments(query);
      const totalPages = Math.ceil(totalReports / limit);

      // Transform the data for frontend
      const transformedReports = reports.map(report => 
        this.transformReportHistoryData(report)
      );

      return {
        reports: transformedReports,
        pagination: {
          currentPage: page,
          totalPages,
          totalReports,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      console.error('Error fetching report history:', error);
      throw new Error(`Failed to fetch report history: ${error.message}`);
    }
  }

  // Get specific report by ID
  async getReportById(reportId) {
    try {
      const report = await Report.findById(reportId);
      if (!report) {
        throw new Error('Report not found');
      }
      return report;
    } catch (error) {
      console.error('Error fetching report by ID:', error);
      throw new Error(`Failed to fetch report: ${error.message}`);
    }
  }

  // Delete report by ID
  async deleteReport(reportId) {
    try {
      console.log('Attempting to delete report:', reportId);
      
      const report = await Report.findByIdAndDelete(reportId);
      if (!report) {
        throw new Error('Report not found');
      }
      
      console.log('Report deleted successfully:', reportId);
      return { 
        success: true, 
        message: 'Report deleted successfully',
        deletedReport: {
          id: report._id,
          reportId: report.reportId,
          type: report.reportType
        }
      };
    } catch (error) {
      console.error('Error deleting report:', error);
      throw new Error(`Failed to delete report: ${error.message}`);
    }
  }

  // Download report in different formats
  async downloadReport(reportId, format = 'json') {
    try {
      const report = await Report.findById(reportId);
      if (!report) {
        throw new Error('Report not found');
      }

      // Ensure data exists
      if (!report.data) {
        throw new Error('Report data is missing');
      }

      let content, filename, contentType;

      switch (format) {
        case 'csv':
          if (report.reportType === 'patients_list') {
            content = this.patientsToCSV(report.data.data || []);
          } else if (report.reportType === 'appointments_list') {
            content = this.appointmentsToCSV(report.data.data || []);
          } else {
            content = this.statsToCSV(report.data);
          }
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
    } catch (error) {
      console.error('Error downloading report:', error);
      throw new Error(`Failed to download report: ${error.message}`);
    }
  }

  transformAppointmentData(appointment, includePatientDetails = false) {
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

  transformPatientData(patient, includeDocuments = false) {
    const transformed = {
      patientId: patient.patientId,
      personal: {
        firstName: patient.personal?.firstName || '',
        lastName: patient.personal?.lastName || '',
        dob: patient.personal?.dob || '',
        age: patient.personal?.age || '',
        gender: patient.personal?.gender || '',
        nic: patient.personal?.nic || '',
        passport: patient.personal?.passport || ''
      },
      contact: {
        address: patient.contact?.address || '',
        phone: patient.contact?.phone || '',
        email: patient.contact?.email || ''
      },
      medical: {
        history: patient.medical?.history || '',
        allergies: patient.medical?.allergies || [],
        conditions: patient.medical?.conditions || []
      },
      createdAt: patient.createdAt,
      updatedAt: patient.updatedAt
    };

    if (includeDocuments) {
      transformed.documents = patient.documents || [];
    }

    return transformed;
  }

  // Helper method to transform report data for history list
  transformReportHistoryData(report) {
    const reportTypeMap = {
      'patients_list': 'Patient List',
      'appointments_list': 'Appointments List',
      'appointments_stats': 'Appointments Statistics'
    };

    // Calculate file size estimate (rough calculation)
    // Handle cases where data might be undefined or null
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

    // Handle missing reportId gracefully
    const reportId = report.reportId || `RPT_${report._id}`;

    return {
      id: report._id,
      reportId: reportId,
      type: reportTypeMap[report.reportType] || report.reportType,
      generatedAt: report.generatedAt,
      recordCount: report.recordCount || 0,
      status: 'completed', // All saved reports are completed
      size: `${sizeInMB} MB`,
      filters: report.filters || {},
      reportType: report.reportType
    };
  }

  formatAppointmentsReport(appointments, format) {
    switch (format) {
      case 'csv':
        return this.appointmentsToCSV(appointments);
      default:
        return {
          reportType: 'appointments_list',
          generatedAt: new Date().toISOString(),
          totalAppointments: appointments.length,
          data: appointments
        };
    }
  }

  formatPatientsReport(patients, format) {
    switch (format) {
      case 'csv':
        return this.patientsToCSV(patients);
      default:
        return {
          reportType: 'patients_list',
          generatedAt: new Date().toISOString(),
          totalPatients: patients.length,
          data: patients
        };
    }
  }

  appointmentsToCSV(appointments) {
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

  patientsToCSV(patients) {
    if (patients.length === 0) return '';

    const headers = [
      'Patient ID', 'First Name', 'Last Name', 'DOB', 'Age', 'Gender', 
      'NIC', 'Passport', 'Phone', 'Email', 'Address', 
      'Medical Conditions', 'Allergies', 'Created At'
    ];
    
    const rows = patients.map(patient => [
      patient.patientId || '',
      patient.personal.firstName || '',
      patient.personal.lastName || '',
      patient.personal.dob || '',
      patient.personal.age || '',
      patient.personal.gender || '',
      patient.personal.nic || '',
      patient.personal.passport || '',
      patient.contact.phone || '',
      patient.contact.email || '',
      patient.contact.address || '',
      (patient.medical.conditions || []).join('; ') || '',
      (patient.medical.allergies || []).join('; ') || '',
      patient.createdAt ? patient.createdAt.toISOString() : ''
    ]);

    return [headers.join(','), ...rows.map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))].join('\n');
  }

  // Helper method to convert stats to CSV
  statsToCSV(statsData) {
    const headers = ['Metric', 'Value'];
    const rows = [];

    // Add basic stats
    rows.push(['Report Type', statsData.reportType]);
    rows.push(['Generated At', statsData.generatedAt]);
    
    if (statsData.totalAppointments) {
      rows.push(['Total Appointments', statsData.totalAppointments]);
    }
    
    if (statsData.totalPatients) {
      rows.push(['Total Patients', statsData.totalPatients]);
    }

    // Add status stats
    if (statsData.statusStats && statsData.statusStats.length > 0) {
      rows.push(['', '']);
      rows.push(['Status Statistics', '']);
      statsData.statusStats.forEach(stat => {
        rows.push([stat._id, stat.count]);
      });
    }

    // Add specialization stats
    if (statsData.specializationStats && statsData.specializationStats.length > 0) {
      rows.push(['', '']);
      rows.push(['Specialization Statistics', '']);
      statsData.specializationStats.forEach(stat => {
        rows.push([stat._id, stat.count]);
      });
    }

    return [headers.join(','), ...rows.map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))].join('\n');
  }

  getAvailableReports() {
    return Object.values(this.reportTypes);
  }

  // Get report types for filter dropdown
  getReportTypesForFilter() {
    return [
      { value: 'all', label: 'All Types' },
      { value: 'patients_list', label: 'Patient List' },
      { value: 'appointments_list', label: 'Appointments List' },
      { value: 'appointments_stats', label: 'Appointments Statistics' }
    ];
  }

  async getReportStats() {
    try {
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
    } catch (error) {
      throw new Error(`Failed to get report stats: ${error.message}`);
    }
  }
}

export default new ReportService();