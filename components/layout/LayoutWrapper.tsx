'use client';

import { usePathname } from 'next/navigation';
import AppShell from './AppShell';

export default function LayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const publicRoutes = [
    '/login',
    '/setup-password',
  ];

  const isPublicRoute = publicRoutes.some((route) =>
    pathname === route || pathname.startsWith(route + '?')
  );

  if (isPublicRoute) {
    return <>{children}</>;
  }

  return <AppShell>{children}</AppShell>;
}