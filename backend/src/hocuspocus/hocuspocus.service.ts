import { Injectable, OnModuleInit, Inject, Logger } from '@nestjs/common';
import { Server } from '@hocuspocus/server';
import { DRIZZLE_PROVIDER } from '../database/database.provider';
import * as schema from '../db/schema';
import { eq, and, or, inArray } from 'drizzle-orm';
import { checkFirebaseInitialized } from '../config/firebase';
import { normalizeRole, canWrite } from '../projects/projects.controller';

@Injectable()
export class HocuspocusService implements OnModuleInit {
  private readonly logger = new Logger(HocuspocusService.name);
  private server: Server;

  constructor(@Inject(DRIZZLE_PROVIDER) private db: any) {}

  onModuleInit() {
    this.server = new Server({
      name: 'shan-doc-hocuspocus',
      
      onAuthenticate: async (data) => {
        const { token, documentName } = data;
        
        // 1. Authentication Check
        let userProfile: { 
          id: string; 
          email: string; 
          name?: string; 
          picture?: string 
        };
        
        if (!checkFirebaseInitialized()) {
          throw new Error('Firebase Admin SDK is not initialized');
        }

        if (!token) throw new Error('Unauthenticated');
        try {
          const admin = await import('firebase-admin');

          
          // Manual decode to see what's inside even if expired
          const parts = token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
            console.log(`[Hocuspocus Auth] 🛡️ Token Debug - EXP: ${new Date(payload.exp * 1000).toLocaleString()}, Now: ${new Date().toLocaleString()}`);
          }
          
          const decoded = await admin.auth().verifyIdToken(token);
          userProfile = { 
            id: decoded.uid, 
            email: decoded.email || '',
            name: decoded.name || '',
            picture: decoded.picture || ''
          };
        } catch (e: any) {
          try {
            const admin = await import('firebase-admin');
            const decodedFast = await admin.auth().verifyIdToken(token, false); // check without strictness if possible to see info
            console.error(`[Hocuspocus Auth] ❌ Token Info - Issued: ${new Date(decodedFast.iat * 1000).toLocaleString()}, Expiry: ${new Date(decodedFast.exp * 1000).toLocaleString()}, Server Time: ${new Date().toLocaleString()}`);
          } catch (e2) {
             // If we can't even decode it, just log the original error
          }
          console.error('[Hocuspocus Auth] ❌ Token validation failed:', e.message);
          throw new Error('Invalid token');
        }

        // 2. Authorization Check (Project Level)
        if (documentName.startsWith('project-')) {
          let projectId: string;
          if (documentName.startsWith('project-auth-')) {
            projectId = documentName.slice('project-auth-'.length);
          } else {
            projectId = documentName.slice('project-'.length);
          }

          // Special Case: Allow personal playground rooms for any authenticated user.
          // This enables synchronization to start so the first project can be saved.
          if (projectId.startsWith('playground-')) {
            const allowedId = `playground-${userProfile.id}`;
            if (projectId === allowedId) {
              return { user: userProfile };
            }
          }

          // Verify user is a member of this project (Check userId OR email)
          const member = await this.db.query.projectMembers.findFirst({
            where: and(
              eq(schema.projectMembers.projectId, projectId),
              or(
                eq(schema.projectMembers.userId, userProfile.id),
                eq(schema.projectMembers.email, userProfile.email)
              )
            )
          });

          if (!member) {
            // Check if user is the project owner
            const proj = await this.db.query.projects.findFirst({
              where: eq(schema.projects.id, projectId),
            });
            if (!proj || proj.ownerId !== userProfile.id) {
              throw new Error('Forbidden: Not a member of this project');
            }

            // Auto-add owner to projectMembers so future checks pass instantly
            if (userProfile.email) {
              try {
                await this.db.insert(schema.projectMembers)
                  .values({
                    projectId,
                    userId: userProfile.id,
                    email: userProfile.email,
                    role: 'owner',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  })
                  .onConflictDoUpdate({
                    target: [schema.projectMembers.projectId, schema.projectMembers.userId],
                    set: { updatedAt: new Date() }
                  });
              } catch (e) {
                // Non-critical
              }
            }
          } else if (member.userId === 'pending' || !member.userId) {
            // Heal the membership record with the real userId
            await this.db.update(schema.projectMembers)
              .set({ userId: userProfile.id, updatedAt: new Date() })
              .where(eq(schema.projectMembers.id, member.id));
          }
        }

        // 3. Authorization Check (Document Level for Invoices/Documents)
        // Resolve the doc's project and the caller's role within it. Viewers
        // and commenters get a read-only connection — they can still observe
        // live edits and presence, but any local Yjs writes are dropped by
        // the Hocuspocus server before broadcast.
        if (documentName.startsWith('doc-')) {
          const docId = documentName.slice('doc-'.length);

          // The doc may live in either invoices or legacy documents.
          let projectId: string | null = null;
          let ownerId: string | null = null;
          const inv = await this.db.query.invoices.findFirst({
            where: eq(schema.invoices.id, docId),
          });
          if (inv) {
            projectId = inv.projectId || null;
            ownerId = inv.userId || null;
          } else {
            const docRow = await this.db.query.documents.findFirst({
              where: eq(schema.documents.id, docId),
            });
            if (docRow) {
              projectId = docRow.projectId || null;
              ownerId = docRow.userId || null;
            }
          }

          // Brand-new draft (not yet persisted) — allow the author to write.
          if (!projectId) {
            return { user: userProfile };
          }

          // Resolve the caller's role within the parent project.
          let callerRole: ReturnType<typeof normalizeRole> = 'viewer';
          if (ownerId === userProfile.id) {
            callerRole = 'owner';
          } else {
            const member = await this.db.query.projectMembers.findFirst({
              where: and(
                eq(schema.projectMembers.projectId, projectId),
                or(
                  eq(schema.projectMembers.userId, userProfile.id),
                  eq(schema.projectMembers.email, userProfile.email),
                ),
              ),
            });
            if (!member) {
              throw new Error('Forbidden: Not a member of this project');
            }
            callerRole = normalizeRole(member.role);
          }

          // Read-only connection for viewer/commenter. Hocuspocus enforces
          // this by dropping any incoming Yjs update messages from the client
          // before they reach the document.
          if (!canWrite(callerRole)) {
            data.connectionConfig.readOnly = true;
            console.log(
              `[Hocuspocus Auth] 👁️ ${userProfile.email} joined ${documentName} as ${callerRole} (read-only)`,
            );
          }

          return { user: { ...userProfile, role: callerRole } };
        }

        return { user: userProfile };
      },

      onLoadDocument: async (data) => {
        const { documentName, document } = data;
        const user = data.context?.user;

        try {
          console.log(`[Hocuspocus] 📂 Loading Document: ${documentName} for user: ${user?.email || 'unknown'}`);

          if (documentName.startsWith('project-') && !documentName.startsWith('project-auth-')) {
            const projectId = documentName.slice('project-'.length);
            
            if (!user) {
              console.warn(`[Hocuspocus] ⚠️ No user context in onLoadDocument for ${documentName}`);
              return document;
            }

            // 1. Fetch user memberships to populate the switcher (Dual Lookup)
            const memberRows = await this.db.query.projectMembers.findMany({
              where: or(
                eq(schema.projectMembers.userId, user.id),
                eq(schema.projectMembers.email, user.email)
              )
            });
            const projectIds = [...new Set(memberRows.map((m: any) => m.projectId as string))];
            
            // 2. Fetch projects details (all projects this user can see)
            const allProjects = await this.db.query.projects.findMany({
              where: inArray(schema.projects.id, (projectIds.length > 0 ? projectIds : ['none']) as string[]),
              with: { members: true },
            });

            // 3. Map Projects (Always populate the switcher if anything found)
            const mappedProjects = (allProjects || []).map((p: any) => {
              let createdAtStr = new Date().toISOString();
              try {
                if (p.createdAt instanceof Date) createdAtStr = p.createdAt.toISOString();
                else if (typeof p.createdAt === 'string') createdAtStr = new Date(p.createdAt).toISOString();
              } catch (e) { /* fallback to now */ }

              const projectName = p.name || p.metadata?.name || 'Untitled Project';
              console.log(`[Hocuspocus]   - Project: ${projectName} (${p.id})`);

              return {
                id: p.id,
                name: projectName,
                createdAt: createdAtStr,
                members: (p.members || []).map((m: any) => m.email),
              };
            });

            const projArr = document.getArray('projects');
            
            // Clear and repopulate to ensure project list (memberships) is always fresh
            // Overwrite if empty or if currently filled with stubs
            const currentProjs = projArr.toJSON();
            const isAllUntitled = currentProjs.length > 0 && currentProjs.every((p: any) => !p.name || p.name === 'Untitled Project');

            if (projArr.length === 0 || isAllUntitled) {
              console.log(`[Hocuspocus] ✨ Bootstrapping store for ${documentName} with ${mappedProjects.length} projects (Force Sync: ${isAllUntitled}).`);
              if (projArr.length > 0) projArr.delete(0, projArr.length);
              projArr.push(mappedProjects);
            }

            // 4. Map Folder/Docs for the CURRENT active project
            // Note: If projectId is a 'playground-*' id, it won't be in the DB yet, which is fine.
            const proj = await this.db.query.projects.findFirst({
              where: eq(schema.projects.id, projectId),
              with: {
                folders: true,
                documents: true,
                invoices: true,
              }
            });

            if (proj) {
              console.log(`[Hocuspocus] 🏗️ Populating content for project: ${proj.name} (${proj.id})`);
              
              const safeIso = (d: any) => {
                try {
                  if (d instanceof Date) return d.toISOString();
                  if (typeof d === 'string') return new Date(d).toISOString();
                } catch (e) {}
                return new Date().toISOString();
              };

              const mappedFolders = (proj.folders || []).map((f: any) => ({
                id: f.id,
                name: f.name,
                parentId: f.metadata?.parentId || null,
                projectId: f.projectId,
                createdAt: safeIso(f.createdAt),
                updatedAt: safeIso(f.updatedAt),
                members: f.members || [],
              }));

              const mappedDocs = (proj.documents || []).map((d: any) => ({
                id: d.id,
                name: d.name,
                content: d.metadata?.content || null,
                folderId: d.folderId || null,
                projectId: d.projectId,
                createdAt: safeIso(d.createdAt),
                updatedAt: safeIso(d.updatedAt),
                invoiceId: d.metadata?.invoiceId || null,
                members: d.members || [],
              }));

              const folderArr = document.getArray('folders');
              const docArr = document.getArray('documents');

              if (folderArr.length === 0 && mappedFolders.length > 0) {
                folderArr.push(mappedFolders);
              }
              if (docArr.length === 0 && mappedDocs.length > 0) {
                docArr.push(mappedDocs);
              }
            }
          }
          // NOTE: doc-* rooms are intentionally NOT hydrated here. The frontend
          // editor (Editor.tsx / ReceiptEditor.tsx) seeds editorStore.content
          // from REST via the `seedIfEmpty` pattern after the `synced` event.
          // Hydrating from the server with raw JS values via map.set() would
          // break SyncedStore's proxy because nested objects/arrays must be
          // wrapped as Y.Map / Y.Array, not stored as primitive map values.
        } catch (error: any) {
          console.error(`[Hocuspocus] ❌ Error loading document ${documentName}:`, error);
        }
        return document;
      },

      onStoreDocument: async (data) => {
        const { documentName, document } = data;
        if (documentName.startsWith('doc-')) {
          const id = documentName.slice('doc-'.length);
          const state = document.getMap('content').toJSON();
          
          if (Object.keys(state).length > 0) {
            // Update invoices table first
            await this.db.update(schema.invoices)
              .set({ draft: state, updatedAt: new Date() })
              .where(eq(schema.invoices.id, id))
              .catch(() => {}); // If not in invoices, it might be in documents

            // Also update legacy documents table for backward compatibility during transition
            await this.db.update(schema.documents)
              .set({ 
                metadata: { content: state }, // Stored as metadata.content in legacy
                updatedAt: new Date() 
              })
              .where(eq(schema.documents.id, id))
              .catch(() => {});
          }
        }
      }
    });

    this.server.listen(1235).then(() => {
      this.logger.log('✅ Hocuspocus CRDT Server listening on port 1235');
    });
  }
}
