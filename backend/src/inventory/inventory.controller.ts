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
import { eq, and, asc } from 'drizzle-orm';
import { FirebaseGuard } from '../auth/firebase.guard';

@Controller('api/inventory')
@UseGuards(FirebaseGuard)
export class InventoryController {
  constructor(@Inject(DRIZZLE_PROVIDER) private db: any) {}

  /** Business-membership gate — categories live at the business level. */
  private async assertBusinessAccess(
    businessId: string,
    req: any,
  ): Promise<void> {
    const userId = req.user.uid;

    // Owner of any project in the business or any explicit member of any
    // project in the business counts as a business member for this check.
    // We don't have an explicit business_members table yet, so fall back
    // to checking if the user owns or is a member of any project tied to
    // this business.
    const business = await this.db.query.businesses.findFirst({
      where: eq(schema.businesses.id, businessId),
    });
    if (!business) throw new NotFoundException('Business not found');

    if ((business as any).ownerId === userId) return;

    const projects = await this.db.query.projects.findMany({
      where: eq(schema.projects.businessId, businessId),
      columns: { id: true, ownerId: true },
    });
    if (projects.some((p: any) => p.ownerId === userId)) return;

    const memberships = await this.db.query.projectMembers.findMany({
      where: eq(schema.projectMembers.userId, userId),
      columns: { projectId: true },
    });
    const memberProjectIds = new Set(memberships.map((m: any) => m.projectId));
    if (projects.some((p: any) => memberProjectIds.has(p.id))) return;

    throw new ForbiddenException('Not a member of this business');
  }

  // ── LIST ────────────────────────────────────────────────────────────
  @Get('categories')
  async list(@Query('businessId') businessId: string, @Req() req: any) {
    if (!businessId)
      throw new BadRequestException('businessId is required');
    await this.assertBusinessAccess(businessId, req);

    const rows = await this.db.query.inventoryCategories.findMany({
      where: eq(schema.inventoryCategories.businessId, businessId),
      orderBy: [
        asc(schema.inventoryCategories.position),
        asc(schema.inventoryCategories.name),
      ],
    });

    return { success: true, data: rows };
  }

  // ── DETAIL ──────────────────────────────────────────────────────────
  @Get('categories/:id')
  async detail(@Param('id') id: string, @Req() req: any) {
    const row = await this.db.query.inventoryCategories.findFirst({
      where: eq(schema.inventoryCategories.id, id),
    });
    if (!row) throw new NotFoundException('Category not found');
    await this.assertBusinessAccess(row.businessId, req);
    return { success: true, data: row };
  }

  // ── CREATE ──────────────────────────────────────────────────────────
  @Post('categories')
  async create(@Body() body: any, @Req() req: any) {
    const businessId = body?.businessId;
    if (!businessId)
      throw new BadRequestException('businessId is required');
    await this.assertBusinessAccess(businessId, req);

    const name = String(body.name || '').trim();
    if (!name) throw new BadRequestException('name is required');

    // Soft-uniqueness check before insert so we return a friendly error
    // instead of a raw constraint violation. The unique index is the
    // hard backstop.
    const existing = await this.db.query.inventoryCategories.findFirst({
      where: and(
        eq(schema.inventoryCategories.businessId, businessId),
        eq(schema.inventoryCategories.name, name),
      ),
    });
    if (existing) {
      throw new BadRequestException(
        `A category named "${name}" already exists`,
      );
    }

    const insert: any = {
      businessId,
      name,
      description:
        typeof body.description === 'string' ? body.description : null,
      color: typeof body.color === 'string' ? body.color : null,
      position:
        typeof body.position === 'number' && Number.isFinite(body.position)
          ? body.position
          : 0,
      metadata:
        body.metadata && typeof body.metadata === 'object' ? body.metadata : null,
    };

    const [created] = await this.db
      .insert(schema.inventoryCategories)
      .values(insert)
      .returning();

    return { success: true, data: created };
  }

  // ── UPDATE ──────────────────────────────────────────────────────────
  @Patch('categories/:id')
  async update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const row = await this.db.query.inventoryCategories.findFirst({
      where: eq(schema.inventoryCategories.id, id),
    });
    if (!row) throw new NotFoundException('Category not found');
    await this.assertBusinessAccess(row.businessId, req);

    const patch: any = { updatedAt: new Date() };

    if (typeof body.name === 'string') {
      const name = body.name.trim();
      if (!name) throw new BadRequestException('name cannot be empty');
      // Re-check uniqueness only when the name actually changes.
      if (name !== row.name) {
        const existing = await this.db.query.inventoryCategories.findFirst({
          where: and(
            eq(schema.inventoryCategories.businessId, row.businessId),
            eq(schema.inventoryCategories.name, name),
          ),
        });
        if (existing) {
          throw new BadRequestException(
            `A category named "${name}" already exists`,
          );
        }
      }
      patch.name = name;
    }
    if (body.description !== undefined)
      patch.description =
        typeof body.description === 'string' ? body.description : null;
    if (body.color !== undefined)
      patch.color = typeof body.color === 'string' ? body.color : null;
    if (
      typeof body.position === 'number' &&
      Number.isFinite(body.position)
    )
      patch.position = body.position;
    if (body.metadata !== undefined)
      patch.metadata =
        body.metadata && typeof body.metadata === 'object' ? body.metadata : null;

    const [updated] = await this.db
      .update(schema.inventoryCategories)
      .set(patch)
      .where(eq(schema.inventoryCategories.id, id))
      .returning();

    return { success: true, data: updated };
  }

  // ── DELETE ──────────────────────────────────────────────────────────
  @Delete('categories/:id')
  async remove(@Param('id') id: string, @Req() req: any) {
    const row = await this.db.query.inventoryCategories.findFirst({
      where: eq(schema.inventoryCategories.id, id),
    });
    if (!row) throw new NotFoundException('Category not found');
    await this.assertBusinessAccess(row.businessId, req);

    // No FK back-references yet (V1 — invoices reference categories via
    // metadata.categoryId, which is a soft link). When V2 lands the
    // inventory_items table, deletion will cascade to items.
    await this.db
      .delete(schema.inventoryCategories)
      .where(eq(schema.inventoryCategories.id, id));

    return { success: true };
  }

  /**
   * Seed the canonical default categories. Idempotent — skips any category
   * whose name already exists for this business. Useful as a one-tap "set
   * me up" action on the empty state.
   */
  @Post('categories/seed-defaults')
  async seedDefaults(@Body() body: any, @Req() req: any) {
    const businessId = body?.businessId;
    if (!businessId)
      throw new BadRequestException('businessId is required');
    await this.assertBusinessAccess(businessId, req);

    const defaults = [
      { name: 'Materials', color: 'blue', description: 'Sand, cement, blocks, finishes…' },
      { name: 'Labour', color: 'amber', description: 'Crew payments and wages' },
      { name: 'Fuel', color: 'red', description: 'Diesel, petrol, generator fuel' },
      { name: 'Equipment', color: 'emerald', description: 'Plant hire, tools, machinery' },
      { name: 'Subcontractors', color: 'violet', description: 'Specialist trade providers' },
      { name: 'Logistics', color: 'sky', description: 'Transport, haulage, deliveries' },
      { name: 'Other', color: 'slate', description: 'Everything else' },
    ];

    const created: any[] = [];
    let position = 0;
    for (const d of defaults) {
      const existing = await this.db.query.inventoryCategories.findFirst({
        where: and(
          eq(schema.inventoryCategories.businessId, businessId),
          eq(schema.inventoryCategories.name, d.name),
        ),
      });
      if (existing) {
        position++;
        continue;
      }
      const [row] = await this.db
        .insert(schema.inventoryCategories)
        .values({
          businessId,
          name: d.name,
          description: d.description,
          color: d.color,
          position: position++,
        })
        .returning();
      created.push(row);
    }

    return { success: true, data: { created, skipped: defaults.length - created.length } };
  }
}
