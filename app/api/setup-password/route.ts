import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      token,
      password,
      confirmPassword,
    } = body;

    if (!token || !password || !confirmPassword) {
      return NextResponse.json(
        {
          error: 'Missing required fields.',
        },
        {
          status: 400,
        }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        {
          error: 'Passwords do not match.',
        },
        {
          status: 400,
        }
      );
    }

    return NextResponse.json({
      success: true,
    });

  } catch (error) {

    console.error(error);

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