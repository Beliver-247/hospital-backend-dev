import { 
  generateReport, 
  getReportTypes, 
  getReportStatistics 
} from '../../src/controllers/report.controller.js';

import reportService from '../../src/services/report.service.js';

// Mock the service layer
jest.mock('../../src/services/report.service.js');

describe('report.controller.js', () => {
  let req, res, next;

  beforeEach(() => {
    req = { query: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn(),
      setHeader: jest.fn()
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  // ---------- generateReport ----------
  describe('generateReport()', () => {
    test('should return 400 if report type is missing', async () => {
      await generateReport(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Report type is required'
      });
    });

    test('should call reportService.generateReport with correct args', async () => {
      req.query = {
        type: 'patient',
        format: 'json',
        includeDocuments: 'true',
        department: 'cardiology'
      };

      const mockResult = [{ id: 1 }];
      reportService.generateReport.mockResolvedValue(mockResult);

      await generateReport(req, res, next);

      expect(reportService.generateReport).toHaveBeenCalledWith(
        'patient',
        { department: 'cardiology' },
        { format: 'json', includeDocuments: true }
      );

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockResult
      });
    });

    test('should handle CSV format correctly', async () => {
      req.query = {
        type: 'appointments',
        format: 'csv'
      };

      reportService.generateReport.mockResolvedValue('csv-data');

      await generateReport(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(res.send).toHaveBeenCalledWith('csv-data');
    });

    test('should parse ageRange if it is object', async () => {
      req.query = {
        type: 'patient',
        ageRange: { min: '18', max: '60' }
      };
      reportService.generateReport.mockResolvedValue([{ id: 1 }]);

      await generateReport(req, res, next);

      expect(reportService.generateReport).toHaveBeenCalledWith(
        'patient',
        { ageRange: { min: 18, max: 60 } },
        { format: 'json', includeDocuments: false }
      );
    });

    test('should call next(error) if exception occurs', async () => {
      const error = new Error('Something went wrong');
      reportService.generateReport.mockRejectedValue(error);

      req.query = { type: 'patient' };

      await generateReport(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  // ---------- getReportTypes ----------
  describe('getReportTypes()', () => {
    test('should return available report types', async () => {
      const mockTypes = ['patient', 'appointment'];
      reportService.getAvailableReports.mockReturnValue(mockTypes);

      await getReportTypes(req, res, next);

      expect(reportService.getAvailableReports).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockTypes
      });
    });

    test('should call next(error) if service throws', async () => {
      const error = new Error('DB error');
      reportService.getAvailableReports.mockImplementation(() => { throw error; });

      await getReportTypes(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  // ---------- getReportStatistics ----------
  describe('getReportStatistics()', () => {
    test('should return report statistics', async () => {
      const mockStats = { total: 10, generatedToday: 2 };
      reportService.getReportStats.mockResolvedValue(mockStats);

      await getReportStatistics(req, res, next);

      expect(reportService.getReportStats).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockStats
      });
    });

    test('should call next(error) if service rejects', async () => {
      const error = new Error('Service failed');
      reportService.getReportStats.mockRejectedValue(error);

      await getReportStatistics(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
