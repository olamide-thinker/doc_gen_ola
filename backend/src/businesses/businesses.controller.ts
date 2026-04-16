import {
  Controller,
  Patch,
  Param,
  Body,
  UseGuards,
  Inject,
  Req,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { DRIZZLE_PROVIDER } from '../database/database.provider';
import * as schema from '../db/schema';
import { eq } from 'drizzle-orm';
import { FirebaseGuard } from '../auth/firebase.guard';

@Controller('api/businesses')
@UseGuards(FirebaseGuard)
export class BusinessesController {
  constructor(@Inject(DRIZZLE_PROVIDER) private db: any) {}

  @Patch(':id')
  async updateBusiness(
    @Param('id') businessId: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const userId = req.user.uid;

    // Find the business
    const business = await this.db.query.businesses.findFirst({
      where: eq(schema.businesses.id, businessId),
    });

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    // Verify user is the owner
    if (business.ownerId !== userId) {
      throw new ForbiddenException('Only the business owner can update settings');
    }

    // Merge metadata
    const currentMetadata = business.metadata || {};
    const updatedMetadata = {
      ...currentMetadata,
      ...(body.metadata || {}),
    };

    // Update business
    await this.db.update(schema.businesses)
      .set({
        name: body.name || business.name,
        metadata: updatedMetadata,
        updatedAt: new Date(),
      })
      .where(eq(schema.businesses.id, businessId));

    const updated = await this.db.query.businesses.findFirst({
      where: eq(schema.businesses.id, businessId),
    });

    return { success: true, data: updated };
  }
}
