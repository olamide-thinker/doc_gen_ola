import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { InvoicesModule } from '../invoices/invoices.module';

@Module({
  // Pull InvoicesModule in so the financials endpoint can reuse
  // InvoicesService.calculateInvoiceTotals + computeInvoiceTotals.
  imports: [InvoicesModule],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
