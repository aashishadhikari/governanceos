'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Building2, LayoutDashboard, Calendar, FileText,
  Users, TrendingUp, Bell, ChevronRight, Shield,
  Globe, BookOpen, ClipboardList,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: boolean;
  children?: { href: string; label: string }[];
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/entities', label: 'Entities', icon: Building2 },
  { href: '/directors', label: 'Directors', icon: Users },
  {
    href: '/compliance',
    label: 'Compliance & Finance',
    icon: Calendar,
    children: [
      { href: '/compliance/regulatory-calendar', label: 'Regulatory Calendar' },
    ],
  },
  { href: '/licenses', label: 'Licenses', icon: Shield },
  { href: '/capital', label: 'Regulatory Capital', icon: TrendingUp },
  { href: '/alerts', label: 'Alerts', icon: Bell, badge: true },
  { href: '/documents', label: 'Document Vault', icon: FileText },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 min-h-screen bg-slate-900 text-white flex flex-col shrink-0">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-slate-700">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
            <Globe className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-white text-sm leading-tight">EntityOS</p>
            <p className="text-slate-400 text-xs">Nium Global Governance</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon, badge, children }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/');
          return (
            <div key={href}>
              <Link
                href={href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group',
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1">{label}</span>
                {badge && (
                  <span className="w-2 h-2 bg-red-400 rounded-full" />
                )}
                {isActive && <ChevronRight className="w-3.5 h-3.5 opacity-60" />}
              </Link>
              {/* Sub-links — shown when parent section is active */}
              {isActive && children && children.length > 0 && (
                <div className="ml-7 mt-0.5 space-y-0.5 border-l border-slate-700 pl-3">
                  {children.map(child => {
                    const childActive = pathname === child.href || pathname.startsWith(child.href + '/');
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={cn(
                          'block px-3 py-2 rounded-lg text-xs font-medium transition-all',
                          childActive
                            ? 'bg-indigo-500/20 text-indigo-200'
                            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                        )}
                      >
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-xs font-bold text-white">
            P
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">Prajit Nanu</p>
            <p className="text-xs text-slate-400 truncate">Admin</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
