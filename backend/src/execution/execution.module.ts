import { Module } from '@nestjs/common';
import { ExecutionController } from './execution.controller';

@Module({
  controllers: [ExecutionController],
})
export class ExecutionModule {}
