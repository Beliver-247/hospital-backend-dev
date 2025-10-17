// src/controllers/report.controller.js
import reportService from '../services/report.service.js';

// In the generateReport controller - ENHANCED VERSION
export const generateReport = async (req, res, next) => {
  try {
    const { type, format = 'json', includeDocuments, includePatientDetails, ...filters } = req.query;

    if (!type) {
      return res.status(400).json({
        success: false,
        message: 'Report type is required'
      });
    }

    // Normalize date parameter names - support both startDate/endDate and start/end
    const normalizedFilters = { ...filters };
    
    // Handle date parameters - FIXED: Ensure both naming conventions work
    if (normalizedFilters.startDate && !normalizedFilters.start) {
      normalizedFilters.start = normalizedFilters.startDate;
    }
    if (normalizedFilters.endDate && !normalizedFilters.end) {
      normalizedFilters.end = normalizedFilters.endDate;
    }
    
    // Also support the reverse - if start/end are provided, also set startDate/endDate
    if (normalizedFilters.start && !normalizedFilters.startDate) {
      normalizedFilters.startDate = normalizedFilters.start;
    }
    if (normalizedFilters.end && !normalizedFilters.endDate) {
      normalizedFilters.endDate = normalizedFilters.end;
    }

    // Handle age range parameters - FIXED
    if (normalizedFilters.ageRange) {
      // If ageRange is an object (from query string parsing)
      if (typeof normalizedFilters.ageRange === 'object') {
        normalizedFilters.ageRange = {
          min: parseInt(normalizedFilters.ageRange.min) || 0,
          max: parseInt(normalizedFilters.ageRange.max) || 100
        };
      }
      // If ageRange comes as a string like "18-30"
      else if (typeof normalizedFilters.ageRange === 'string') {
        const [min, max] = normalizedFilters.ageRange.split('-').map(Number);
        normalizedFilters.ageRange = {
          min: isNaN(min) ? 0 : min,
          max: isNaN(max) ? 100 : max
        };
      }
    }

    // Parse boolean parameters
    const options = {
      format,
      includeDocuments: includeDocuments === 'true' || includeDocuments === true,
      includePatientDetails: includePatientDetails === 'true' || includePatientDetails === true
    };

    // Validate date parameters - FIXED: Check both naming conventions
    const startDateToValidate = normalizedFilters.startDate || normalizedFilters.start;
    const endDateToValidate = normalizedFilters.endDate || normalizedFilters.end;

    if (startDateToValidate) {
      const startDate = new Date(startDateToValidate);
      if (isNaN(startDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid start date format. Use YYYY-MM-DD'
        });
      }
    }

    if (endDateToValidate) {
      const endDate = new Date(endDateToValidate);
      if (isNaN(endDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid end date format. Use YYYY-MM-DD'
        });
      }
    }

    console.log('Normalized filters:', normalizedFilters); // Debug log
    console.log('Options:', options); // Debug log

    const result = await reportService.generateReport(type, normalizedFilters, options);

    // Set appropriate headers based on format
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${type}_${Date.now()}.csv"`);
      return res.send(result);
    }

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    next(error);
  }
};

export const getReportTypes = async (req, res, next) => {
  try {
    const reportTypes = reportService.getAvailableReports();
    
    res.json({
      success: true,
      data: reportTypes
    });
  } catch (error) {
    next(error);
  }
};

export const getReportStatistics = async (req, res, next) => {
  try {
    const stats = await reportService.getReportStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
};

// src/controllers/report.controller.js - Add these new functions

// Get report history
export const getReportHistory = async (req, res, next) => {
  try {
    const {
      type = 'all',
      status = 'all',
      date,
      search,
      page = 1,
      limit = 10,
      sortBy = 'generatedAt',
      sortOrder = 'desc'
    } = req.query;

    const filters = { type, status, date, search };
    const pagination = { page: parseInt(page), limit: parseInt(limit), sortBy, sortOrder };

    const result = await reportService.getReportHistory(filters, pagination);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// Get specific report by ID
export const getReportById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const report = await reportService.getReportById(id);

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
};

// Delete report
export const deleteReport = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await reportService.deleteReport(id);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// Download report
export const downloadReport = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { format = 'json' } = req.query;

    const { content, filename, contentType } = await reportService.downloadReport(id, format);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  } catch (error) {
    next(error);
  }
};

// Get report types for filter (optional)
export const getReportFilterTypes = async (req, res, next) => {
  try {
    const reportTypes = reportService.getReportTypesForFilter();
    
    res.json({
      success: true,
      data: reportTypes
    });
  } catch (error) {
    next(error);
  }
};