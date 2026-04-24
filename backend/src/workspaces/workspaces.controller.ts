import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Param,
  Body,
  UseGuards,
  Inject,
  Req,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DRIZZLE_PROVIDER } from '../database/database.provider';
import * as schema from '../db/schema';
import { eq, and, ne, or, inArray, sql } from 'drizzle-orm';
import { FirebaseGuard } from '../auth/firebase.guard';
import { normalizeRole, canWrite } from '../projects/projects.controller';
import * as crypto from 'crypto';

@Controller('api/workspace')
@UseGuards(FirebaseGuard)
export class WorkspacesController {
  constructor(@Inject(DRIZZLE_PROVIDER) private db: any) {}

  /**
   * Helper: verify the authenticated user has access to a project.
   * Access = owner OR row in projectMembers (matched by userId or email).
   * Throws ForbiddenException if not.
   */
  private async assertProjectAccess(projectId: string | null, req: any): Promise<{ isOwner: boolean }> {
    // Invoices created without a linked project are owner-only by default.
    if (!projectId) {
      return { isOwner: true };
    }
    const userId = req.user.uid;
    const email = req.user.email;

    // Playground rooms are per-user — only accessible by that user
    if (projectId.startsWith('playground-')) {
      if (projectId === `playground-${userId}`) return { isOwner: true };
      throw new ForbiddenException('Not allowed on this playground');
    }

    const proj = await this.db.query.projects.findFirst({
      where: eq(schema.projects.id, projectId),
    });
    if (!proj) {
      throw new NotFoundException('Project not found');
    }
    if (proj.ownerId === userId) return { isOwner: true };

    const memberConditions = [eq(schema.projectMembers.userId, userId)];
    if (email) memberConditions.push(eq(schema.projectMembers.email, email));

    const member = await this.db.query.projectMembers.findFirst({
      where: and(
        eq(schema.projectMembers.projectId, projectId),
        or(...memberConditions),
      ),
    });
    if (!member) {
      throw new ForbiddenException('Not a member of this project');
    }
    return { isOwner: false };
  }

  // ─── GET workspace / project details ────────────────────────────────
  @Get('projects')
  async getAllProjects(@Req() req: any) {
    const userId = req.user.uid;
    const userEmail = req.user.email;
    console.log(`[WorkspaceAPI] 🌐 REST Fetching all projects for user: ${userId} (${userEmail})`);

    try {
      // 1. Projects this user OWNS
      const ownedProjects = await this.db.query.projects.findMany({
        where: eq(schema.projects.ownerId, userId),
        with: { members: true },
      });

      // 2. Projects this user is a MEMBER of (via projectMembers table)
      const memberConds = [eq(schema.projectMembers.userId, userId)];
      if (userEmail) memberConds.push(eq(schema.projectMembers.email, userEmail));
      const memberRows = await this.db.query.projectMembers.findMany({
        where: or(...memberConds),
      });
      const memberProjectIds: string[] = Array.from(
        new Set(memberRows.map((m: any) => m.projectId as string)),
      );

      const sharedProjects = memberProjectIds.length > 0
        ? await this.db.query.projects.findMany({
            where: inArray(schema.projects.id, memberProjectIds),
            with: { members: true },
          })
        : [];

      // 3. Merge + dedupe
      const byId = new Map<string, any>();
      for (const p of ownedProjects) byId.set(p.id, p);
      for (const p of sharedProjects) if (!byId.has(p.id)) byId.set(p.id, p);
      const allProjects = Array.from(byId.values());

      // 4. Resolve owner info for each project (single query)
      const ownerIds: string[] = Array.from(
        new Set(allProjects.map((p: any) => p.ownerId as string)),
      );
      const owners = ownerIds.length > 0
        ? await this.db.query.users.findMany({
            where: inArray(schema.users.id, ownerIds),
          })
        : [];
      const ownerById = new Map<string, any>();
      for (const o of owners) ownerById.set(o.id, o);

      // 5. Normalize — include per-member role map + myRole for the caller.
      const normalized = allProjects.map((p: any) => {
        const rawMembers = (p.members || []) as any[];
        const memberEmails = rawMembers.map((m: any) => m.email).filter(Boolean);

        // email → role map. Legacy 'member' values are normalized to 'editor'.
        const memberRoles: Record<string, string> = {};
        for (const m of rawMembers) {
          if (m.email) memberRoles[m.email] = normalizeRole(m.role);
        }

        const owner = ownerById.get(p.ownerId);
        // Always include the owner email in members list so project-level
        // access works even if the membership row got out of sync.
        if (owner?.email) {
          if (!memberEmails.includes(owner.email)) memberEmails.push(owner.email);
          memberRoles[owner.email] = 'owner';
        }

        // Resolve the caller's role on this project.
        const isOwner = p.ownerId === userId;
        let myRole: string;
        if (isOwner) {
          myRole = 'owner';
        } else {
          const mine = rawMembers.find(
            (m: any) => m.userId === userId || (userEmail && m.email === userEmail),
          );
          myRole = normalizeRole(mine?.role);
        }

        return {
          id: p.id,
          name: p.name,
          businessId: p.businessId,
          ownerId: p.ownerId,
          isOwner,
          myRole,
          owner: owner
            ? {
                id: owner.id,
                email: owner.email,
                fullName: owner.fullName || null,
                photo: owner.metadata?.picture || owner.metadata?.photo || null,
              }
            : { id: p.ownerId, email: null, fullName: null, photo: null },
          members: memberEmails,
          memberRoles,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        };
      });

      console.log(
        `[WorkspaceAPI] ✅ Found ${normalized.length} projects (${ownedProjects.length} owned, ${sharedProjects.length} shared).`,
      );
      return { success: true, data: normalized };
    } catch (error: any) {
      console.error('[WorkspaceAPI] ❌ Error fetching projects:', error);
      return { success: false, error: error.message || 'Internal Server Error' };
    }
  }

  @Get(':id')
  async getProjectDetails(@Param('id') id: string) {
    try {
      console.log(`[WorkspaceAPI] 🔍 Fetching details for project: ${id}`);

      // 1. Initial lookup
      const project = await this.db.query.projects.findFirst({
        where: eq(schema.projects.id, id),
        with: {
          members: true,
          folders: true,
          documents: true,
          invoices: true,
        }
      });

      if (!project) {
        console.warn(`[WorkspaceAPI] ⚠️ Project ${id} not found in DB.`);

        // 2. IDENTITY RESCUE: If the requested project is a playground and doesn't exist,
        // check if this user has ANY projects. If not, create one.
        if (id.startsWith('playground-')) {
          const userId = id.replace('playground-', '');
          // Search for any project owned by this user
          const existing = await this.db.query.projects.findFirst({
            where: eq(schema.projects.ownerId, userId)
          });

          if (!existing) {
             console.log(`[Rescue] 🚀 No projects found for user ${userId}. Provisioning default...`);
             // This will be handled by the frontend calling upsertProject,
             // but we return a valid structure here to keep the UI alive.
          }

          return {
            success: true,
            data: {
              id,
              name: 'Playground',
              folders: [],
              documents: [],
              projects: [],
              members: []
            }
          };
        }
        return { success: true, data: { folders: [], documents: [], projects: [], members: [] } };
      }

      // 2. Resolve full user data for all members
      const memberEmails = (project.members || []).map((m: any) => m.email).filter(Boolean);
      const users = memberEmails.length > 0
        ? await this.db.query.users.findMany({
            where: inArray(schema.users.email, memberEmails),
          })
        : [];
      const userByEmail = new Map<string, any>();
      for (const u of users) {
        userByEmail.set(u.email, u);
      }

      // 3. Map project members to full user details
      const fullMembers = (project.members || [])
        .map((m: any) => {
          const user = userByEmail.get(m.email);
          return {
            email: m.email,
            userId: user?.id || null,
            displayName: user?.fullName || m.email?.split('@')[0] || 'Unknown User',
            photoURL: user?.metadata?.picture || null,
            role: normalizeRole(m.role),
          };
        })
        .filter((m: any) => m.email); // Only include entries with email

      // Normalize members from rows to email strings, and folders/docs to top-level shape
      const normalized = {
        id: project.id,
        name: project.name,
        businessId: project.businessId,
        ownerId: project.ownerId,
        members: fullMembers, // Now returns full user details instead of just emails
        folders: (project.folders || []).map((f: any) => ({
          id: f.id,
          name: f.name,
          parentId: f.metadata?.parentId ?? null,
          projectId: f.projectId,
          businessId: f.businessId,
          members: f.members || [],
          createdAt: f.createdAt,
          updatedAt: f.updatedAt,
        })),
        documents: (project.documents || []).map((d: any) => ({
          id: d.id,
          name: d.name,
          content: d.metadata?.content ?? null,
          folderId: d.folderId,
          projectId: d.projectId,
          businessId: d.businessId,
          invoiceId: d.metadata?.invoiceId ?? null,
          members: d.members || [],
          url: d.url,
          mimetype: d.mimetype,
          size: d.size,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
        })),
        invoices: project.invoices || [],
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      };

      console.log(`[WorkspaceAPI] ✅ Successfully fetched ${project.name}`);
      return { success: true, data: normalized };
    } catch (error: any) {
      console.error(`[WorkspaceAPI] ❌ Error fetching project ${id}:`, error);
      // Return a safer structure instead of crashing
      return {
        success: false,
        error: error.message,
        data: { folders: [], documents: [], projects: [], members: [] }
      };
    }
  }

  @Get(':id/folders')
  async getFolders(@Param('id') projectId: string, @Req() req: any) {
    try {
      console.log(`[WorkspaceAPI] 📂 Fetching folders for project: ${projectId}`);
      const { isOwner } = await this.assertProjectAccess(projectId, req);
      const userEmail = req.user.email;

      const list = await this.db.query.folders.findMany({
        where: eq(schema.folders.projectId, projectId),
      });
      // Normalize to frontend shape: parentId at top level (from metadata)
      const normalized = list.map((f: any) => ({
        id: f.id,
        name: f.name,
        parentId: f.metadata?.parentId ?? null,
        projectId: f.projectId,
        businessId: f.businessId,
        members: f.members || [],
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
      }));

      // Owners see everything in their project. Members only see folders
      // where their email is explicitly listed OR folders with no per-item
      // members restriction (treated as project-wide open).
      const visible = isOwner
        ? normalized
        : normalized.filter((f: any) => {
            const mem = f.members || [];
            if (mem.length === 0) return true; // no restriction = visible to all project members
            return userEmail ? mem.includes(userEmail) : false;
          });

      return { success: true, data: visible };
    } catch (error: any) {
      if (error.status) throw error; // propagate Nest Http exceptions
      return { success: false, error: error.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  FOLDERS
  // ═══════════════════════════════════════════════════════════════════

  @Post(':id/folders')
  async upsertFolder(@Param('id') id: string, @Body() folder: any, @Req() req: any) {
    await this.assertProjectAccess(id, req);
    let businessId = folder.businessId;

    // Resolve businessId from project if not provided
    if (!businessId) {
      const proj = await this.db.query.projects.findFirst({
        where: eq(schema.projects.id, id),
      });
      businessId = proj?.businessId || null;
    }

    const payload = {
      id: folder.id,
      projectId: id,
      businessId: businessId,
      name: folder.name,
      path: folder.parentId || folder.path || 'root',
      members: folder.members || [],
      metadata: {
        parentId: folder.parentId || null,
      },
      updatedAt: new Date(),
    };

    await this.db.insert(schema.folders)
      .values({ ...payload, createdAt: new Date() })
      .onConflictDoUpdate({
        target: schema.folders.id,
        set: payload,
      });

    return { success: true };
  }

  @Patch(':id/folders/:folderId/members')
  async updateFolderMembers(
    @Param('id') id: string,
    @Param('folderId') folderId: string,
    @Body() body: { members: string[] },
    @Req() req: any,
  ) {
    await this.assertProjectAccess(id, req);
    await this.db.update(schema.folders)
      .set({ members: body.members, updatedAt: new Date() })
      .where(eq(schema.folders.id, folderId));
    return { success: true, data: { id: folderId, members: body.members } };
  }

  @Delete(':id/folders/:folderId')
  async deleteFolder(@Param('id') id: string, @Param('folderId') folderId: string, @Req() req: any) {
    await this.assertProjectAccess(id, req);
    // Delete documents/invoices in this folder first
    await this.db.delete(schema.documents).where(eq(schema.documents.folderId, folderId));
    await this.db.delete(schema.invoices).where(eq(schema.invoices.folderId, folderId));
    await this.db.delete(schema.folders).where(eq(schema.folders.id, folderId));
    return { success: true };
  }

  @Get(':id/documents')
  async getDocuments(@Param('id') projectId: string, @Req() req: any) {
    try {
      console.log(`[WorkspaceAPI] 📄 Fetching documents for project: ${projectId}`);
      const { isOwner } = await this.assertProjectAccess(projectId, req);
      const userEmail = req.user.email;

      // ── 1. Legacy documents table ──────────────────────────────────────────
      const docList = await this.db.query.documents.findMany({
        where: and(
          eq(schema.documents.projectId, projectId),
          // Hide receipts from the main dashboard/folder views
          sql`NOT ((metadata->>'isReceipt')::boolean IS TRUE) AND (metadata->>'invoiceId') IS NULL`
        ),
      });

      // ── 2. Invoices table (new model) ──────────────────────────────────────
      const invoiceList = await this.db.query.invoices.findMany({
        where: eq(schema.invoices.projectId, projectId),
        with: { receipts: true }
      });

      // Fetch folders once so we can cascade parent-folder restrictions
      const folders = await this.db.query.folders.findMany({
        where: eq(schema.folders.projectId, projectId),
      });
      const folderVisibleById = new Map<string, boolean>();
      for (const f of folders as any[]) {
        const mem = f.members || [];
        folderVisibleById.set(
          f.id,
          isOwner || mem.length === 0 || (userEmail && mem.includes(userEmail)),
        );
      }

      // Normalize legacy documents
      const normalizedDocs = docList.map((d: any) => ({
        id: d.id,
        userId: d.userId,
        name: d.name,
        content: d.metadata?.content ?? null,
        folderId: d.folderId,
        projectId: d.projectId,
        businessId: d.businessId,
        invoiceId: d.metadata?.invoiceId ?? null,
        members: d.members || [],
        url: d.url,
        mimetype: d.mimetype,
        size: d.size,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        _source: 'documents' as const,
      }));

      // Normalize invoices into the same shape the dashboard expects
      const normalizedInvoices = invoiceList.map((inv: any) => ({
        id: inv.id,
        userId: inv.userId,
        name: inv.name,
        content: inv.draft ?? inv.content ?? null,
        folderId: inv.folderId ?? null,
        projectId: inv.projectId,
        businessId: inv.businessId,
        invoiceId: null,
        members: inv.members || [],
        url: '',
        mimetype: null,
        size: null,
        createdAt: inv.createdAt,
        updatedAt: inv.updatedAt,
        status: inv.status,
        receiptCount: (inv.receipts || []).filter((r: any) => r.status === 'finalised').length,
        _source: 'invoices' as const,
      }));

      // Merge — invoices table is the source of truth; skip any legacy doc
      // that has the same id as an invoice (prevents duplicates during migration).
      const invoiceIds = new Set(normalizedInvoices.map((i: any) => i.id));
      const dedupedDocs = normalizedDocs.filter((d: any) => !invoiceIds.has(d.id));
      const combined = [...dedupedDocs, ...normalizedInvoices];

      const visible = isOwner
        ? combined
        : combined.filter((d: any) => {
            if (d.folderId && folderVisibleById.get(d.folderId) === false) return false;
            const mem = d.members || [];
            if (mem.length === 0) return true;
            return userEmail ? mem.includes(userEmail) : false;
          });

      return { success: true, data: visible };
    } catch (error: any) {
      if (error.status) throw error;
      return { success: false, error: error.message };
    }
  }

  @Get('documents/:docId')
  async getDocInfo(@Param('docId') docId: string, @Req() req: any) {
    try {
      console.log(`[WorkspaceAPI] 🔍 Fetching info for specific document: ${docId}`);
      
      // 1. Try primary documents table
      let doc: any = await this.db.query.documents.findFirst({
        where: eq(schema.documents.id, docId),
      });

      // 2. Fallback: invoices table (new model — created via POST /api/invoices)
      if (!doc) {
        console.log(`[WorkspaceAPI] 🔄 Document ${docId} not in documents table. Checking invoices...`);
        const invoice = await this.db.query.invoices.findFirst({
          where: eq(schema.invoices.id, docId),
        });
        if (invoice) {
          // Synthesize a document-shaped record from the invoice
          doc = {
            id: invoice.id,
            userId: invoice.userId,
            name: invoice.name,
            url: '',
            mimetype: null,
            projectId: invoice.projectId,
            businessId: invoice.businessId,
            folderId: invoice.folderId ?? null,
            members: invoice.members || [],
            metadata: {
              content: invoice.draft ?? invoice.content,
              invoiceId: null,
              isReceipt: false,
            },
            createdAt: invoice.createdAt,
            updatedAt: invoice.updatedAt,
            _fromInvoices: true,
          };
        }
      }

      // 3. Fallback: master receipts table (for receipts deleted from dashboard)
      if (!doc) {
        console.log(`[WorkspaceAPI] 🔍 Checking master receipts fallback for ${docId}...`);
        const receipt = await this.db.query.receipts.findFirst({
          where: eq(schema.receipts.id, docId),
        });

        if (receipt) {
          doc = {
            id: receipt.id,
            userId: req.user?.uid || 'unknown',
            name: (receipt.metadata as any)?.name || 'Receipt',
            url: '',
            mimetype: null,
            projectId: receipt.projectId,
            businessId: receipt.businessId,
            members: [],
            metadata: {
              ...(receipt.metadata as any || {}),
              content: receipt.draft,
              invoiceId: receipt.invoiceId,
              isReceipt: true,
              receiptId: receipt.id,
            },
            createdAt: receipt.createdAt,
            updatedAt: receipt.updatedAt,
          };
        }
      }

      if (!doc) {
        throw new NotFoundException('Document, Invoice, or Receipt not found');
      }

      // Verify access — projectId may be null for invoices without a project link
      if (doc.projectId) {
        await this.assertProjectAccess(doc.projectId, req);
      }

      return {
        success: true,
        data: {
          id: doc.id,
          userId: doc.userId,
          name: doc.name,
          content: doc.metadata?.content ?? null,
          folderId: doc.folderId,
          projectId: doc.projectId,
          businessId: doc.businessId,
          invoiceId: doc.metadata?.invoiceId ?? null,
          members: doc.members || [],
          url: doc.url,
          mimetype: doc.mimetype,
          size: doc.size,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
          metadata: doc.metadata ?? {},
        },
      };
    } catch (error: any) {
      if (error.status) throw error;
      return { success: false, error: error.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  DOCUMENTS (uploaded files — PDFs, images, etc.)
  // ═══════════════════════════════════════════════════════════════════

  @Post(':id/documents')
  async upsertDocument(@Param('id') id: string, @Body() doc: any, @Req() req: any) {
    await this.assertProjectAccess(id, req);

    // 1. Check if it's a Receipt
    const receipt = await this.db.query.receipts.findFirst({
      where: eq(schema.receipts.id, doc.id),
    });
    if (receipt) {
      if (receipt.status === 'finalised') {
        throw new ForbiddenException('This receipt is finalised and cannot be modified');
      }
      await this.db.update(schema.receipts)
        .set({ draft: doc.content, updatedAt: new Date() })
        .where(eq(schema.receipts.id, doc.id));
      return { success: true };
    }

    // 2. Check if it's an Invoice
    const invoice = await this.db.query.invoices.findFirst({
      where: eq(schema.invoices.id, doc.id),
    });
    if (invoice) {
      if (invoice.status === 'locked') {
        throw new ForbiddenException('This invoice is locked and cannot be modified');
      }
      await this.db.update(schema.invoices)
        .set({ draft: doc.content, updatedAt: new Date() })
        .where(eq(schema.invoices.id, doc.id));
      return { success: true };
    }

    const userId = req.user.uid;
    let businessId = doc.businessId;

    // Resolve businessId from project if not provided
    if (!businessId) {
      const proj = await this.db.query.projects.findFirst({
        where: eq(schema.projects.id, id),
      });
      businessId = proj?.businessId || null;
    }

    const payload = {
      id: doc.id,
      userId: userId,
      projectId: id,
      businessId: businessId,
      folderId: doc.folderId || null,
      name: doc.name,
      url: doc.url || doc.content?.url || '',
      mimetype: doc.mimetype || doc.content?.mimetype || null,
      size: doc.size || null,
      members: doc.members || [req.user.email],
      metadata: {
        content: doc.content,
        invoiceId: doc.invoiceId || null,
      },
      updatedAt: new Date(),
    };

    await this.db.insert(schema.documents)
      .values({ ...payload, createdAt: new Date() })
      .onConflictDoUpdate({
        target: schema.documents.id,
        set: payload,
      });

    return { success: true };
  }

  @Delete(':id/documents/:documentId')
  async deleteDocument(@Param('id') id: string, @Param('documentId') documentId: string, @Req() req: any) {
    await this.assertProjectAccess(id, req);
    await this.db.delete(schema.documents).where(eq(schema.documents.id, documentId));
    return { success: true };
  }

  @Patch(':id/documents/:documentId/members')
  async updateDocumentMembers(
    @Param('id') id: string,
    @Param('documentId') documentId: string,
    @Body() body: { members: string[] },
    @Req() req: any,
  ) {
    await this.assertProjectAccess(id, req);
    await this.db.update(schema.documents)
      .set({ members: body.members, updatedAt: new Date() })
      .where(eq(schema.documents.id, documentId));
    return { success: true, data: { id: documentId, members: body.members } };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  PROJECTS (CRDT project entries within a workspace/business)
  // ═══════════════════════════════════════════════════════════════════

  @Post(':id/projects')
  async upsertProject(@Param('id') contextProjectId: string, @Body() proj: any, @Req() req: any) {
    console.log(`[WorkspaceAPI] 📥 Upserting project: "${proj.name}" (${proj.id}) in context: ${contextProjectId}`);
    const userId = req.user.uid;
    const email = req.user.email;

    if (!email) {
      throw new BadRequestException('User email not found for project membership');
    }

    // 1. Ensure User & Business exist (Bootstrapping)
    let user = await this.db.query.users.findFirst({ where: eq(schema.users.id, userId) });
    if (!user) {
      await this.db.insert(schema.users).values({
        id: userId,
        email: email,
        fullName: req.user.name || email.split('@')[0],
        metadata: req.user.picture ? { picture: req.user.picture } : {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }).onConflictDoNothing();
      user = await this.db.query.users.findFirst({ where: eq(schema.users.id, userId) });
    }

    let businessId = user?.businessId;
    if (!businessId) {
      // Look for a business owned by this user
      const ownedBiz = await this.db.query.businesses.findFirst({ where: eq(schema.businesses.ownerId, userId) });
      if (ownedBiz) {
        businessId = ownedBiz.id;
      } else {
        // Create a default business
        businessId = crypto.randomUUID();
        await this.db.insert(schema.businesses).values({
          id: businessId,
          name: `${user?.fullName || 'My'}'s Workspace`,
          ownerId: userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
      
      // Link user to business
      await this.db.update(schema.users)
        .set({ businessId, updatedAt: new Date() })
        .where(eq(schema.users.id, userId));
    }

    // Proactive check for duplicate project names within the SAME business
    const existing = await this.db.query.projects.findFirst({
      where: and(
        eq(schema.projects.businessId, businessId),
        eq(schema.projects.name, proj.name),
        ne(schema.projects.id, proj.id)
      )
    });

    if (existing) {
      throw new BadRequestException(`A project named "${proj.name}" already exists in this workspace.`);
    }

    const payload = {
      id: proj.id,
      businessId: businessId,
      name: proj.name,
      ownerId: userId,
      metadata: {
        members: proj.members || [email],
        createdAt: proj.createdAt,
      },
      updatedAt: new Date(),
    };

    await this.db.insert(schema.projects)
      .values({ ...payload, createdAt: new Date() })
      .onConflictDoUpdate({
        target: schema.projects.id,
        set: payload,
      });

    // Ensure the creator is a project member
    await this.db.insert(schema.projectMembers)
      .values({
        projectId: proj.id,
        userId: userId,
        email: email,
        role: 'owner',
        updatedAt: new Date(),
        createdAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [schema.projectMembers.projectId, schema.projectMembers.userId],
        set: { updatedAt: new Date() }
      });

    return { success: true };
  }

  @Delete(':id/projects/:projectId')
  async deleteProject(@Param('id') businessId: string, @Param('projectId') projectId: string) {
    // Clean up children
    await this.db.delete(schema.projectMembers).where(eq(schema.projectMembers.projectId, projectId));
    await this.db.delete(schema.documents).where(eq(schema.documents.projectId, projectId));
    await this.db.delete(schema.invoices).where(eq(schema.invoices.projectId, projectId));
    await this.db.delete(schema.folders).where(eq(schema.folders.projectId, projectId));
    await this.db.delete(schema.projects).where(eq(schema.projects.id, projectId));
    return { success: true };
  }

  @Patch(':id/projects/:projectId/members')
  async updateProjectMembers(
    @Param('id') businessId: string,
    @Param('projectId') projectId: string,
    @Body() body: { members: string[] },
  ) {
    // Sync project members: ensure each email in the list has a projectMembers row
    const existingMembers = await this.db.query.projectMembers.findMany({
      where: eq(schema.projectMembers.projectId, projectId),
    });
    const existingEmails = new Set(existingMembers.map((m: any) => m.email));

    for (const email of body.members) {
      if (!existingEmails.has(email)) {
        // Look up user by email
        const user = await this.db.query.users.findFirst({
          where: eq(schema.users.email, email),
        });
        await this.db.insert(schema.projectMembers)
          .values({
            projectId,
            userId: user?.id || 'pending',
            email,
            role: 'viewer',
            updatedAt: new Date(),
            createdAt: new Date(),
          })
          .onConflictDoNothing();
      }
    }

    return { success: true };
  }
}
