'use client';

import type { EntityTreeNode } from './hierarchy';

interface EntityNodeProps {
  node: EntityTreeNode;
}

export default function EntityNode({ node }: EntityNodeProps) {
  const score = node.healthScore;

  const [badgeBg, badgeText] =
    score == null
      ? ['bg-gray-100', 'text-gray-500']
      : score >= 80
      ? ['bg-green-100', 'text-green-700']
      : score >= 60
      ? ['bg-yellow-100', 'text-yellow-700']
      : ['bg-red-100', 'text-red-700'];

  return (
    <div className="w-[270px] rounded-2xl border border-slate-300 bg-white shadow-lg hover:shadow-lg transition-shadow">

      {/* Header */}
      <div className="rounded-t-xl bg-gradient-to-r from-blue-900 to-indigo-800 px-4 py-3 flex items-center justify-between">

        <div className="text-sm font-semibold text-white truncate">
          {node.name}
        </div>

        {score != null && (
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${badgeBg} ${badgeText}`}
          >
            {score}
          </span>
        )}

      </div>

      {/* Body */}

      <div className="space-y-2 p-3 text-xs">

        <div>
          <span className="font-medium text-slate-500">Country</span>
          <div>{node.country}</div>
        </div>

        <div>
          <span className="font-medium text-slate-500">Structure</span>
          <div>{node.legalStructure}</div>
        </div>

        <div className="flex items-center justify-between">

          <span
            className={`rounded-full px-2 py-0.5 text-[11px]
              ${
                node.status === 'active'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-600'
              }`}
          >
            {node.status}
          </span>

          {node.children.length > 0 && (
            <span className="text-slate-400">
              {node.children.length} Subsidiar{node.children.length === 1 ? 'y' : 'ies'}
            </span>
          )}

        </div>

      </div>

    </div>
  );
}