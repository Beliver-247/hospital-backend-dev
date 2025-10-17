// src/routes/report.routes.js
import { Router } from 'express';
import { 
  generateReport, 
  getReportTypes, 
  getReportStatistics,
  getReportHistory,
  getReportById,
  deleteReport,
  downloadReport
} from '../controllers/report.controller.js';

const router = Router();

// GET /api/reports/types - Get available report types
router.get('/types', getReportTypes);

// GET /api/reports/stats - Get report statistics
router.get('/stats', getReportStatistics);

// GET /api/reports/generate - Generate report
router.get('/generate', generateReport);

// GET /api/reports/history - Get report history
router.get('/history', getReportHistory);

// GET /api/reports/:id - Get specific report
router.get('/:id', getReportById);

// DELETE /api/reports/:id - Delete report
router.delete('/:id', deleteReport);

// GET /api/reports/:id/download - Download report
router.get('/:id/download', downloadReport);

export default router;