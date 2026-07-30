import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createInvitation } from '@/lib/auth/user-token';
import { writeRequestAuditLog } from '@/lib/audit';
import { sendPasswordResetEmail } from '@/lib/email';
import { authorizeRequest } from '@/lib/auth/session';
import { PermissionCodes } from '@/lib/auth/permission-codes';

interface Props {
  params: Promise<{ id: string }>;
}

// POST /api/users/:id/resend-invitation
// Generates a fresh password setup link and emails it to the user.
// Any previously unused invitation tokens are invalidated first.
export async function POST(
  request: NextRequest,
  { params }: Props,
) {
  try {
    const denied = await authorizeRequest(PermissionCodes.USER_PASSWORD_RESET_SEND);
    if (denied) return denied;

    const { id } = await params;

    // Ensure the user exists.
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 },
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Cannot reset password for an inactive user.' },
        { status: 400 },
      );
    }

    // Invalidate all unused invitation tokens.
    await prisma.userToken.updateMany({
      where: {
        userId: id,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });

    // Generate a fresh invitation.
    const invitation = await createInvitation(user.id);

    const invitationUrl =
      `http://localhost:3000/setup-password?token=${invitation.token}`;

    // Send the email.
    await sendPasswordResetEmail(
      user.name,
      user.email,
      invitationUrl,
    );

    // Record the action in the audit trail.
    await writeRequestAuditLog(request, {
      action: 'UPDATE',
      tableName: 'users',
      recordId: user.id,
      newValues: {
        passwordResetEmailSent: true,
      },
      notes: 'Password setup email re-issued by administrator',
    });

    return NextResponse.json({
      success: true,
    });

  } catch (err) {
    console.error('[POST /api/users/:id/resend-invitation]', err);

    return NextResponse.json(
      {
        error: 'Failed to resend invitation.',
      },
      {
        status: 500,
      },
    );
  }
}