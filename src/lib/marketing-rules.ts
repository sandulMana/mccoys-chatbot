export const RETENTION_DAYS = 30;
export const CHANGE_CATEGORIES = ['Price / offer', 'Photo', 'Dates', 'Wording / typos', 'Layout', 'Logo size'] as const;
export function deletionDeadline(approvedAt: string) {
  return new Date(new Date(approvedAt).getTime() + RETENTION_DAYS * 86400000).toISOString();
}
export function isDueForDeletion(deleteAt: string | null, now = Date.now()) {
  return deleteAt !== null && new Date(deleteAt).getTime() <= now;
}
export function daysRemaining(deleteAt: string, now = Date.now()) {
  return Math.max(0, Math.ceil((new Date(deleteAt).getTime() - now) / 86400000));
}
export function validateReviewFile(bytes: Uint8Array, kind: 'png' | 'psd') {
  if (bytes.length < 8 || bytes.length > 30 * 1024 * 1024) throw new Error('Each file must be smaller than 30 MB.');
  const signature = kind === 'png' ? [137,80,78,71,13,10,26,10] : [56,66,80,83,0,1];
  if (!signature.every((value, index) => bytes[index] === value)) throw new Error(`Select a valid ${kind.toUpperCase()} file.`);
}