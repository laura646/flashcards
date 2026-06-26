// The single platform OWNER. Invited superadmins ("school administrators")
// have full superadmin powers EXCEPT inviting/removing other superadmins —
// that stays owner-only. Client-safe (no server deps) so both API routes and
// client components can import it.

export const OWNER_EMAIL = 'laura@englishwithlaura.com'

export function isOwner(email: string | null | undefined): boolean {
  return !!email && email.trim().toLowerCase() === OWNER_EMAIL
}
