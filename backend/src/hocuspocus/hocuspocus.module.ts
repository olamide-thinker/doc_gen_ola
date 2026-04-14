import { Module } from '@nestjs/common';
import { HocuspocusService } from './hocuspocus.service';

@Module({
  providers: [HocuspocusService],
})
export class HocuspocusModule {}
