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
import { eq, and, or, asc } from 'drizzle-orm';
import { FirebaseGuard } from '../auth/firebase.guard';

const ALLOWED_STATUS = new Set(['pending', 'active', 'done', 'cancelled']);

/**
 * Execution module — stages (phases) and milestones for a project.
 *
 * Hierarchy: project → stage → milestone → tasks (already exists).
 * Status rolls up at read time so there's no eager bookkeeping to keep
 * consistent.
 */
@Controller('api/execution')
@UseGuards(FirebaseGuard)
export class ExecutionController {
  constructor(@Inject(DRIZZLE_PROVIDER) private db: any) {}

  /** Project-membership gate. */
  private async assertProjectAccess(projectId: string, req: any): Promise<void> {
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
      where: and(eq(schema.projectMembers.projectId, projectId), or(...memberConds)),
    });
    if (!member) throw new ForbiddenException('Not a member of this project');
  }

  /**
   * Compute aggregate stats + status for a stage based on its milestones and
   * their tasks. Returned alongside the stored stage so the UI can render
   * progress without N additional queries.
   */
  private async hydrateStage(stage: any): Promise<any> {
    const ms = await this.db.query.milestones.findMany({
      where: eq(schema.milestones.stageId, stage.id),
      orderBy: [asc(schema.milestones.position), asc(schema.milestones.createdAt)],
    });

    const milestoneIds = ms.map((m: any) => m.id);
    const tasksForStage = milestoneIds.length
      ? await this.db.query.tasks.findMany({
          where: and(
            eq(schema.tasks.projectId, stage.projectId),
            // tasks.milestoneId is text; uuid columns are returned as strings,
            // so a plain equality on the stringified id works either way.
          ),
        })
      : [];

    let mDone = 0;
    const milestonesHydrated = ms.map((m: any) => {
      const myTasks = tasksForStage.filter((t: any) => t.milestoneId === m.id);
      const tDone = myTasks.filter((t: any) => t.status === 'done').length;
      const allDone = myTasks.length > 0 && tDone === myTasks.length;
      const computedStatus = allDone ? 'done' : m.status;
      if (computedStatus === 'done') mDone += 1;
      return {
        ...m,
        taskCount: myTasks.length,
        taskDoneCount: tDone,
        computedStatus,
      };
    });

    const allMsDone = ms.length > 0 && mDone === ms.length;
    return {
      ...stage,
      milestoneCount: ms.length,
      milestoneDoneCount: mDone,
      computedStatus: allMsDone ? 'done' : stage.status,
      milestones: milestonesHydrated,
    };
  }

  // ─── STAGES ─────────────────────────────────────────────────────────────

  @Get('stages')
  async listStages(@Query('projectId') projectId: string, @Req() req: any) {
    if (!projectId) throw new BadRequestException('projectId is required');
    await this.assertProjectAccess(projectId, req);

    const stages = await this.db.query.stages.findMany({
      where: eq(schema.stages.projectId, projectId),
      orderBy: [asc(schema.stages.position), asc(schema.stages.createdAt)],
    });

    const hydrated = await Promise.all(stages.map((s: any) => this.hydrateStage(s)));
    return { success: true, data: hydrated };
  }

  @Post('stages')
  async createStage(@Body() body: any, @Req() req: any) {
    const projectId = body?.projectId;
    if (!projectId) throw new BadRequestException('projectId is required');
    await this.assertProjectAccess(projectId, req);
    const name = String(body.name || '').trim();
    if (!name) throw new BadRequestException('name is required');

    // Default position to end of list
    const existing = await this.db.query.stages.findMany({
      where: eq(schema.stages.projectId, projectId),
      columns: { position: true },
    });
    const maxPos = existing.reduce((acc: number, s: any) => Math.max(acc, s.position || 0), -1);
    const position = typeof body.position === 'number' ? body.position : maxPos + 1;

    const proj = await this.db.query.projects.findFirst({
      where: eq(schema.projects.id, projectId),
      columns: { businessId: true },
    });

    const status = ALLOWED_STATUS.has(body.status) ? body.status : 'pending';

    const [created] = await this.db.insert(schema.stages).values({
      projectId,
      businessId: proj?.businessId || null,
      name,
      position,
      timeline: body.timeline || null,
      description: body.description || null,
      note: body.note || null,
      status,
      metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : null,
    }).returning();

    return { success: true, data: created };
  }

  @Patch('stages/:id')
  async updateStage(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const row = await this.db.query.stages.findFirst({
      where: eq(schema.stages.id, id),
    });
    if (!row) throw new NotFoundException('Stage not found');
    if (row.projectId) await this.assertProjectAccess(row.projectId, req);

    const patch: any = { updatedAt: new Date() };
    if (typeof body.name === 'string') patch.name = body.name.trim();
    if (typeof body.position === 'number') patch.position = body.position;
    if (body.timeline !== undefined) patch.timeline = body.timeline || null;
    if (body.description !== undefined) patch.description = body.description || null;
    if (body.note !== undefined) patch.note = body.note || null;
    if (typeof body.status === 'string' && ALLOWED_STATUS.has(body.status)) patch.status = body.status;
    if (body.metadata !== undefined) {
      patch.metadata = body.metadata && typeof body.metadata === 'object' ? body.metadata : null;
    }

    const [updated] = await this.db.update(schema.stages).set(patch).where(eq(schema.stages.id, id)).returning();
    return { success: true, data: updated };
  }

  @Delete('stages/:id')
  async deleteStage(@Param('id') id: string, @Req() req: any) {
    const row = await this.db.query.stages.findFirst({
      where: eq(schema.stages.id, id),
    });
    if (!row) throw new NotFoundException('Stage not found');
    if (row.projectId) await this.assertProjectAccess(row.projectId, req);
    // CASCADE on stageId in milestones means deleting a stage drops its
    // milestones too. Tasks have milestoneId/stageId as plain text — they
    // become orphaned references but their rows survive.
    await this.db.delete(schema.stages).where(eq(schema.stages.id, id));
    return { success: true };
  }

  // ─── MILESTONES ─────────────────────────────────────────────────────────

  @Post('milestones')
  async createMilestone(@Body() body: any, @Req() req: any) {
    const stageId = body?.stageId;
    if (!stageId) throw new BadRequestException('stageId is required');
    const stage = await this.db.query.stages.findFirst({
      where: eq(schema.stages.id, stageId),
    });
    if (!stage) throw new NotFoundException('Stage not found');
    if (stage.projectId) await this.assertProjectAccess(stage.projectId, req);

    const name = String(body.name || '').trim();
    if (!name) throw new BadRequestException('name is required');

    const existing = await this.db.query.milestones.findMany({
      where: eq(schema.milestones.stageId, stageId),
      columns: { position: true },
    });
    const maxPos = existing.reduce((acc: number, m: any) => Math.max(acc, m.position || 0), -1);
    const position = typeof body.position === 'number' ? body.position : maxPos + 1;

    const status = ALLOWED_STATUS.has(body.status) ? body.status : 'pending';

    const [created] = await this.db.insert(schema.milestones).values({
      stageId,
      projectId: stage.projectId,
      businessId: stage.businessId,
      name,
      position,
      description: body.description || null,
      note: body.note || null,
      status,
      metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : null,
    }).returning();

    return { success: true, data: created };
  }

  @Patch('milestones/:id')
  async updateMilestone(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const row = await this.db.query.milestones.findFirst({
      where: eq(schema.milestones.id, id),
    });
    if (!row) throw new NotFoundException('Milestone not found');
    if (row.projectId) await this.assertProjectAccess(row.projectId, req);

    const patch: any = { updatedAt: new Date() };
    if (typeof body.name === 'string') patch.name = body.name.trim();
    if (typeof body.position === 'number') patch.position = body.position;
    if (body.description !== undefined) patch.description = body.description || null;
    if (body.note !== undefined) patch.note = body.note || null;
    if (typeof body.status === 'string' && ALLOWED_STATUS.has(body.status)) patch.status = body.status;
    if (body.metadata !== undefined) {
      patch.metadata = body.metadata && typeof body.metadata === 'object' ? body.metadata : null;
    }

    const [updated] = await this.db.update(schema.milestones).set(patch).where(eq(schema.milestones.id, id)).returning();
    return { success: true, data: updated };
  }

  @Delete('milestones/:id')
  async deleteMilestone(@Param('id') id: string, @Req() req: any) {
    const row = await this.db.query.milestones.findFirst({
      where: eq(schema.milestones.id, id),
    });
    if (!row) throw new NotFoundException('Milestone not found');
    if (row.projectId) await this.assertProjectAccess(row.projectId, req);
    await this.db.delete(schema.milestones).where(eq(schema.milestones.id, id));
    return { success: true };
  }

  // ─── EXECUTION PLAN (project metadata) ───────────────────────────────────

  /**
   * The "Project Duration" + "Project Notes & Conditions" content is stored on
   * the project row's metadata JSONB so it lives next to the project itself.
   */
  @Get('plan')
  async getExecutionPlan(@Query('projectId') projectId: string, @Req() req: any) {
    if (!projectId) throw new BadRequestException('projectId is required');
    await this.assertProjectAccess(projectId, req);
    const proj = await this.db.query.projects.findFirst({
      where: eq(schema.projects.id, projectId),
    });
    if (!proj) throw new NotFoundException('Project not found');
    const md = (proj.metadata as any) || {};
    return {
      success: true,
      data: md.executionPlan || { estimatedTimeline: '', conditions: '' },
    };
  }

  @Patch('plan')
  async updateExecutionPlan(@Body() body: any, @Req() req: any) {
    const projectId = body?.projectId;
    if (!projectId) throw new BadRequestException('projectId is required');
    await this.assertProjectAccess(projectId, req);
    const proj = await this.db.query.projects.findFirst({
      where: eq(schema.projects.id, projectId),
    });
    if (!proj) throw new NotFoundException('Project not found');

    const md: any = (proj.metadata as any) || {};
    const plan = md.executionPlan || {};
    if (typeof body.estimatedTimeline === 'string') plan.estimatedTimeline = body.estimatedTimeline;
    if (typeof body.conditions === 'string') plan.conditions = body.conditions;
    md.executionPlan = plan;

    await this.db
      .update(schema.projects)
      .set({ metadata: md, updatedAt: new Date() })
      .where(eq(schema.projects.id, projectId));

    return { success: true, data: plan };
  }

  // ─── TEMPLATE ───────────────────────────────────────────────────────────

  /**
   * Apply the canonical 7-phase interior-execution template to a project.
   * Skipped if the project already has stages.
   */
  @Post('template/apply')
  async applyTemplate(@Body() body: any, @Req() req: any) {
    const projectId = body?.projectId;
    if (!projectId) throw new BadRequestException('projectId is required');
    await this.assertProjectAccess(projectId, req);

    const existing = await this.db.query.stages.findMany({
      where: eq(schema.stages.projectId, projectId),
      columns: { id: true },
    });
    if (existing.length > 0 && body.force !== true) {
      throw new BadRequestException(
        'Project already has an execution plan. Pass `force: true` to replace it.',
      );
    }

    const proj = await this.db.query.projects.findFirst({
      where: eq(schema.projects.id, projectId),
      columns: { businessId: true },
    });

    if (existing.length > 0 && body.force === true) {
      // Replace: drop existing stages (cascade drops milestones).
      await this.db.delete(schema.stages).where(eq(schema.stages.projectId, projectId));
    }

    const TEMPLATE: Array<{
      name: string;
      timeline: string;
      description?: string;
      note?: string;
      milestones: Array<{ name: string; description?: string }>;
    }> = [
      {
        name: 'Procurement & Sourcing',
        timeline: 'Week 1',
        description: 'Sourcing of furniture, appliances, lighting fixtures, AC units, textiles, and solar/inverter components. Procurement runs alongside active site operations with progressive delivery.',
        milestones: [
          { name: 'Sourcing of furniture (incl. specialty pieces)' },
          { name: 'Procurement of appliances (TV, refrigeration, kitchen)' },
          { name: 'Selection and purchase of lighting fixtures' },
          { name: 'Sourcing of AC units' },
          { name: 'Textile selection: curtains, fabrics, décor' },
          { name: 'Solar / Inverter system components' },
          { name: 'Confirmed procurement list & logistics schedule' },
        ],
      },
      {
        name: 'Site Preparation & Strip-Out',
        timeline: 'Weeks 2 – 3',
        description: 'Removal of outdated fixtures and fittings, surface preparation, civil and masonry work, protective masking, and site clearing.',
        milestones: [
          { name: 'Removal of outdated fixtures and fittings' },
          { name: 'Door maintenance at identified locations' },
          { name: 'Surface preparation for new installations' },
          { name: 'Civil work and masonry' },
          { name: 'Site cleared and ready for structural installations' },
        ],
      },
      {
        name: 'Core Installations',
        timeline: 'Weeks 4 – 6',
        description: 'Ceilings, electrical, AC, inverter/solar infrastructure, primary kitchen installation, and staircase modifications.',
        milestones: [
          { name: 'Ceiling works (POP / Gypsum)' },
          { name: 'Electrical wiring and lighting infrastructure' },
          { name: 'AC installation (units and copper piping)' },
          { name: 'Inverter / Solar infrastructure' },
          { name: 'Primary kitchen installation' },
          { name: 'Staircase modification and closure detailing' },
        ],
      },
      {
        name: 'Joinery & Fixed Installations',
        timeline: 'Weeks 7 – 9',
        description: 'Custom wardrobes, TV consoles, kitchen finishing, internal doors, home office, pantry construction.',
        milestones: [
          { name: 'Installation of custom wardrobes' },
          { name: 'TV consoles and feature wall treatments' },
          { name: 'Kitchen finishing and hardware fitting' },
          { name: 'Installation of new internal doors' },
          { name: 'Home office setup' },
          { name: 'Pantry construction and shelving' },
        ],
      },
      {
        name: 'Furniture, Appliances & Styling',
        timeline: 'Weeks 10 – 11',
        description: 'Loose furniture placement, lighting and décor, window treatments, final styling.',
        milestones: [
          { name: 'Installation of loose furniture (Living, Dining, Bedrooms)' },
          { name: 'Placement of specialty seating' },
          { name: 'Installation of chandeliers and decorative lighting' },
          { name: 'Wall-mounting of TV units' },
          { name: 'Window treatments and curtain installation' },
          { name: 'Final placement of décor elements' },
        ],
      },
      {
        name: 'External Works',
        timeline: 'Week 11',
        description: 'Soft landscaping, planting, and exterior aesthetic enhancements.',
        note: 'Scheduled to overlap with the Furniture & Styling phase.',
        milestones: [
          { name: 'External soft landscaping and horticulture' },
          { name: 'Planting of greenery and floral arrangements' },
          { name: 'Exterior aesthetic enhancements' },
        ],
      },
      {
        name: 'Testing & Handover',
        timeline: 'Week 12',
        description: 'Full systems test, snagging, client walkthrough and handover.',
        milestones: [
          { name: 'Comprehensive testing of electrical and AC systems' },
          { name: 'Appliance performance checks' },
          { name: 'Final snagging and aesthetic corrections' },
          { name: 'Client walkthrough and formal handover' },
        ],
      },
    ];

    const createdStages: any[] = [];
    for (let i = 0; i < TEMPLATE.length; i++) {
      const phase = TEMPLATE[i];
      const [stage] = await this.db.insert(schema.stages).values({
        projectId,
        businessId: proj?.businessId || null,
        name: phase.name,
        position: i,
        timeline: phase.timeline,
        description: phase.description || null,
        note: phase.note || null,
        status: 'pending',
      }).returning();

      for (let j = 0; j < phase.milestones.length; j++) {
        const ms = phase.milestones[j];
        await this.db.insert(schema.milestones).values({
          stageId: stage.id,
          projectId,
          businessId: proj?.businessId || null,
          name: ms.name,
          position: j,
          description: ms.description || null,
          status: 'pending',
        });
      }

      createdStages.push(stage);
    }

    // Seed default execution-plan metadata too if not already set.
    const projRow = await this.db.query.projects.findFirst({
      where: eq(schema.projects.id, projectId),
    });
    const md: any = (projRow?.metadata as any) || {};
    if (!md.executionPlan) {
      md.executionPlan = {
        estimatedTimeline: '12 Weeks',
        conditions:
          'Final duration is subject to procurement lead times and site conditions. Timely client approvals and material selections are critical; delays in vendor confirmation or funding will impact the final delivery date. Variations outside the approved scope will be documented and may affect cost and timeline.',
      };
      await this.db
        .update(schema.projects)
        .set({ metadata: md, updatedAt: new Date() })
        .where(eq(schema.projects.id, projectId));
    }

    return { success: true, data: { stages: createdStages.length } };
  }
}
