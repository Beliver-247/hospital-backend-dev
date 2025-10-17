import { nextPatientId } from '../../src/services/id.service.js';

describe('nextPatientId', () => {
  it('generates incremental patient IDs with correct format', async () => {
    const id1 = await nextPatientId();
    const id2 = await nextPatientId();
    expect(id1).toMatch(/^PAT-\d{4}-\d{6}$/);
    expect(id2).toMatch(/^PAT-\d{4}-\d{6}$/);
    expect(id1).not.toBe(id2);
  });
});
