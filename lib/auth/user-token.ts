import prisma from '../prisma';
import { UserTokenType } from '@prisma/client';
import { generateToken, hashToken } from './token';

const INVITATION_EXPIRY_HOURS = 24;

export async function createInvitation(userId: string) {
  // Remove any previous unused invitation tokens
  await prisma.userToken.deleteMany({
    where: {
      userId,
      type: UserTokenType.INVITATION,
      usedAt: null,
    },
  });

  // Generate a new token
  const token = generateToken();

  // Store only the hash
  const hashedToken = hashToken(token);

  // Set expiry
  const expiresAt = new Date(
    Date.now() + INVITATION_EXPIRY_HOURS * 60 * 60 * 1000
  );

  // Save to database
  await prisma.userToken.create({
    data: {
      userId,
      type: UserTokenType.INVITATION,
      hashedToken,
      expiresAt,
    },
  });

  // Return the raw token so it can be emailed
  return {
    token,
    expiresAt,
  };
}