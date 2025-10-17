import Counter from '../models/Counter.js';

export async function nextPatientId() {
  const year = new Date().getFullYear();
  const key = `patient-${year}`;
  const doc = await Counter.findOneAndUpdate({ key }, { $inc: { seq: 1 } }, { new: true, upsert: true });
  const n = String(doc.seq).padStart(6, '0');
  return `PAT-${year}-${n}`;
}
export async function nextAppointmentId() {
  const year = new Date().getFullYear();
  // STYLE A (common): name = `${thing}-${year}`, seq increments
  const seqDoc = await Counter.findOneAndUpdate(
    { name: `appointment-${year}` },      // <- MATCH your patient code’s field
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );
  // STYLE B (if your file uses separate fields):
  // const seqDoc = await Counter.findOneAndUpdate(
  //   { key: 'appointment', year },
  //   { $inc: { seq: 1 } },
  //   { upsert: true, new: true }
  // );
  return `APT-${year}-${String(seqDoc.seq).padStart(6, '0')}`;
}