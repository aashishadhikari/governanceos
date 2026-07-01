import type { Metadata } from 'next';
import './globals.css';
import SessionProvider from '@/components/auth/SessionProvider';
import AppShell from '@/components/layout/AppShell';
import LayoutWrapper from '@/components/layout/LayoutWrapper';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'iSend — Corporate Entities Governance Platform',
  description: 'Centralized entity management for iSend\'s regulated financial institutions',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 antialiased font-sans">
        <SessionProvider>
          <LayoutWrapper>{children}</LayoutWrapper>
        </SessionProvider>
      </body>
    </html>
  );
}