import type { Entity } from "@/lib/db/schema";

export interface EntityTreeNode extends Entity {
  children: EntityTreeNode[];
}

export function buildHierarchy(
  entities: Entity[]
): EntityTreeNode[] {
  const map = new Map<string, EntityTreeNode>();

  // Create lookup
  entities.forEach((entity) => {
    map.set(entity.id, {
      ...entity,
      children: [],
    });
  });

  const roots: EntityTreeNode[] = [];

  map.forEach((node) => {
    if (node.parentEntityId) {
      const parent = map.get(node.parentEntityId);

      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    } else {
      roots.push(node);
    }
  });

  return roots;
}