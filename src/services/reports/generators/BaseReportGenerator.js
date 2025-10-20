// src/services/reports/generators/BaseReportGenerator.js
import { IReportGenerator } from '../interfaces/IReportGenerator.js';

export class BaseReportGenerator extends IReportGenerator {
  constructor(transformer) {
    super();
    this.transformer = transformer;
  }

  formatData(data, format = 'json') {
    throw new Error('Method not implemented');
  }

  buildQuery(filters = {}) {
    throw new Error('Method not implemented');
  }
}