import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Inject,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { DRIZZLE_PROVIDER } from '../database/database.provider';
import * as schema from '../db/schema';
import { eq } from 'drizzle-orm';
import { FirebaseGuard } from '../auth/firebase.guard';
import * as crypto from 'crypto';

@Controller('api/organizations')
@UseGuards(FirebaseGuard)
export class OrganizationsController {
  constructor(@Inject(DRIZZLE_PROVIDER) private db: any) {}

  @Get()
  async getMyOrganizations(@Req() req: any) {
    const userId = req.user.uid;
    const owned = await this.db.query.businesses.findMany({
      where: eq(schema.businesses.ownerId, userId),
      with: {
        projects: true,
      },
    });

    return { success: true, data: owned };
  }

  @Post()
  async createOrganization(@Body() body: any, @Req() req: any) {
    const userId = req.user.uid;
    const email = req.user.email || (await this.db.query.users.findFirst({ where: eq(schema.users.id, userId) }))?.email;

    if (!email) {
      throw new BadRequestException('User email not found for organization creation');
    }

    const orgId = body.id || crypto.randomUUID();

    // Ensure user exists in Postgres first (Foreign Key requirement)
    await this.db.insert(schema.users)
      .values({
        id: userId,
        email: email || 'user@local',
        businessId: orgId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.users.id,
        set: { businessId: orgId, updatedAt: new Date() },
      });

    const newOrg = {
      id: orgId,
      name: body.name,
      ownerId: userId,
      metadata: body.metadata || {},
      updatedAt: new Date(),
      createdAt: new Date(),
    };

    await this.db.insert(schema.businesses).values(newOrg);

    // Automatically create a default project for the new organization
    const defaultProjId = crypto.randomUUID();
    await this.db.insert(schema.projects).values({
      id: defaultProjId,
      businessId: orgId,
      name: 'Main Project',
      ownerId: userId,
      metadata: { isDefault: true },
      updatedAt: new Date(),
      createdAt: new Date(),
    });

    // Add creator as project member (owner)
    await this.db.insert(schema.projectMembers).values({
      projectId: defaultProjId,
      userId: userId,
      email: email,
      role: 'owner',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return {
      success: true,
      organizationId: orgId,
      defaultProjectId: defaultProjId,
    };
  }

  @Post('join/:id')
  async joinOrganization(@Param('id') id: string, @Req() req: any) {
    const userId = req.user.uid;
    const email = req.user.email || (await this.db.query.users.findFirst({ where: eq(schema.users.id, userId) }))?.email;

    if (!email) {
      throw new BadRequestException('User email not found for workspace join');
    }

    // 1. Ensure user exists
    await this.db.insert(schema.users)
      .values({
        id: userId,
        email: email,
        businessId: id,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.users.id,
        set: { businessId: id, updatedAt: new Date() },
      });

    // 2. Find the default project in this business and add the user as a member
    const defaultProject = await this.db.query.projects.findFirst({
      where: eq(schema.projects.businessId, id),
    });

    if (defaultProject) {
      await this.db.insert(schema.projectMembers)
        .values({
          projectId: defaultProject.id,
          userId: userId,
          email: email,
          role: 'viewer',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [schema.projectMembers.projectId, schema.projectMembers.userId],
          set: { updatedAt: new Date() }
        });
    }

    return { success: true };
  }
}
