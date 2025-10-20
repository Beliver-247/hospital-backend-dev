// src/services/reports/transformers/PatientTransformer.js
import { BaseTransformer } from './BaseTransformer.js';

export class PatientTransformer extends BaseTransformer {
  transform(patient, includeDocuments = false) {
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
}