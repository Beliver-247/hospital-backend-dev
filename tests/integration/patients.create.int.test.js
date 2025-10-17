import request from 'supertest';
import app from '../../src/app.js';
import { createUser, issueToken } from '../helpers/auth.js';

function samplePatient(overrides = {}) {
  return {
    personal: { firstName: 'John', lastName: 'Doe', dob: '1990-05-01', age: 34, gender: 'MALE', nic: 'NIC-001' },
    contact: { address: '123 A St', phone: '+94770000001', email: 'john@example.com' },
    medical: { history: '', allergies: [], conditions: [] },
    documents: [{ type: 'ID', url: 'http://localhost/uploads/abc.pdf' }],
    ...overrides
  };
}

describe('Patients -> validate/create/get', () => {
  let token;
  beforeEach(async () => {
    const doc = await createUser({ email: 'doc@example.com', role: 'DOCTOR', password: 'secret' });
    token = issueToken(doc);
  });

  test('validate returns no errors for clean data', async () => {
    const res = await request(app)
      .post('/api/patients/validate')
      .set('Authorization', `Bearer ${token}`)
      .send(samplePatient());

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('fieldErrors');
    expect(Array.isArray(res.body.duplicates)).toBe(true);
  });

  test('create then fetch by patientId', async () => {
    const createRes = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${token}`)
      .send(samplePatient());

    expect(createRes.status).toBe(201);
    expect(createRes.body).toHaveProperty('patientId');

    const pid = createRes.body.patientId;

    const getRes = await request(app)
      .get(`/api/patients/${pid}`)
      .set('Authorization', `Bearer ${token}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.patientId).toBe(pid);
    expect(getRes.body.personal.firstName).toBe('John');
  });
});
