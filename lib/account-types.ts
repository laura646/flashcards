// Student account-type segmentation (B2B / B2C / Partly B2B / CSR).
// Shared by the admin students views and the superadmin students list so the
// labels and badge colors never drift between surfaces.

export const ACCOUNT_TYPES = ['B2B', 'B2C', 'Partly B2B', 'CSR'] as const
export type AccountType = (typeof ACCOUNT_TYPES)[number]

export const ACCOUNT_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  'B2B': { bg: '#e6f1fb', text: '#0c447c' },
  'B2C': { bg: '#eaf3de', text: '#27500a' },
  'Partly B2B': { bg: '#faeeda', text: '#633806' },
  'CSR': { bg: '#fbeaf0', text: '#72243e' },
}
