// src/controllers/reports/report.controller.js
import reportService from '../../services/reports/report.service.js';
import PDFDocument from 'pdfkit';

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

export const downloadReport = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { format = 'pdf' } = req.query;

    if (format.toLowerCase() === 'pdf') {
      const report = await reportService.getReportById(id);
      if (!report) {
        return res.status(404).json({ success: false, message: 'Report not found' });
      }

      const reportData = report.data || {};
      const filename = `${reportData.reportType || 'report'}_${id}.pdf`;

      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      doc.pipe(res);



      doc
        .fontSize(22)
        .fillColor('#003366')
        .text('Hospital Management System', 120, 40, { align: 'left' })
        .moveDown(2);

      // === REPORT TITLE ===
      doc
        .fontSize(18)
        .fillColor('black')
        .text('Detailed Report', { align: 'center', underline: true })
        .moveDown(1.5);

      // === REPORT SUMMARY TABLE ===
      const summaryData = [
        ['Report Type', reportData.reportType || '-'],
        ['Generated At', new Date(reportData.generatedAt).toLocaleString() || '-'],
        ['Total Patients', reportData.totalPatients || '-'],
        ['Total Appointments', reportData.totalAppointments || '-'],
        ['Date Range', reportData.dateRange ? `${reportData.dateRange.start} - ${reportData.dateRange.end}` : '-']
      ];

      doc.fontSize(12);
      let y = doc.y;
      summaryData.forEach(([label, value]) => {
        doc.font('Helvetica-Bold').text(`${label}: `, 50, y, { continued: true });
        doc.font('Helvetica').text(value);
        y = doc.y + 5;
      });

      doc.moveDown(1.5);

      // === PATIENTS LIST SECTION ===
      if (Array.isArray(reportData.data) && reportData.data.length > 0) {
        doc.fontSize(16).text('Patients List', { underline: true }).moveDown(0.5);

        // Table headers
        const headers = ['Patient ID', 'Name', 'Contact', 'Medical Info', 'Created', 'Updated'];
        const colWidths = [80, 100, 100, 100, 80, 80];
        let startY = doc.y + 5;

        const drawTableRow = (values, y, isHeader = false) => {
          let x = 50;
          values.forEach((val, i) => {
            doc
              .font(isHeader ? 'Helvetica-Bold' : 'Helvetica')
              .fontSize(10)
              .text(val || '-', x + 2, y + 5, { width: colWidths[i] - 4 });
            x += colWidths[i];
          });
        };

        drawTableRow(headers, startY, true);
        let rowY = startY + 20;

        reportData.data.forEach((patient) => {
          const name = patient.personal
            ? `${patient.personal.firstName || ''} ${patient.personal.lastName || ''}`.trim()
            : '-';
          const contact = patient.contact
            ? `${patient.contact.phone || ''}, ${patient.contact.email || ''}`
            : '-';
          const medical = patient.medical
            ? `${patient.medical.diagnosis || ''}`
            : '-';

          const values = [
            patient.patientId,
            name,
            contact,
            medical,
            new Date(patient.createdAt).toLocaleDateString(),
            new Date(patient.updatedAt).toLocaleDateString()
          ];

          drawTableRow(values, rowY);
          rowY += 20;

          // Handle page overflow
          if (rowY > doc.page.height - 100) {
            doc.addPage();
            rowY = 50;
            drawTableRow(headers, rowY, true);
            rowY += 20;
          }
        });

        doc.moveDown(2);
      }

      // === APPOINTMENT STATISTICS SECTION ===
      if (reportData.statusStats || reportData.specializationStats) {
        doc.fontSize(16).text('Appointments Statistics', { underline: true }).moveDown(0.5);

        // Status Stats Table
        if (reportData.statusStats && reportData.statusStats.length > 0) {
          doc.fontSize(13).font('Helvetica-Bold').text('Status Breakdown:').moveDown(0.3);
          const headers = ['Status', 'Count'];
          let y = doc.y + 5;
          const colWidths = [150, 100];
          const drawRow = (vals, y, isHeader = false) => {
            let x = 50;
            vals.forEach((val, i) => {
              doc
                .font(isHeader ? 'Helvetica-Bold' : 'Helvetica')
                .fontSize(10)
                .text(val, x + 2, y + 5, { width: colWidths[i] - 4 });
              x += colWidths[i];
            });
          };

          drawRow(headers, y, true);
          y += 20;

          reportData.statusStats.forEach((stat) => {
            drawRow([stat._id || '-', stat.count || 0], y);
            y += 20;
          });

          doc.moveDown(1);
        }

        // Specialization Stats Table
        if (reportData.specializationStats && reportData.specializationStats.length > 0) {
          doc.fontSize(13).font('Helvetica-Bold').text('Specialization Breakdown:').moveDown(0.3);
          const headers = ['Specialization', 'Count'];
          let y = doc.y + 5;
          const colWidths = [150, 100];

          const drawRow = (vals, y, isHeader = false) => {
            let x = 50;
            vals.forEach((val, i) => {
              doc
                .font(isHeader ? 'Helvetica-Bold' : 'Helvetica')
                .fontSize(10)
                .text(val, x + 2, y + 5, { width: colWidths[i] - 4 });
              x += colWidths[i];
            });
          };

          drawRow(headers, y, true);
          y += 20;

          reportData.specializationStats.forEach((spec) => {
            drawRow([spec._id || '-', spec.count || 0], y);
            y += 20;
          });

          doc.moveDown(1);
        }
      }

      // === FOOTER ===
      doc
        .moveDown(3)
        .fontSize(10)
        .fillColor('gray')
        .text('Generated by Hospital Management System © 2025', {
          align: 'center'
        });

      doc.end();
    } else {
      // Non-PDF formats
      const { content, filename, contentType } = await reportService.downloadReport(id, format);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(content);
    }
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