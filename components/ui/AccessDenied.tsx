import Link from 'next/link';
import { Lock } from 'lucide-react';

interface AccessDeniedProps {
  message: string;
  requiredPermission?: string;
  backHref?: string;
  backLabel?: string;
}

export default function AccessDenied({
  message,
  requiredPermission,
  backHref = '/dashboard',
  backLabel = 'Back to Dashboard',
}: AccessDeniedProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center min-h-[60vh] px-6">
      <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
        <Lock className="w-6 h-6 text-red-500" />
      </div>

      <h1 className="text-lg font-semibold text-gray-900">Access Denied</h1>
      <p className="text-sm text-gray-500 mt-2 max-w-sm">{message}</p>

      {requiredPermission && (
        <code className="mt-4 px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded font-mono">
          {requiredPermission}
        </code>
      )}

      <Link
        href={backHref}
        className="mt-6 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
      >
        {backLabel}
      </Link>
    </div>
  );
}
