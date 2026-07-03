'use client';

import { buildHierarchy } from './hierarchy';
import type { EntityTreeNode } from './hierarchy';
import EntityNode from './EntityNode';
import type { Entity } from '@/lib/db/schema';

interface Props {
  entities: Entity[];
}

function Tree({ node }: { node: EntityTreeNode }) {
  return (
    <div className="flex flex-col items-center">

      {/* Parent Card */}
      <EntityNode node={node} />

      {node.children.length > 0 && (
        <>
          {/* Vertical line */}
          <div className="w-px h-12 bg-slate-300" />

          {/* Children */}
          <div className="flex flex-col items-center">

            {/* Horizontal connector */}
            <svg
              width={Math.max(node.children.length * 260, 260)}
              height="24"
              className="overflow-visible"
            >
              {/* Horizontal */}
              <line
                x1="20"
                y1="1"
                x2={Math.max(node.children.length * 260 - 20, 240)}
                y2="1"
                stroke="#cbd5e1"
                strokeWidth="1.5"
              />

              {node.children.map((_, index) => {
                const spacing =
                  Math.max(node.children.length * 260, 260) /
                  node.children.length;

                const x = spacing / 2 + spacing * index;

                return (
                  <line
                    key={index}
                    x1={x}
                    y1="1"
                    x2={x}
                    y2="24"
                    stroke="#cbd5e1"
                    strokeWidth="1.5"
                  />
                );
              })}
            </svg>

            <div className="flex gap-14 items-start">
              {node.children.map(child => (
                <Tree
                  key={child.id}
                  node={child}
                />
              ))}
            </div>

          </div>
        </>
      )}

    </div>
  );
}

export default function VisualOrgChart({
  entities,
}: Props) {

  const active = entities.filter(
    e => e.status !== 'dissolved'
  );

  const roots = buildHierarchy(active);

  return (
    <div className="space-y-6">

      <div className="flex items-center">

        <div className="text-sm text-slate-500">
          {active.length} entities · {roots.length} parent entities
        </div>

      </div>

      <div className="overflow-x-auto rounded-xl border bg-gradient-to-b from-slate-50 to-white">
        <div className="inline-flex items-start gap-12 px-24 py-10 min-w-max">

          {roots.map(root => (
            <div
              key={root.id}
              className={`flex-shrink-0 flex justify-center ${root.children.length
                  ? 'min-w-[900px]'
                  : 'min-w-[420px]'
                }`}
            >
              <Tree node={root} />
            </div>
          ))}

        </div>
      </div>

    </div>
  );
}