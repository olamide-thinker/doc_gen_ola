/**
 * workspace-persist.ts
 *
 * Explicit persistence layer for workspace data (folders, documents, projects).
 *
 * WHY THIS EXISTS:
 * The app uses Hocuspocus (CRDT WebSocket) for real-time sync. Hocuspocus only
 * calls onStoreDocument when clients disconnect or after an idle timeout — NOT on
 * every mutation. This means a page refresh before that event fires = data loss.
 *
 * This module sends every mutation directly to the backend REST API immediately,
 * so data is in Firebase before the user can refresh. It's fire-and-forget (errors
 * are logged but never block the UI), so it never slows down the user's experience.
 * The Hocuspocus sync still runs in parallel and handles multi-user collaboration.
 */

import type { WorkspaceFolder, WorkspaceDocument, WorkspaceProject } from '../store';

export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:1234/api';

// Get current user's Firebase ID token for authenticating backend calls
export async function authHeaders(): Promise<HeadersInit> {
  try {
    const { auth } = await import('./firebase');
    const user = auth.currentUser;
    if (!user) return { 'Content-Type': 'application/json' };
    const token = await user.getIdToken();
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  } catch {
    return { 'Content-Type': 'application/json' };
  }
}

async function post(path: string, body: unknown): Promise<void> {
  const headers = await authHeaders();
  await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  }).catch(e => console.warn(`[Persist] POST ${path} failed:`, e));
}

async function patch(path: string, body: unknown): Promise<void> {
  const headers = await authHeaders();
  await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  }).catch(e => console.warn(`[Persist] PATCH ${path} failed:`, e));
}

async function del(path: string): Promise<void> {
  const headers = await authHeaders();
  await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers,
  }).catch(e => console.warn(`[Persist] DELETE ${path} failed:`, e));
}

export const workspacePersist = {
  // --- Folders ---

  upsertFolder(projectId: string, folder: WorkspaceFolder): void {
    post(`/workspace/${projectId}/folders`, folder);
  },

  deleteFolder(projectId: string, folderId: string): void {
    del(`/workspace/${projectId}/folders/${folderId}`);
  },

  updateFolderMembers(projectId: string, folderId: string, members: string[]): void {
    patch(`/workspace/${projectId}/folders/${folderId}/members`, { members });
  },

  // --- Documents ---

  upsertDocument(projectId: string, document: WorkspaceDocument): void {
    post(`/workspace/${projectId}/documents`, document);
  },

  deleteDocument(projectId: string, documentId: string): void {
    del(`/workspace/${projectId}/documents/${documentId}`);
  },

  updateDocumentMembers(projectId: string, documentId: string, members: string[]): void {
    patch(`/workspace/${projectId}/documents/${documentId}/members`, { members });
  },

  // --- Projects (upsert to the business-level, but keyed by projectId for routing) ---

  upsertProject(projectId: string, project: WorkspaceProject): void {
    post(`/workspace/${projectId}/projects`, project);
  },

  deleteProject(projectId: string, targetProjectId: string): void {
    del(`/workspace/${projectId}/projects/${targetProjectId}`);
  },

  updateProjectMembers(projectId: string, targetProjectId: string, members: string[]): void {
    patch(`/workspace/${projectId}/projects/${targetProjectId}/members`, { members });
  },
};
