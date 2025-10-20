// src/services/reports/interfaces/IReportRepository.js
export class IReportRepository {
  async save(reportData) {
    throw new Error('Method not implemented');
  }
  
  async findById(id) {
    throw new Error('Method not implemented');
  }
  
  async find(filters = {}, pagination = {}) {
    throw new Error('Method not implemented');
  }
  
  async delete(id) {
    throw new Error('Method not implemented');
  }
  
  async getStats() {
    throw new Error('Method not implemented');
  }
}