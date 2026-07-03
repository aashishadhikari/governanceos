
'use client';

import type { Entity } from '@/lib/db/schema';

function Card({ entity }: { entity: Entity }) {
  const score = entity.healthScore;
  const [bg, fg] =
    score == null
      ? ['', '']
      : score >= 80
      ? ['#dcfce7', '#166534']
      : score >= 60
      ? ['#fef3c7', '#92400e']
      : ['#fee2e2', '#991b1b'];

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm min-w-[240px]">
      <div className="bg-blue-900 px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-white">{entity.name}</div>
          {score != null && (
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-bold"
              style={{ backgroundColor: bg, color: fg }}
            >
              {score}
            </span>
          )}
        </div>
      </div>

      <div className="px-3 py-2 text-xs text-gray-500">
        {entity.country}
      </div>
    </div>
  );
}

function Node({
  entity,
  entities,
}: {
  entity: Entity;
  entities: Entity[];
}) {
  const children = entities.filter(e => e.parentEntityId === entity.id);

  return (
    <div className="flex flex-col items-center">
      <Card entity={entity} />

      {children.length > 0 && (
        <>
          <div className="h-5 w-px bg-gray-300" />

          <div className="flex gap-8 items-start relative">
            {children.map(child => (
              <Node
                key={child.id}
                entity={child}
                entities={entities}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function VisualOrgChart({
  entities,
}: {
  entities: Entity[];
}) {
  const active = entities.filter(e => e.status !== 'dissolved');

  const roots = active.filter(e => !e.parentEntityId);

  if (!roots.length) {
    return (
      <p className="p-4 text-sm text-gray-500">
        No root entities found.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center">
        <p className="text-xs text-gray-400">
          {active.length} entities · {roots.length} root entities
        </p>

        <button
          onClick={() => window.print()}
          className="ml-auto rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm hover:bg-gray-50"
        >
          Print / PDF
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-slate-50 p-8">
        <div className="flex gap-16 items-start">
          {roots.map(root => (
            <Node
              key={root.id}
              entity={root}
              entities={active}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
