// src/services/reports/generators/PatientsListGenerator.js
import { BaseReportGenerator } from './BaseReportGenerator.js';
import Patient from '../../../models/Patient.js';

export class PatientsListGenerator extends BaseReportGenerator {
  async getData(filters = {}, options = {}) {
    const { includeDocuments = false } = options;
    const query = this.buildQuery(filters);

    const patients = await Patient.find(query).sort({ createdAt: -1 });
    
    return patients.map(patient => 
      this.transformer.transform(patient, includeDocuments)
    );
  }

  buildQuery(filters = {}) {
    const {
      gender,
      ageRange,
      startDate,
      endDate,
      hasDocuments
    } = filters;

    const query = {};

    if (gender) {
      query['personal.gender'] = gender.toUpperCase();
    }

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

    if (hasDocuments !== undefined) {
      if (hasDocuments === 'true' || hasDocuments === true) {
        query['documents.0'] = { $exists: true };
      } else {
        query.documents = { $size: 0 };
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
          reportType: 'patients_list',
          generatedAt: new Date().toISOString(),
          totalPatients: data.length,
          data: data
        };
    }
  }

  toCSV(patients) {
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

  async generate(filters = {}, options = {}) {
    const data = await this.getData(filters, options);
    return this.formatData(data, options.format);
  }
}