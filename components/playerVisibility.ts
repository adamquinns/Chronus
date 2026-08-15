/**
 * The ledger rewrite removed the state-graph change projection this module
 * used to wrap; the developer-audit flag is all that remains of it.
 */
export const isDeveloperAuditEnabled = (isDevelopment: boolean, flag?: string): boolean =>
  isDevelopment && flag === 'true';
