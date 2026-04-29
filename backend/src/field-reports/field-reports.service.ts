import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE_PROVIDER } from '../database/database.provider';
import * as schema from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';

@Injectable()
export class FieldReportsService {
  constructor(@Inject(DRIZZLE_PROVIDER) private db: any) {}

  /**
   * Generates the next report code for a project — REP-NNNNN, padded to 5
   * digits. Mirrors the TasksService.nextTaskCode pattern. Reads at insert
   * time so we never collide; the unique index on (projectId, reportCode)
   * is the safety net.
   */
  async nextReportCode(projectId: string): Promise<string> {
    const rows = await this.db
      .select({ code: schema.fieldReports.reportCode })
      .from(schema.fieldReports)
      .where(eq(schema.fieldReports.projectId, projectId));

    let max = 0;
    for (const r of rows) {
      const m = /^REP-(\d+)$/.exec(r.code || '');
      if (m) {
        const n = parseInt(m[1], 10);
        if (!isNaN(n) && n > max) max = n;
      }
    }
    return `REP-${String(max + 1).padStart(5, '0')}`;
  }
}
