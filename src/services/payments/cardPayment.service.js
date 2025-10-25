import { PaymentService } from './payment.service.js';
import PaymentModel from '../../models/payments/Payment.js';
import { CardPaymentModel } from '../../models/payments/CardPayment.js';
import { generatePaymentOtp, verifyPaymentOtp } from './otp.service.js';
import env from '../../config/env.js';
import { notifyPayment } from '../email/notify.service.js';
import Patient from '../../models/Patient.js';
import User from '../../models/User.js';
import PaymentTypeModel from '../../models/payments/PaymentType.js';

export class CardPaymentService extends PaymentService {
  constructor(repo) {
    super(repo);
  }

  async initiate({ user, breakdown, currency, card, patientId, notes, doctorId, appointmentId }) {
    const totalAmount = Object.values(breakdown).reduce((a, b) => a + Number(b || 0), 0);
    const last4 = card.number.slice(-4);
    const token = `tok_${last4}_${Date.now()}`; // placeholder tokenization

    // Get PaymentType ObjectId for 'card'
    const cardPaymentType = await PaymentTypeModel.findOne({ type: 'card' }).lean();
    if (!cardPaymentType) {
      throw new Error('PaymentType "card" not found. Please run seedPaymentTypes script.');
    }

    // Derive patientId from logged-in user if not provided (PATIENT role → match by email)
    let derivedPatientId = patientId;
    if (!derivedPatientId && user?.role === 'PATIENT' && user?.email) {
      const patient = await Patient.findOne({ 'contact.email': user.email }).lean();
      if (patient?._id) derivedPatientId = patient._id;
    }

    // Target email preference: patient's email if available, otherwise user's email
    let targetEmail = user.email;
    if (derivedPatientId) {
      const p = await Patient.findById(derivedPatientId).lean();
      if (p?.contact?.email) targetEmail = p.contact.email;
    }

    // Default doctorId if not provided: pick any DOCTOR user (temporary)
    let effectiveDoctorId = doctorId || null;
    if (!effectiveDoctorId) {
      const anyDoctor = await User.findOne({ role: 'DOCTOR' }).select('_id').lean();
      if (anyDoctor?._id) effectiveDoctorId = anyDoctor._id;
    }

    // Generate OTP first
    const { otpRefId, code, expiresAt } = await generatePaymentOtp({
      target: targetEmail,
      meta: { last4, amount: totalAmount, currency }
    });

    // Debug log (non-production): show OTP details that will be sent
    if (env.nodeEnv !== 'production') {
      // eslint-disable-next-line no-console
      console.log(
        JSON.stringify({
          type: 'debug.payment.otp_initiated',
          otpRefId,
          otpTarget: targetEmail,
          last4,
          amount: totalAmount,
          currency,
          devCode: code
        })
      );
    }

    // Create payment with OTP reference
    const doc = await CardPaymentModel.create({
      paymentType: cardPaymentType._id, // ObjectId of 'card' PaymentType
      status: 'PENDING',
      currency,
      totalAmount,
      breakdown,
      customer: { userId: user.id, patientId: derivedPatientId },
      doctorId: effectiveDoctorId,
      notes: notes || '',
      metadata: { appointmentId: appointmentId || null }, // Store appointmentId for later linking
      card: { last4, brand: card.brand, token },
      otpRefId
    });

    // Send OTP email with full payment details
    await notifyPayment({ 
      type: 'OTP_SENT', 
      payment: doc.toObject(), 
      target: targetEmail,
      meta: { otpCode: code },
      actor: user 
    });

    await notifyPayment({ type: 'INITIATED', payment: doc.toObject(), actor: user });

  const devOtpCode = (env.notifyDriver === 'console' && env.nodeEnv !== 'production') ? code : undefined;
  return { paymentId: String(doc._id), otpRefId, devOtpCode, otpSentTo: targetEmail, expiresAt };
  }

  async confirm({ user, paymentId, otpRefId, otpCode }) {
    const payment = await CardPaymentModel.findById(paymentId).populate('paymentType');
    if (!payment || String(payment.customer.userId) !== String(user.id)) {
      return { ok: false, status: 404, message: 'Payment not found' };
    }
    if (String(payment.otpRefId) !== String(otpRefId)) {
      return { ok: false, status: 400, message: 'Mismatched OTP reference' };
    }

    const { ok, reason } = await verifyPaymentOtp({ otpRefId, code: otpCode });
    if (!ok) {
      return { ok: false, status: 400, message: `OTP ${reason}` };
    }

    payment.status = 'CAPTURED';
    payment.authorizedAt = new Date();
    payment.capturedAt = new Date();
    await payment.save();

    // Link this payment to the Patient record if provided
    if (payment.customer?.patientId) {
      await Patient.findByIdAndUpdate(payment.customer.patientId, {
        $addToSet: { payments: payment._id }
      });
    }

    await notifyPayment({ type: 'CAPTURED', payment: payment.toObject(), actor: user });
      // Create appointment after payment success (if not linked to existing appointment)
      let appointment = null;
      try {
        const Appointment = (await import('../../models/Appointment.js')).default;
        // Check if payment has appointmentId in metadata/notes
        const appointmentIdFromPayment = payment.metadata?.appointmentId || null;
        
        if (appointmentIdFromPayment) {
          // Update existing appointment with payment info
          appointment = await Appointment.findByIdAndUpdate(
            appointmentIdFromPayment,
            {
              paymentId: payment._id,
              paymentStatus: 'PAID',
              status: 'CONFIRMED'
            },
            { new: true }
          );
        } else {
          // Generate unique appointmentId (timestamp + random)
          const uniqueId = `APT${Date.now()}${Math.floor(Math.random()*10000)}`;
          const start = new Date();
          const end = new Date(start.getTime() + 30 * 60000); // 30 min slot
          appointment = await Appointment.create({
            appointmentId: uniqueId,
            patient: payment.customer?.userId,
            doctor: payment.doctorId,
            start,
            end,
            status: 'CONFIRMED',
            paymentId: payment._id,
            paymentStatus: 'PAID',
            reason: 'Paid appointment',
            createdBy: payment.customer?.userId
          });
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to create/update appointment:', err);
      }

      // Send payment success email with appointment and PDF receipt
      try {
        // Fetch patient and doctor names/emails first
        let patientEmail = user.email;
        let patientName = '-';
        if (payment.customer?.patientId) {
          const Patient = (await import('../../models/Patient.js')).default;
          const patient = await Patient.findById(payment.customer.patientId).lean();
          if (patient?.contact?.email) patientEmail = patient.contact.email;
          if (patient?.personal) patientName = `${patient.personal.firstName} ${patient.personal.lastName}`;
        }
        let doctorName = '-';
        if (payment.doctorId) {
          const User = (await import('../../models/User.js')).default;
          const doctor = await User.findById(payment.doctorId).lean();
          if (doctor?.name) doctorName = doctor.name;
        }

        const PDFDocument = (await import('pdfkit')).default;
        const doc = new PDFDocument({ margin: 50 });
        let buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', async () => {
          const pdfData = Buffer.concat(buffers);
          const env = (await import('../../config/env.js')).default;
          const nodemailer = (await import('nodemailer')).default;
          const transporter = nodemailer.createTransport({
            host: env.smtp.host,
            port: env.smtp.port,
            secure: env.smtp.port === 465,
            auth: { user: env.smtp.user, pass: env.smtp.pass }
          });
          // Compose appointment details
          let apptDetails = '';
          if (appointment) {
            apptDetails = `<p>Appointment Confirmed:</p>
              <ul>
                <li>Patient: ${patientName}</li>
                <li>Doctor: ${doctorName}</li>
                <li>Time: ${appointment.start.toLocaleString()} - ${appointment.end.toLocaleString()}</li>
                <li>Status: ${appointment.status}</li>
              </ul>`;
          }
          // Format amount as in PDF
          const currency = payment.currency || 'LKR';
          const fmt = (n) => `${currency} ${Number(n ?? 0).toFixed(2)}`;
          // Convert Mongoose subdocument to plain object for calculation
          const breakdownObj = payment.breakdown?.toObject ? payment.breakdown.toObject() : (payment.breakdown || {});
          const totalAmount = typeof payment.totalAmount === 'number' ? payment.totalAmount : Object.values(breakdownObj).reduce((a, b) => a + Number(b || 0), 0);
          // Compose payment details
          const html = `<h2>Payment Success</h2>
            <p>Your payment was successful and your appointment is confirmed.</p>
            ${apptDetails}
            <p>Payment Details:</p>
            <ul>
              <li>Amount: <b>${fmt(totalAmount)}</b></li>
              <li>Method: ${payment.paymentType?.type || 'N/A'}</li>
              <li>Status: ${payment.status}</li>
            </ul>
            <p>Doctor: ${doctorName}</p>
            <p>Thank you for your payment.</p>`;
          await transporter.sendMail({
            from: env.smtp.from,
            to: patientEmail,
            subject: 'Your Hospital Payment & Appointment Confirmation',
            html,
            attachments: [{ filename: `receipt_${paymentId}.pdf`, content: pdfData }]
          });
        });
        // Write PDF content (reuse logic from controller)
        doc.fontSize(18).text('Hospital Payment Receipt', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(10).fillColor('#555').text(`Payment ID: ${payment._id}`, { align: 'center' });
        doc.fillColor('#000');
        doc.moveDown();
        doc.fontSize(12).text(`Patient: ${patientName}`);
        doc.text(`Doctor: ${doctorName}`);
  doc.text(`Method: ${payment.paymentType?.type || 'N/A'}`);
        if (payment.card?.last4) doc.text(`Card: **** **** **** ${payment.card.last4}`);
        doc.text(`Status: ${payment.status}`);
        if (payment.authorizedAt) doc.text(`Authorized: ${new Date(payment.authorizedAt).toLocaleString()}`);
        if (payment.capturedAt) doc.text(`Captured: ${new Date(payment.capturedAt).toLocaleString()}`);
        doc.moveDown();
        doc.fontSize(12).text('Breakdown:');
        doc.moveDown(0.25);
        doc.fontSize(11);
        // Convert Mongoose subdocument to plain object
        const breakdown = payment.breakdown?.toObject ? payment.breakdown.toObject() : (payment.breakdown || {});
        const currency = payment.currency || 'LKR';
        const fmt = (n) => `${currency} ${Number(n ?? 0).toFixed(2)}`;
        Object.entries(breakdown).forEach(([k, v]) => {
          doc.text(`${k}: ${fmt(v)}`);
        });
        doc.moveDown(0.5);
        const totalAmount = typeof payment.totalAmount === 'number' ? payment.totalAmount : Object.values(breakdown).reduce((a, b) => a + Number(b || 0), 0);
        doc.fontSize(12).text(`Total: ${fmt(totalAmount)}`, { align: 'right' });
        doc.end();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to send payment success email:', err);
      }
      return { ok: true, payment, appointment };
  }
}

export default new CardPaymentService();
