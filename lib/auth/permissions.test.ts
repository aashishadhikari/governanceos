import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Session } from 'next-auth';

// Mock the Prisma singleton before importing the module under test, so
// permissions.ts never touches a real database connection. Only the one
// Prisma call permissions.ts actually makes (rolePermission.findMany) is
// mocked — nothing else is needed for these tests.
const findManyMock = vi.fn();

vi.mock('@/lib/prisma', () => ({
  default: {
    rolePermission: {
      findMany: (...args: unknown[]) => findManyMock(...args),
    },
  },
}));

// vi.mock() calls are hoisted above imports by Vitest, so this import
// receives the mocked prisma module above rather than a real connection.
import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  requirePermission,
  PermissionError,
} from './permissions';

// ─── Test helpers ───────────────────────────────────────────────────────────

// Builds a minimal, valid Session for a given roleId. Only the fields
// permissions.ts actually reads (session.user.roleId) are meaningful here;
// the rest exist to satisfy the Session type.
function makeSession(roleId: string | null): Session {
  return {
    user: {
      id: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      role: 'viewer',
      roleId,
      department: '',
      title: '',
    },
    expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  } as Session;
}

// Mimics the shape prisma.rolePermission.findMany({ select: { permission: { select: { code: true } } } })
// actually returns, so the mock matches production shape rather than a
// simplified stand-in. Uses mockResolvedValue (not -Once) because there is
// no caching in permissions.ts — each permission check for the same role
// re-queries the database independently, so a test that checks several
// codes against one role needs the same result on every call.
function mockRolePermissions(codes: string[]) {
  findManyMock.mockResolvedValue(
    codes.map((code) => ({ permission: { code } }))
  );
}

beforeEach(() => {
  findManyMock.mockReset();
});

// ─── Session handling ───────────────────────────────────────────────────────

describe('session handling', () => {
  it('treats a null session as having no permissions', async () => {
    const result = await hasPermission(null, 'entity.view');
    expect(result).toBe(false);
  });

  it('does not query the database for a null session', async () => {
    await hasPermission(null, 'entity.view');
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it('treats a session without a roleId as having no permissions', async () => {
    const session = makeSession(null);
    const result = await hasPermission(session, 'entity.view');
    expect(result).toBe(false);
  });

  it('does not query the database for a session without a roleId', async () => {
    const session = makeSession(null);
    await hasPermission(session, 'entity.view');
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it('queries the database for a valid session with a roleId', async () => {
    mockRolePermissions(['entity.view']);
    const session = makeSession('role-1');

    await hasPermission(session, 'entity.view');

    expect(findManyMock).toHaveBeenCalledTimes(1);
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { roleId: 'role-1' } })
    );
  });
});

// ─── Permission resolution ──────────────────────────────────────────────────

describe('permission resolution', () => {
  it('resolves false for every code when the role has zero permissions', async () => {
    mockRolePermissions([]);
    const session = makeSession('role-1');

    expect(await hasPermission(session, 'entity.view')).toBe(false);
  });

  it('resolves true for the one permission a role has', async () => {
    mockRolePermissions(['entity.view']);
    const session = makeSession('role-1');

    expect(await hasPermission(session, 'entity.view')).toBe(true);
  });

  it('resolves correctly across a role with multiple permissions', async () => {
    mockRolePermissions(['entity.view', 'entity.edit', 'compliance.view']);
    const session = makeSession('role-1');

    expect(await hasPermission(session, 'entity.edit')).toBe(true);
    expect(await hasPermission(session, 'compliance.view')).toBe(true);
    expect(await hasPermission(session, 'entity.delete')).toBe(false);
  });

  it('returns false for a permission code that does not exist in the catalog', async () => {
    mockRolePermissions(['entity.view']);
    const session = makeSession('role-1');

    expect(await hasPermission(session, 'not.a.real.permission')).toBe(false);
  });
});

// ─── hasPermission() ────────────────────────────────────────────────────────

describe('hasPermission()', () => {
  it('returns true when the permission exists', async () => {
    mockRolePermissions(['document.upload']);
    const session = makeSession('role-1');

    expect(await hasPermission(session, 'document.upload')).toBe(true);
  });

  it('returns false when the permission does not exist', async () => {
    mockRolePermissions(['document.upload']);
    const session = makeSession('role-1');

    expect(await hasPermission(session, 'document.delete')).toBe(false);
  });
});

// ─── hasAnyPermission() ─────────────────────────────────────────────────────

describe('hasAnyPermission()', () => {
  it('returns true when at least one requested permission matches', async () => {
    mockRolePermissions(['entity.view']);
    const session = makeSession('role-1');

    const result = await hasAnyPermission(session, ['entity.delete', 'entity.view']);

    expect(result).toBe(true);
  });

  it('returns false when none of the requested permissions match', async () => {
    mockRolePermissions(['entity.view']);
    const session = makeSession('role-1');

    const result = await hasAnyPermission(session, ['entity.delete', 'entity.edit']);

    expect(result).toBe(false);
  });

  it('returns false for an empty permission list (documented: vacuously false — no code in an empty list can match)', async () => {
    mockRolePermissions(['entity.view']);
    const session = makeSession('role-1');

    expect(await hasAnyPermission(session, [])).toBe(false);
  });
});

// ─── hasAllPermissions() ────────────────────────────────────────────────────

describe('hasAllPermissions()', () => {
  it('returns true when every requested permission exists', async () => {
    mockRolePermissions(['entity.view', 'entity.edit']);
    const session = makeSession('role-1');

    const result = await hasAllPermissions(session, ['entity.view', 'entity.edit']);

    expect(result).toBe(true);
  });

  it('returns false when one requested permission is missing', async () => {
    mockRolePermissions(['entity.view']);
    const session = makeSession('role-1');

    const result = await hasAllPermissions(session, ['entity.view', 'entity.edit']);

    expect(result).toBe(false);
  });

  it('returns true for an empty permission list (documented: vacuously true — there are no required codes left unsatisfied)', async () => {
    mockRolePermissions(['entity.view']);
    const session = makeSession('role-1');

    expect(await hasAllPermissions(session, [])).toBe(true);
  });
});

// ─── requirePermission() ────────────────────────────────────────────────────

describe('requirePermission()', () => {
  it('resolves without throwing when the session is authorized', async () => {
    mockRolePermissions(['entity.edit']);
    const session = makeSession('role-1');

    await expect(requirePermission(session, 'entity.edit')).resolves.toBeUndefined();
  });

  it('throws PermissionError when the session is not authorized', async () => {
    mockRolePermissions(['entity.view']);
    const session = makeSession('role-1');

    await expect(requirePermission(session, 'entity.edit')).rejects.toThrow(PermissionError);
  });

  it('throws PermissionError for a null session', async () => {
    await expect(requirePermission(null, 'entity.edit')).rejects.toThrow(PermissionError);
  });
});

// ─── PermissionError ────────────────────────────────────────────────────────

describe('PermissionError', () => {
  it('carries the permission code that was missing', () => {
    const error = new PermissionError('entity.edit');
    expect(error.permissionCode).toBe('entity.edit');
  });

  it('has a message that names the missing permission', () => {
    const error = new PermissionError('entity.edit');
    expect(error.message).toBe('Missing permission: entity.edit');
  });

  it('preserves its instance type through instanceof checks', () => {
    const error = new PermissionError('entity.edit');
    expect(error).toBeInstanceOf(PermissionError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('PermissionError');
  });

  it('is the error type actually thrown by requirePermission()', async () => {
    mockRolePermissions([]);
    const session = makeSession('role-1');

    try {
      await requirePermission(session, 'entity.edit');
      expect.unreachable('requirePermission should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(PermissionError);
      expect((err as InstanceType<typeof PermissionError>).permissionCode).toBe('entity.edit');
    }
  });
});
