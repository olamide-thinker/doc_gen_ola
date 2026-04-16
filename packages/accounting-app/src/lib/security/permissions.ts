import type { MemberRole, ProjectMember, PermissionAction } from './types';

// What each role is allowed to do
export const ROLE_PERMISSIONS: Record<MemberRole, PermissionAction[]> = {
  owner:  ['read', 'write', 'delete', 'share'],
  admin:  ['read', 'write', 'delete', 'share'],
  editor: ['read', 'write'],
  viewer: ['read'],
};

/**
 * Check if a role is allowed to perform an action.
 */
export function canDo(role: MemberRole | null, action: PermissionAction): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].includes(action);
}

/**
 * Resolve a user's role within a project.
 * Returns null if the user has no access.
 */
export function getProjectRole(
  userEmail: string,
  members: ProjectMember[],
  ownerEmail: string
): MemberRole | null {
  if (userEmail === ownerEmail) return 'owner';
  const member = members.find(m => m.email === userEmail);
  return member?.role ?? null;
}

/**
 * Check if a user can see a folder based on its member list.
 */
export function canAccessFolder(userEmail: string, folderMembers: string[]): boolean {
  return folderMembers.includes(userEmail);
}

/**
 * Check if a user can open a document based on its member list.
 */
export function canAccessDocument(userEmail: string, docMembers: string[]): boolean {
  return docMembers.includes(userEmail);
}
