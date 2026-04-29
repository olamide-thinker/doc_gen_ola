import { Module } from '@nestjs/common';
import { AccountingController } from './accounting.controller';
import { InvoicesModule } from '../invoices/invoices.module';

@Module({
  // InvoicesService gives us calculateInvoiceTotals so we don't duplicate
  // the formula evaluator.
  imports: [InvoicesModule],
  controllers: [AccountingController],
})
export class AccountingModule {}
