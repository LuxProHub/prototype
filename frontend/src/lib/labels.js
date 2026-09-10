/**
 * Human-readable labels for the enum values the API speaks in.
 *
 * The API says COMPLETED_WITH_ERRORS and DATA_PROCESSOR because those are
 * stable identifiers. The interface says "Completed with errors" and "Data
 * processor" because those are words. One place for the translation, so a
 * badge on Jobs and a badge on Team agree.
 */
export const ROLE_LABEL = {
  VIEWER: 'Viewer',
  DATA_PROCESSOR: 'Data processor',
  ADMIN: 'Admin',
  CCO: 'CCO',
  CEO: 'CEO',
  DEVELOPER: 'Developer',
};

export function humanize(value) {
  if (value == null || value === '') return '';
  const s = String(value);
  if (ROLE_LABEL[s]) return ROLE_LABEL[s];
  return s
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());
}
