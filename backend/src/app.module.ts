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
import { TasksModule } from './tasks/tasks.module';
import { ExecutionModule } from './execution/execution.module';
import { FieldReportsModule } from './field-reports/field-reports.module';

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
    TasksModule,
    ExecutionModule,
    FieldReportsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
