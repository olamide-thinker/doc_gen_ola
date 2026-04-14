import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { UploadsModule } from './uploads/uploads.module';
import { HocuspocusModule } from './hocuspocus/hocuspocus.module';
import { InvoicesModule } from './invoices/invoices.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { UsersModule } from './users/users.module';
import { ProjectsModule } from './projects/projects.module';
import { PdfModule } from './pdf/pdf.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    WorkspacesModule,
    UploadsModule,
    HocuspocusModule,
    InvoicesModule,
    OrganizationsModule,
    UsersModule,
    ProjectsModule,
    PdfModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
