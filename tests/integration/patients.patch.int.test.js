import request from 'supertest';
import app from '../../src/app.js';
import { createUser, issueToken } from '../helpers/auth.js';

function basePatient() {
  return {
    personal: { firstName: 'Jane', lastName: 'Smith', dob: '1992-03-10', age: 32, gender: 'FEMALE' },
    contact: { address: '9 B Road', phone: '+94771234567', email: 'jane@example.com' },
    medical: { history: '', allergies: [], conditions: [] },
    documents: []
  };
}

describe('Patients -> patch', () => {
  let token;
  beforeEach(async () => {
    const staff = await createUser({ email: 'staff@example.com', role: 'STAFF', password: 'secret' });
    token = issueToken(staff);
  });

  test('updates contact + medical fields', async () => {
    const created = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${token}`)
      .send(basePatient());

    const pid = created.body.patientId;

    const patchRes = await request(app)
      .patch(`/api/patients/${pid}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        contact: { phone: '+94770000000' },
        medical: { allergies: ['Penicillin'] }
      });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.patient.contact.phone).toBe('+94770000000');
    expect(patchRes.body.patient.medical.allergies).toContain('Penicillin');
  });
});
