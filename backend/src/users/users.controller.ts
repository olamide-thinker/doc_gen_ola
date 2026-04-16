import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Inject,
  Req,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { DRIZZLE_PROVIDER } from '../database/database.provider';
import * as schema from '../db/schema';
import { eq, or } from 'drizzle-orm';
import { FirebaseGuard } from '../auth/firebase.guard';
import * as crypto from 'crypto';

@Controller('api/users')
@UseGuards(FirebaseGuard)
export class UsersController {
  constructor(@Inject(DRIZZLE_PROVIDER) private db: any) {}

  @Get('profile')
  async getProfile(@Req() req: any) {
    const userId = req.user.uid;
    const email = req.user.email;
    const picture = req.user.picture;
    const name = req.user.name;

    // 1. Get user record
    let user = await this.db.query.users.findFirst({
      where: eq(schema.users.id, userId),
    });

    // Bootstrapping: Create user if missing in Postgres but present in Firebase
    if (!user && email) {
      console.log(`[Profile] 🚀 Bootstrapping new user: ${email} (${userId})`);
      await this.db.insert(schema.users).values({
        id: userId,
        email: email,
        fullName: name || email.split('@')[0],
        metadata: picture ? { picture } : {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }).onConflictDoNothing();

      user = await this.db.query.users.findFirst({
        where: eq(schema.users.id, userId),
      });
    } else if (user) {
      // Keep metadata fresh (photo + display name) so other users see the
      // latest avatar on project cards.
      const currentMeta: any = user.metadata || {};
      const needsUpdate =
        (picture && currentMeta.picture !== picture) ||
        (name && user.fullName !== name);
      if (needsUpdate) {
        await this.db.update(schema.users)
          .set({
            fullName: name || user.fullName,
            metadata: { ...currentMeta, picture: picture || currentMeta.picture },
            updatedAt: new Date(),
          })
          .where(eq(schema.users.id, userId));
        user = await this.db.query.users.findFirst({
          where: eq(schema.users.id, userId),
        });
      }
    }

    if (!user) {
      return { success: false, status: 404, data: null };
    }

    // 2. Identify the business by ownership (Primary) or membership
    let business = await this.db.query.businesses.findFirst({
      where: eq(schema.businesses.ownerId, userId),
    });

    if (!business) {
      // Create a default business if none exists for this owner
      console.log(`[Profile] 🏢 Creating default business for owner: ${email}`);
      const businessId = crypto.randomUUID();
      const businessName = `${user.fullName || 'My'}'s Workspace`;
      
      await this.db.insert(schema.businesses).values({
        id: businessId,
        name: businessName,
        ownerId: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      business = await this.db.query.businesses.findFirst({
        where: eq(schema.businesses.id, businessId),
      });
    }

    const businessId = business.id;
    const businessName = business.name;

    // 3. Find projects for this BUSINESS
    const allProjects = await this.db.query.projects.findMany({
      where: eq(schema.projects.businessId, businessId),
    });

    const projectId = allProjects.length > 0 ? allProjects[0].id : null;

    // 4. Extract business branding assets from business.metadata
    const businessMeta: any = business.metadata || {};
    const businessAssets = {
      logoUrl: businessMeta.logoUrl || null,
      letterheadUrl1: businessMeta.letterheadUrl1 || null,
      letterheadUrl2: businessMeta.letterheadUrl2 || null,
      letterheadUrl3: businessMeta.letterheadUrl3 || null,
    };

    // 5. Extract user profile from user.metadata
    const userMeta: any = user.metadata || {};
    const userProfile = {
      signatureUrl: userMeta.signatureUrl || null,
      bio: userMeta.bio || null,
      title: userMeta.title || null,
    };

    return {
      success: true,
      data: {
        ...user,
        businessId,
        businessName,
        projectId,
        role: 'owner',
        businessAssets,
        userProfile,
      },
    };
  }

  @Post('sync')
  async syncProfile(@Body() body: any, @Req() req: any) {
    const userId = req.user.uid;
    const email = req.user.email;

    const payload: any = {
      id: userId,
      email: email,
      fullName: body.fullName || req.user.name,
      phone: body.phone,
      metadata: {
        ...(body.metadata || {}),
        picture: req.user.picture,
        role: body.role,
      },
      updatedAt: new Date(),
    };

    // If a businessId was provided (e.g. after creating an org), save it
    if (body.businessId) {
      payload.businessId = body.businessId;
    }

    await this.db.insert(schema.users)
      .values({ ...payload, createdAt: new Date() })
      .onConflictDoUpdate({
        target: schema.users.id,
        set: payload,
      });

    return { success: true };
  }

  @Patch(':id')
  async updateUser(
    @Param('id') userId: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    // Verify user is updating their own profile
    if (req.user.uid !== userId) {
      throw new ForbiddenException('Can only update your own profile');
    }

    const user = await this.db.query.users.findFirst({
      where: eq(schema.users.id, userId),
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Merge metadata
    const currentMetadata = user.metadata || {};
    const updatedMetadata = {
      ...currentMetadata,
      ...(body.metadata || {}),
    };

    // Update user
    await this.db.update(schema.users)
      .set({
        fullName: body.displayName || body.fullName || user.fullName,
        metadata: updatedMetadata,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, userId));

    const updated = await this.db.query.users.findFirst({
      where: eq(schema.users.id, userId),
    });

    return { success: true, data: updated };
  }
}
