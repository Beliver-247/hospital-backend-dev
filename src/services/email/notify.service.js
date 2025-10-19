// Minimal notification stub. Safe in tests and dev.
// Plug real email/SMS later (nodemailer, Twilio, etc).

import env from '../../config/env.js';
import nodemailer from 'nodemailer';
async function sendEmail({ to, subject, html }) {
  const transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.port === 465,
    auth: {
      user: env.smtp.user,
      pass: env.smtp.pass
    }
  });
  await transporter.sendMail({
    from: env.smtp.from,
    to,
    subject,
    html
  });
}

function isEnabled() {
  // Never spam during tests. You can override by setting NOTIFY_ENABLED=true explicitly.
  if (process.env.NODE_ENV === 'test') return false;
  return env.notifyEnabled; // false by default unless .env sets NOTIFY_ENABLED=true
}

/**
 * notifyAppointment
 * @param {{ action: 'CREATED'|'UPDATED'|'RESCHEDULED'|'STATUS_CHANGED'|'CANCELLED',
 *           appointment: any, // populated appt with doctor/patient fields
 *           actor?: { id?: string, role?: string, email?: string } }} payload
 */
export async function notifyAppointment({ action, appointment, actor }) {
  if (!isEnabled()) return;

  const patientEmail = appointment?.patient?.email;
  const doctorEmail  = appointment?.doctor?.email;

  // Console driver (default)
  if (env.notifyDriver === 'console') {
    // Keep it concise and structured
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        type: 'appointment_notification',
        action,
        appointmentId: appointment?.appointmentId,
        status: appointment?.status,
        start: appointment?.start,
        end: appointment?.end,
        doctor: { id: appointment?.doctor?._id, email: doctorEmail },
        patient: { id: appointment?.patient?._id, email: patientEmail },
        actor
      })
    );
    return;
  }

  // Future drivers:
  // if (env.notifyDriver === 'smtp') { await sendEmail(...); }
  // if (env.notifyDriver === 'twilio') { await sendSms(...); }
}

/**
 * notifyPayment
 * @param {{ type: 'OTP_SENT'|'INITIATED'|'CAPTURED'|'FAILED'|'REFUNDED',
 *           payment?: any,
 *           target?: string,
 *           meta?: any,
 *           actor?: { id?: string, role?: string, email?: string } }} payload
 */
export async function notifyPayment({ type, payment, target, meta, actor }) {
  if (!isEnabled()) return;

  // Compose patient/doctor info for OTP email
  let patientName = '';
  let doctorName = '';
  if (payment?.customer?.patientId) {
    const Patient = (await import('../../models/Patient.js')).default;
    const patient = await Patient.findById(payment.customer.patientId).lean();
    if (patient?.personal) {
      patientName = `${patient.personal.firstName} ${patient.personal.lastName}`;
    }
  }
  if (payment?.doctorId) {
    const User = (await import('../../models/User.js')).default;
    const doctor = await User.findById(payment.doctorId).lean();
    if (doctor?.name) doctorName = doctor.name;
  }

  if (env.notifyDriver === 'smtp' && type === 'OTP_SENT') {
    // Compose OTP email
    const otpCode = meta?.otpCode || '[OTP]';
    // Debug (non-production) - log OTP being emailed
    if (env.nodeEnv !== 'production') {
      // eslint-disable-next-line no-console
      console.log(
        JSON.stringify({
          type: 'debug.payment.otp_email',
          to: target,
          otpCode
        })
      );
    }
    const html = `
      <h2>Hospital Payment OTP</h2>
      <p>Dear ${patientName || 'Patient'},</p>
      <p>Your OTP for payment is: <b>${otpCode}</b></p>
      <p>This OTP will expire in 5 minutes.</p>
      <p>Consultation: ${payment?.breakdown?.consultationFee || '-'}<br>
      Lab Tests: ${payment?.breakdown?.labTests || '-'}<br>
      Prescription: ${payment?.breakdown?.prescription || '-'}<br>
      Processing Fee: ${payment?.breakdown?.processingFee || '-'}<br>
      Other: ${payment?.breakdown?.other || '-'}</p>
      <p>Total: <b>${payment?.totalAmount || '-'}</b> ${payment?.currency || ''}</p>
      <p>Doctor: ${doctorName || '-'}</p>
      <p>If you did not request this, please ignore.</p>
    `;
    await sendEmail({
      to: target,
      subject: 'Your Hospital Payment OTP',
      html
    });
    return;
  }

  // Console fallback (dev)
  if (env.notifyDriver === 'console') {
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        type: 'payment_notification',
        event: type,
        paymentId: payment?._id || payment?.paymentId,
        method: payment?.paymentType?.type || 'N/A',
        status: payment?.status,
        totalAmount: payment?.totalAmount,
        target,
        meta,
        actor,
        patientName,
        doctorName
      })
    );
  }
}
