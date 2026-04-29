import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE_PROVIDER } from '../database/database.provider';
import * as schema from '../db/schema';
import { eq, desc } from 'drizzle-orm';

/**
 * Generates the next task code for a project (e.g. TSK-001 → TSK-002).
 * Reads the highest existing taskCode in the project and increments the suffix.
 *
 * Note: this isn't transactional. For Phase 1 (single-tenant, low concurrency)
 * this is fine. If we ever see contention, swap to a sequence column on
 * `projects` (or a dedicated counter table) and `RETURNING` it on update.
 */
@Injectable()
export class TasksService {
  constructor(@Inject(DRIZZLE_PROVIDER) private db: any) {}

  async nextTaskCode(projectId: string): Promise<string> {
    const last = await this.db.query.tasks.findFirst({
      where: eq(schema.tasks.projectId, projectId),
      orderBy: [desc(schema.tasks.createdAt)],
      columns: { taskCode: true },
    });

    let next = 1;
    if (last?.taskCode) {
      const m = String(last.taskCode).match(/TSK-(\d+)/i);
      if (m) {
        // Be safe: scan all tasks for max suffix in case createdAt order doesn't match.
        const all = await this.db.query.tasks.findMany({
          where: eq(schema.tasks.projectId, projectId),
          columns: { taskCode: true },
        });
        const maxSuffix = all.reduce((acc: number, row: any) => {
          const m2 = String(row.taskCode || '').match(/TSK-(\d+)/i);
          return m2 ? Math.max(acc, parseInt(m2[1], 10)) : acc;
        }, 0);
        next = maxSuffix + 1;
      }
    }

    return `TSK-${String(next).padStart(3, '0')}`;
  }
}
