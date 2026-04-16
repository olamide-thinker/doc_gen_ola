import { Module } from '@nestjs/common';
import { OrganizationsController } from './organizations.controller';
import { BusinessesController } from '../businesses/businesses.controller';

@Module({
  controllers: [OrganizationsController, BusinessesController],
})
export class OrganizationsModule {}
