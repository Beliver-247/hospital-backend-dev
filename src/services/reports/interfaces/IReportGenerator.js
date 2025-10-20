// src/services/reports/interfaces/IReportGenerator.js
export class IReportGenerator {
  async generate(filters = {}, options = {}) {
    throw new Error('Method not implemented');
  }
  
  async getData(filters = {}) {
    throw new Error('Method not implemented');
  }
  
  formatData(data, format = 'json') {
    throw new Error('Method not implemented');
  }
}