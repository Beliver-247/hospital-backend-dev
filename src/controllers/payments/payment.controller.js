import asyncHandler from '../../utils/asyncHandler.js';
import auth from '../../middleware/auth.js';
import validate from '../../middleware/validate.js';
import {
  initiateCardPaymentSchema,
  confirmCardPaymentSchema,
  listPaymentsQuerySchema,
  updatePaymentSchema
} from '../../validators/paymentSchemas.js';
import cardPaymentService from '../../services/payments/cardPayment.service.js';
import PDFDocument from 'pdfkit';
import Patient from '../../models/Patient.js';
import User from '../../models/User.js';
import { PaymentService } from '../../services/payments/payment.service.js';

const paymentService = new PaymentService();

export const initiateCard = [
  auth,
  validate(initiateCardPaymentSchema),
  asyncHandler(async (req, res) => {
    const { breakdown, currency, card, notes, appointmentId } = req.body;
    const out = await cardPaymentService.initiate({
      user: req.user,
      breakdown,
      currency,
      card,
      appointmentId, // Pass appointmentId to link payment with appointment
      // patient/doctor are derived in service
      notes
    });
    // devOtpCode only for dev/testing
    res.status(201).json(out);
  })
];

export const confirmCard = [
  auth,
  validate(confirmCardPaymentSchema),
  asyncHandler(async (req, res) => {
    const { otpRefId, otpCode, paymentId } = { ...req.body, ...req.params };
    const result = await cardPaymentService.confirm({
      user: req.user,
      paymentId,
      otpRefId,
      otpCode
    });
    if (!result.ok) return res.status(result.status || 400).json({ message: result.message });
    res.json({ payment: result.payment });
  })
];

export const getMyPayments = [
  auth,
  asyncHandler(async (req, res) => {
    const { error, value } = listPaymentsQuerySchema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true
    });
    if (error) return res.status(400).json({ message: 'Invalid query' });
    const data = await paymentService.listByUser(req.user.id, value);
    res.json(data);
  })
];

export const updatePayment = [
  auth,
  validate(updatePaymentSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    // Only allow updating own payments (basic rule)
    const payment = await paymentService.getById(id);
    if (!payment || String(payment.customer.userId) !== String(req.user.id))
      return res.status(404).json({ message: 'Payment not found' });

    const updated = await paymentService.update(id, req.body);
    res.json(updated);
  })
];

export const deletePayment = [
  auth,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const payment = await paymentService.getById(id);
    if (!payment || String(payment.customer.userId) !== String(req.user.id))
      return res.status(404).json({ message: 'Payment not found' });
    await paymentService.delete(id);
    res.status(204).send();
  })
];

export const getPaymentById = [
  auth,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const payment = await paymentService.getById(id);
    if (!payment || String(payment.customer.userId) !== String(req.user.id))
      return res.status(404).json({ message: 'Payment not found' });
    res.json(payment);
  })
];

export const downloadReceipt = [
  auth,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const payment = await paymentService.getById(id);
    if (!payment || String(payment.customer.userId) !== String(req.user.id))
      return res.status(404).json({ message: 'Payment not found' });

    // Convert to plain object with nested subdocuments
    const p = JSON.parse(JSON.stringify(payment.toObject ? payment.toObject() : payment));

    // Fetch names
    let patientName = '-';
    if (p?.customer?.patientId) {
      const patient = await Patient.findById(p.customer.patientId).lean();
      if (patient?.personal) patientName = `${patient.personal.firstName} ${patient.personal.lastName}`;
    }
    let doctorName = '-';
    if (p?.doctorId) {
      const doctor = await User.findById(p.doctorId).lean();
      if (doctor?.name) doctorName = doctor.name;
    }

    // Prepare PDF
    const filename = `receipt_${id}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);

  const currency = p.currency || 'LKR';
  const fmt = (n) => `${currency} ${Number(n ?? 0).toFixed(2)}`;

    // Header
  doc.fontSize(18).text('Hospital Payment Receipt', { align: 'center' });
    doc.moveDown(0.5);
  doc.fontSize(10).fillColor('#555').text(`Payment ID: ${p._id}`, { align: 'center' });
    doc.fillColor('#000');
    doc.moveDown();

    // Party details
  doc.fontSize(12).text(`Patient: ${patientName}`);
  doc.text(`Doctor: ${doctorName}`);
  doc.text(`Method: ${p.paymentType?.type || 'N/A'}`);
  if (p.card?.last4) doc.text(`Card: **** **** **** ${p.card.last4}`);
  doc.text(`Status: ${p.status}`);
  if (p.authorizedAt) doc.text(`Authorized: ${new Date(p.authorizedAt).toLocaleString()}`);
  if (p.capturedAt) doc.text(`Captured: ${new Date(p.capturedAt).toLocaleString()}`);

    doc.moveDown();
    doc.fontSize(12).text('Breakdown:');
    doc.moveDown(0.25);
    doc.fontSize(11);
    // Ensure breakdown is a clean plain object with only the actual fields
    const breakdown = p.breakdown || {};
    const validFields = ['consultationFee', 'labTests', 'prescription', 'processingFee', 'other'];
    const cleanBreakdown = {};
    validFields.forEach(field => {
      if (breakdown[field] !== undefined) {
        cleanBreakdown[field] = breakdown[field];
      }
    });
    
    // Debug log
    console.log('PDF Breakdown:', JSON.stringify(cleanBreakdown));
    console.log('PDF Total Amount:', p.totalAmount);
    
    Object.entries(cleanBreakdown).forEach(([k, v]) => {
      const formattedValue = fmt(v);
      console.log(`PDF Line: ${k}: ${formattedValue}`);
      doc.text(`${k}: ${formattedValue}`);
    });
    doc.moveDown(0.5);
    const totalAmount = typeof p.totalAmount === 'number' ? p.totalAmount : Object.values(cleanBreakdown).reduce((a, b) => a + Number(b || 0), 0);
    console.log('PDF Calculated Total:', totalAmount);
    doc.fontSize(12).text(`Total: ${fmt(totalAmount)}`, { align: 'right' });

    doc.end();
  })
];
