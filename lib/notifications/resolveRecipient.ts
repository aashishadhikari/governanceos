// Shared best-effort lookups that turn a free-text or cross-model reference
// into a real User.id so createNotification() has a recipient to write to.
// Originally local to the Submissions route (resolveSubmitterId); extracted
// here once Compliance and Board Meetings needed the same lookup, per the
// "resolve or silently skip — never guess" rule documented in
// docs/security/08-notification-platform.md.

import prisma from '@/lib/prisma';

// ComplianceObligation.owner and (historically) Submission.submittedBy are
// free-text Strings, not a User.id FK. Resolves by email first, then by
// display name. Returns null if neither matches — callers must skip the
// notification rather than guess a recipient.
export async function resolveUserByEmailOrName(value: string): Promise<string | null> {
  const byEmail = await prisma.user.findUnique({ where: { email: value }, select: { id: true } });
  if (byEmail) return byEmail.id;

  const byName = await prisma.user.findFirst({ where: { name: value }, select: { id: true } });
  return byName?.id ?? null;
}

// Director is a separate model from User (most directors have no platform
// login at all). Resolves a director's optional email to a matching User.
// Returns null if there's no email on file or no matching account — this is
// the expected, common case for external board members, not an error.
export async function resolveUserByEmail(email: string | null | undefined): Promise<string | null> {
  if (!email) return null;
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  return user?.id ?? null;
}
