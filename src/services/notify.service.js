// Minimal notification stub. Safe in tests and dev.
// Plug real email/SMS later (nodemailer, Twilio, etc).

import env from '../config/env.js';

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

  