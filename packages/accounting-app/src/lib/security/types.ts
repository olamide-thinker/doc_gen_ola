// Member roles — ordered from most to least privileged
export type MemberRole = 'owner' | 'admin' | 'editor' | 'viewer';

// What actions can be performed on a resource
export type PermissionAction = 'read' | 'write' | 'delete' | 'share';

// A member of a project with their assigned role
export interface ProjectMember {
  email: string;
  role: MemberRole;
  addedAt: string;
}

// Access control entry for a folder — which emails can see it
export interface FolderAccess {
  folderId: string;
  allowedEmails: string[];
}

// A resource (project, folder, document) with its permission metadata
export interface ResourcePermissions {
  ownerId: string;       // Firebase UID of the owner
  ownerEmail: string;    // Email of the owner
  members: ProjectMember[];
}
