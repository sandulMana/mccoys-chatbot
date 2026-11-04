import { describe, expect, it } from 'vitest';
import { deletionDeadline, isDueForDeletion, validateReviewFile } from '@/lib/marketing-rules';
describe('Marketing retention', () => {
  it('deletes 30 days after approval', () => {
    expect(deletionDeadline('2026-11-04T23:20:00.000Z')).toBe('2026-12-04T23:20:00.000Z');
  });
  it('does not delete an unapproved submission', () => {
    expect(isDueForDeletion(null, Date.parse('2027-01-01'))).toBe(false);
  });
  it('keeps approved files until their deadline and expires at the deadline', () => {
    const deadline = '2026-12-04T23:20:00.000Z';
    expect(isDueForDeletion(deadline, Date.parse(deadline) - 1)).toBe(false);
    expect(isDueForDeletion(deadline, Date.parse(deadline))).toBe(true);
  });
  it('rejects a renamed non-Photoshop file', () => {
    expect(() => validateReviewFile(new Uint8Array([137,80,78,71,13,10,26,10]), 'psd')).toThrow('valid PSD');
  });
});