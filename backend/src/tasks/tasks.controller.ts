import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Inject,
  Req,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { DRIZZLE_PROVIDER } from '../database/database.provider';
import * as schema from '../db/schema';
import { eq, and, or, desc } from 'drizzle-orm';
import { FirebaseGuard } from '../auth/firebase.guard';
import { TasksService } from './tasks.service';

const ALLOWED_STATUS = new Set(['pending', 'progress', 'done', 'cancelled']);
const ALLOWED_PRIORITY = new Set(['low', 'med', 'high']);
const ALLOWED_LOCATION_TYPE = new Set(['zone', 'text']);

interface MaterialRow {
  name?: string;
  quantity?: number | string;
  unit?: string;
  note?: string;
}

@Controller('api/tasks')
@UseGuards(FirebaseGuard)
export class TasksController {
  constructor(
    @Inject(DRIZZLE_PROVIDER) private db: any,
    private tasks: TasksService,
  ) {}

  /** Project-membership gate. Mirrors the WorkspacesController helper. */
  private async assertProjectAccess(
    projectId: string,
    req: any,
  ): Promise<void> {
    const userId = req.user.uid;
    const email = req.user.email;

    const proj = await this.db.query.projects.findFirst({
      where: eq(schema.projects.id, projectId),
    });
    if (!proj) throw new NotFoundException('Project not found');
    if (proj.ownerId === userId) return;

    const memberConds = [eq(schema.projectMembers.userId, userId)];
    if (email) memberConds.push(eq(schema.projectMembers.email, email));

    const member = await this.db.query.projectMembers.findFirst({
      where: and(
        eq(schema.projectMembers.projectId, projectId),
        or(...memberConds),
      ),
    });
    if (!member) throw new ForbiddenException('Not a member of this project');
  }

  /** Coerce/validate the materials field. Returns null when empty/invalid. */
  private normalizeMaterials(input: unknown): MaterialRow[] | null {
    if (!Array.isArray(input)) return null;
    const rows = input
      .filter((row): row is Record<string, any> => row && typeof row === 'object')
      .map((row): MaterialRow => ({
        name: typeof row.name === 'string' ? row.name : '',
        quantity:
          typeof row.quantity === 'number'
            ? row.quantity
            : typeof row.quantity === 'string'
              ? row.quantity
              : undefined,
        unit: typeof row.unit === 'string' ? row.unit : undefined,
        note: typeof row.note === 'string' ? row.note : undefined,
      }))
      .filter(r => r.name && r.name.trim().length > 0);
    return rows.length > 0 ? rows : null;
  }

  /** ─── LIST ──────────────────────────────────────────────────────── */
  @Get()
  async list(
    @Query('projectId') projectId: string,
    @Query('status') status: string | undefined,
    @Query('assigneeId') assigneeId: string | undefined,
    @Query('priority') priority: string | undefined,
    @Req() req: any,
  ) {
    if (!projectId) throw new BadRequestException('projectId is required');
    await this.assertProjectAccess(projectId, req);

    const conds: any[] = [eq(schema.tasks.projectId, projectId)];
    if (status && ALLOWED_STATUS.has(status))
      conds.push(eq(schema.tasks.status, status));
    if (priority && ALLOWED_PRIORITY.has(priority))
      conds.push(eq(schema.tasks.priority, priority));
    if (assigneeId) conds.push(eq(schema.tasks.assigneeId, assigneeId));

    const rows = await this.db.query.tasks.findMany({
      where: conds.length === 1 ? conds[0] : and(...conds),
      orderBy: [desc(schema.tasks.createdAt)],
    });

    return { success: true, data: rows };
  }

  /** ─── CREATE ────────────────────────────────────────────────────── */
  @Post()
  async create(@Body() body: any, @Req() req: any) {
    const projectId = body?.projectId;
    if (!projectId) throw new BadRequestException('projectId is required');
    await this.assertProjectAccess(projectId, req);

    const title = String(body.title || '').trim();
    if (!title) throw new BadRequestException('title is required');

    // Resolve project's businessId so we can stamp the task with it
    const proj = await this.db.query.projects.findFirst({
      where: eq(schema.projects.id, projectId),
      columns: { businessId: true },
    });

    const taskCode = await this.tasks.nextTaskCode(projectId);

    // Normalise + validate
    const status = ALLOWED_STATUS.has(body.status) ? body.status : 'pending';
    const priority = ALLOWED_PRIORITY.has(body.priority) ? body.priority : 'med';
    const locationType = ALLOWED_LOCATION_TYPE.has(body.locationType)
      ? body.locationType
      : null;

    const insert: any = {
      taskCode,
      projectId,
      businessId: proj?.businessId || null,

      title,
      details: typeof body.details === 'string' ? body.details : null,
      status,
      priority,

      deadline: body.deadline ? new Date(body.deadline) : null,

      createdById: req.user?.uid || null,
      supervisorId: body.supervisorId || null,
      assigneeId: body.assigneeId || null,
      crewIds: Array.isArray(body.crewIds)
        ? body.crewIds.filter((c: any) => typeof c === 'string')
        : null,

      materials: this.normalizeMaterials(body.materials),
      budget:
        typeof body.budget === 'number' && Number.isFinite(body.budget)
          ? Math.round(body.budget)
          : null,

      locationType,
      locationDocId:
        locationType === 'zone' ? body.locationDocId || null : null,
      locationZoneId:
        locationType === 'zone' ? body.locationZoneId || null : null,
      locationText:
        locationType === 'text' ? body.locationText || null : null,

      stageId: body.stageId || null,
      milestoneId: body.milestoneId || null,

      metadata: body.metadata && typeof body.metadata === 'object'
        ? body.metadata
        : null,
    };

    const [created] = await this.db
      .insert(schema.tasks)
      .values(insert)
      .returning();

    return { success: true, data: created };
  }

  /** ─── DETAIL ────────────────────────────────────────────────────── */
  @Get(':id')
  async detail(@Param('id') id: string, @Req() req: any) {
    const row = await this.db.query.tasks.findFirst({
      where: eq(schema.tasks.id, id),
    });
    if (!row) throw new NotFoundException('Task not found');
    if (row.projectId) await this.assertProjectAccess(row.projectId, req);
    return { success: true, data: row };
  }

  /** ─── UPDATE ────────────────────────────────────────────────────── */
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const row = await this.db.query.tasks.findFirst({
      where: eq(schema.tasks.id, id),
    });
    if (!row) throw new NotFoundException('Task not found');
    if (row.projectId) await this.assertProjectAccess(row.projectId, req);

    const patch: any = { updatedAt: new Date() };

    if (typeof body.title === 'string') patch.title = body.title.trim();
    if (typeof body.details === 'string') patch.details = body.details;
    if (typeof body.status === 'string' && ALLOWED_STATUS.has(body.status))
      patch.status = body.status;
    if (typeof body.priority === 'string' && ALLOWED_PRIORITY.has(body.priority))
      patch.priority = body.priority;
    if (body.deadline !== undefined)
      patch.deadline = body.deadline ? new Date(body.deadline) : null;

    if (body.supervisorId !== undefined)
      patch.supervisorId = body.supervisorId || null;
    if (body.assigneeId !== undefined)
      patch.assigneeId = body.assigneeId || null;
    if (body.crewIds !== undefined)
      patch.crewIds = Array.isArray(body.crewIds)
        ? body.crewIds.filter((c: any) => typeof c === 'string')
        : null;

    if (body.materials !== undefined)
      patch.materials = this.normalizeMaterials(body.materials);
    if (body.budget !== undefined)
      patch.budget =
        typeof body.budget === 'number' && Number.isFinite(body.budget)
          ? Math.round(body.budget)
          : null;

    if (body.locationType !== undefined) {
      const lt = ALLOWED_LOCATION_TYPE.has(body.locationType)
        ? body.locationType
        : null;
      patch.locationType = lt;
      patch.locationDocId = lt === 'zone' ? body.locationDocId || null : null;
      patch.locationZoneId = lt === 'zone' ? body.locationZoneId || null : null;
      patch.locationText = lt === 'text' ? body.locationText || null : null;
    }

    if (body.stageId !== undefined) patch.stageId = body.stageId || null;
    if (body.milestoneId !== undefined)
      patch.milestoneId = body.milestoneId || null;

    if (body.metadata !== undefined)
      patch.metadata =
        body.metadata && typeof body.metadata === 'object' ? body.metadata : null;

    const [updated] = await this.db
      .update(schema.tasks)
      .set(patch)
      .where(eq(schema.tasks.id, id))
      .returning();

    return { success: true, data: updated };
  }

  /** ─── DELETE ────────────────────────────────────────────────────── */
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    const row = await this.db.query.tasks.findFirst({
      where: eq(schema.tasks.id, id),
    });
    if (!row) throw new NotFoundException('Task not found');
    if (row.projectId) await this.assertProjectAccess(row.projectId, req);

    await this.db.delete(schema.tasks).where(eq(schema.tasks.id, id));
    return { success: true };
  }
}
