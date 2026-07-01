import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import prisma from '@/lib/prisma';
import { hashToken } from '@/lib/auth/token';
import { UserTokenType } from '@prisma/client';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      token,
      password,
      confirmPassword,
    } = body as {
      token: string;
      password: string;
      confirmPassword: string;
    };

    if (!token || !password || !confirmPassword) {
      return NextResponse.json(
        { error: 'Missing required fields.' },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: 'Passwords do not match.' },
        { status: 400 }
      );
    }

    const hashedToken = hashToken(token);

    const invitation = await prisma.userToken.findFirst({
      where: {
        hashedToken,
        type: UserTokenType.INVITATION,
      },
      include: {
        user: true,
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invalid invitation link.' },
        { status: 400 }
      );
    }

    if (invitation.usedAt) {
      return NextResponse.json(
        { error: 'This invitation has already been used.' },
        { status: 400 }
      );
    }

    if (invitation.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'This invitation has expired.' },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.$transaction([
      prisma.user.update({
        where: {
          id: invitation.userId,
        },
        data: {
          passwordHash,
          mustChangePassword: false,
          failedLoginAttempts: 0,
        },
      }),

      prisma.userToken.update({
        where: {
          id: invitation.id,
        },
        data: {
          usedAt: new Date(),
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
    });

  } catch (error) {

    console.error('[POST /api/setup-password]', error);

    return NextResponse.json(
      {
        error: 'Internal Server Error',
      },
      {
        status: 500,
      }
    );
  }
}