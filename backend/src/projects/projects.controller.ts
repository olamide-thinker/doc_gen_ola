import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
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
import { eq, and } from 'drizzle-orm';
import { FirebaseGuard } from '../auth/firebase.guard';

// Canonical project role values. Any legacy 'member' value in the DB is
// treated as 'editor' at read time (see normalizeRole below).
const ROLE_VALUES = ['owner', 'editor', 'commenter', 'viewer'] as const;
type ProjectRole = typeof ROLE_VALUES[number];

export function normalizeRole(raw: any): ProjectRole {
  if (raw === 'owner') return 'owner';
  if (raw === 'editor' || raw === 'member') return 'editor'; // legacy compat
  if (raw === 'commenter') return 'commenter';
  if (raw === 'viewer') return 'viewer';
  return 'viewer'; // safest default for unknown values
}

/** Returns true when the given role is allowed to write/mutate documents. */
export function canWrite(role: ProjectRole | undefined | null): boolean {
  const r = normalizeRole(role);
  return r === 'owner' || r === 'editor';
}

@Controller('api/projects')
@UseGuards(FirebaseGuard)
export class ProjectsController {
  constructor(@Inject(DRIZZLE_PROVIDER) private db: any) {}

  /**
   * Resolves the caller's role for a given project. Owners always take
   * precedence over the projectMembers row (in case they never got inserted).
   */
  private async getCallerRole(projectId: string, req: any): Promise<ProjectRole> {
    const userId = req.user.uid;
    const email = req.user.email;

    const proj = await this.db.query.projects.findFirst({
      where: eq(schema.projects.id, projectId),
    });
    if (!proj) throw new NotFoundException('Project not found');
    if (proj.ownerId === userId) return 'owner';

    const member = await this.db.query.projectMembers.findFirst({
      where: and(
        eq(schema.projectMembers.projectId, projectId),
        email
          ? eq(schema.projectMembers.email, email)
          : eq(schema.projectMembers.userId, userId),
      ),
    });
    if (!member) throw new ForbiddenException('Not a member of this project');
    return normalizeRole(member.role);
  }

  @Get(':id')
  async getProject(@Param('id') id: string, @Req() req: any) {
    // Verify user has access to this project (owner or member)
    await this.getCallerRole(id, req);

    const project = await this.db.query.projects.findFirst({
      where: eq(schema.projects.id, id),
      with: {
        members: true,
        folders: true,
        documents: true,
        invoices: true,
      }
    });
    return { success: true, data: project };
  }

  @Post(':id/members')
  async addMember(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const { email, role } = body;

    // Only project owners can add members
    const callerRole = await this.getCallerRole(id, req);
    if (callerRole !== 'owner') {
      throw new ForbiddenException('Only the project owner can add members');
    }

    const nextRole = normalizeRole(role) || 'editor';
    // You can never be added AS the owner through this endpoint — ownership
    // transfer is a separate (not yet built) flow.
    const safeRole = nextRole === 'owner' ? 'editor' : nextRole;

    // Find user by email first
    const user = await this.db.query.users.findFirst({
      where: eq(schema.users.email, email),
    });

    if (!user) {
      // For now, we might need a placeholder or just return error
      return { success: false, error: 'User not found in system. They must sign in once first.' };
    }

    try {
      // Soft-uniqueness — check first, then upsert. The previous
      // implementation used onConflictDoUpdate against a unique index on
      // (projectId, userId), but that index was dropped when userId
      // became nullable for company/vendor members. We do the check in
      // application code now (cheap — single row by FK).
      const existing = await this.db.query.projectMembers.findFirst({
        where: and(
          eq(schema.projectMembers.projectId, id),
          eq(schema.projectMembers.userId, user.id),
        ),
      });

      if (existing) {
        await this.db
          .update(schema.projectMembers)
          .set({ role: safeRole, email: user.email, updatedAt: new Date() })
          .where(eq(schema.projectMembers.id, existing.id));
      } else {
        await this.db.insert(schema.projectMembers).values({
          projectId: id,
          userId: user.id,
          email: user.email,
          kind: 'user',
          role: safeRole,
          updatedAt: new Date(),
          createdAt: new Date(),
        });
      }

      return { success: true, data: { email: user.email, role: safeRole } };
    } catch (err: any) {
      console.error('[ProjectsController] Error adding member:', err);
      return { success: false, error: err.message || 'Unknown database error' };
    }
  }

  /**
   * Add a non-user member to the project — companies, vendors, suppliers.
   * They have no firebase account; they just need a display name so they
   * can be picked as a counterparty on invoices and receipts.
   *
   * Body: { displayName: string, kind?: 'company'|'vendor', role?: string }
   */
  @Post(':id/members/company')
  async addCompanyMember(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const callerRole = await this.getCallerRole(id, req);
    if (callerRole !== 'owner') {
      throw new ForbiddenException('Only the project owner can add members');
    }

    const displayName = String(body?.displayName || '').trim();
    if (!displayName) {
      throw new BadRequestException('displayName is required');
    }

    const kind = body?.kind === 'vendor' ? 'vendor' : 'company';
    const nextRole = normalizeRole(body?.role) || 'viewer';
    // Companies/vendors are never owners.
    const safeRole = nextRole === 'owner' ? 'viewer' : nextRole;

    // Soft-uniqueness — one display name per project for the company/vendor
    // bucket. We don't fight existing user members on the same name.
    const existing = await this.db.query.projectMembers.findFirst({
      where: and(
        eq(schema.projectMembers.projectId, id),
        eq(schema.projectMembers.displayName, displayName),
      ),
    });
    if (existing) {
      throw new BadRequestException(
        `A member named "${displayName}" already exists on this project`,
      );
    }

    const [created] = await this.db
      .insert(schema.projectMembers)
      .values({
        projectId: id,
        userId: null,
        email: null,
        kind,
        displayName,
        role: safeRole,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return { success: true, data: created };
  }

  /**
   * Update a single member's role on a project. Only the project owner may
   * change roles. You cannot change the owner's role through this endpoint.
   */
  @Patch(':id/members/:email/role')
  async updateMemberRole(
    @Param('id') id: string,
    @Param('email') emailParam: string,
    @Body() body: { role: string },
    @Req() req: any,
  ) {
    const callerRole = await this.getCallerRole(id, req);
    if (callerRole !== 'owner') {
      throw new ForbiddenException('Only the project owner can change roles');
    }
    const email = decodeURIComponent(emailParam);
    const nextRole = normalizeRole(body.role);
    if (nextRole === 'owner') {
      throw new BadRequestException('Ownership transfer is not supported via this endpoint');
    }

    // Prevent changing the owner's role (their row has role='owner').
    const target = await this.db.query.projectMembers.findFirst({
      where: and(
        eq(schema.projectMembers.projectId, id),
        eq(schema.projectMembers.email, email),
      ),
    });
    if (!target) throw new NotFoundException('Member not found on this project');
    if (normalizeRole(target.role) === 'owner') {
      throw new BadRequestException("Cannot change the owner's role");
    }

    await this.db.update(schema.projectMembers)
      .set({ role: nextRole, updatedAt: new Date() })
      .where(and(
        eq(schema.projectMembers.projectId, id),
        eq(schema.projectMembers.email, email),
      ));

    return { success: true, data: { email, role: nextRole } };
  }

  @Delete(':id/members/:identifier')
  async removeMember(
    @Param('id') id: string,
    @Param('identifier') identifier: string,
    @Req() req: any,
  ) {
    const callerRole = await this.getCallerRole(id, req);
    if (callerRole !== 'owner') {
      throw new ForbiddenException('Only the project owner can remove members');
    }

    // Resolve the target row so we can guard against removing the owner.
    // Identifier can be: an email (real user), a userId, or a member-row
    // uuid (the only reliable handle for company/vendor members which
    // have no email or userId).
    const decoded = decodeURIComponent(identifier);
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(decoded);
    const target = await this.db.query.projectMembers.findFirst({
      where: and(
        eq(schema.projectMembers.projectId, id),
        isUuid
          ? eq(schema.projectMembers.id, decoded)
          : decoded.includes('@')
            ? eq(schema.projectMembers.email, decoded)
            : eq(schema.projectMembers.userId, decoded),
      ),
    });
    if (!target) return { success: true }; // idempotent
    if (normalizeRole(target.role) === 'owner') {
      throw new BadRequestException('Cannot remove the project owner');
    }

    await this.db.delete(schema.projectMembers).where(
      and(
        eq(schema.projectMembers.projectId, id),
        eq(schema.projectMembers.id, target.id),
      ),
    );
    return { success: true };
  }
}
