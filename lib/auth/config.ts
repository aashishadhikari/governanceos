// EntityOS — NextAuth v4 Configuration
// Provider: Okta OIDC >> removed
// Role resolution: Okta group → EntityOS role mapping >> changed to get credentials from db

import type { NextAuthOptions, DefaultSession } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcrypt';
import prisma from '@/lib/prisma';
import type { UserRole } from '@prisma/client';



// ─── Type augmentation ────────────────────────────────────────────────────────

declare module 'next-auth' {
  interface User {
    id: string;
    role: UserRole;
    department: string | null;
    title: string | null;
  }

  interface Session {
    user: {
      id: string;
      role: UserRole;
      department: string;
      title: string;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string;
    role?: UserRole;
    department?: string;
    title?: string;
  }
}

// ─── Okta group → EntityOS role mapping ────── >> commented
/* const OKTA_GROUP_ROLE_MAP: Record<string, UserRole> = {
//   'EntityOS-SuperAdmin': 'super_admin',
//   'EntityOS-Admin':      'admin',
//   'EntityOS-Legal':      'legal',
//   'EntityOS-Finance':    'finance',
//   'EntityOS-Viewer':     'viewer',
};
*/

// Priority order — highest privilege wins when a user is in multiple groups
/* const ROLE_PRIORITY: UserRole[] = ['super_admin', 'admin', 'legal', 'finance', 'viewer'];

// function resolveRoleFromGroups(groups: string[]): UserRole | null {
//   const mapped = groups
//     .map(g => OKTA_GROUP_ROLE_MAP[g])
//     .filter((r): r is UserRole => !!r);

  // Return the highest-priority role found
//   return ROLE_PRIORITY.find(r => mapped.includes(r)) ?? null;
} */

// ─── Auth options ─────────────────────────────────────────────────────────────

export const authOptions: NextAuthOptions = {
  providers: [
    /*OktaProvider({
      clientId:     process.env.OKTA_CLIENT_ID!,
      clientSecret: process.env.OKTA_CLIENT_SECRET!,
      issuer:       process.env.OKTA_ISSUER!,
      // Request groups claim from Okta (must be configured in Okta app to send groups)
      authorization: { params: { scope: 'openid profile email groups' } },
    }),
    */
    CredentialsProvider({
      name: 'Credentials',

      credentials: {
        email: {
          label: 'Email',
          type: 'email',
        },

        password: {
          label: 'Password',
          type: 'password',
        },
      },

      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email,
          },
        });

        if (!user) {
          return null;
        }

        if (!user.isActive) {
          return null;
        }

        const passwordMatches = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );

        if (!passwordMatches) {
          return null;
        }

        await prisma.user.update({
          where: {
            id: user.id,
          },
          data: {
            lastLoginAt: new Date(),
            failedLoginAttempts: 0,
          },
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department,
          title: user.title,
        };
      },
    }),

  ],

  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60,   // 8-hour session
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  /* removed Okta group mapping and session callbacks; now using database credentials only
  callbacks: {
    async jwt({ token, user, account, profile }) {
      // Only runs on first sign-in (account + profile are populated)
      if (account && profile) {
        const groups: string[] = (profile as any).groups ?? [];

        // Resolve role from Okta group membership
        const groupRole = resolveRoleFromGroups(groups);

        // Also check email-based user record for metadata (department, title)
        const email = user?.email ?? token.email ?? '';
        const appUser = email ? getUserByEmail(email) : undefined;

        if (appUser) {
          token.userId = appUser.id;
          token.department = appUser.department;
          token.title = appUser.title;
          updateUser(appUser.id, { lastLoginAt: new Date().toISOString() });
        }

        // Group mapping takes priority; fall back to email-based role, then viewer
        token.role = groupRole ?? appUser?.role ?? 'viewer';
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId ?? token.sub ?? '';
        session.user.role = token.role ?? 'viewer';
        session.user.department = token.department ?? '';
        session.user.title = token.title ?? '';
      }
      return session;
    },
  },
  */
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.role = user.role;
        token.department = user.department ?? '';
        token.title = user.title ?? '';
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId ?? '';
        session.user.role = (token.role as UserRole) ?? 'viewer';
        session.user.department = token.department ?? '';
        session.user.title = token.title ?? '';
      }

      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
};
