import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './src/db/schema';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), 'backend', '.env') });

const queryClient = postgres(process.env.DATABASE_URL!);
const db = drizzle(queryClient, { schema });

async function checkProjects() {
  try {
    const allProj = await db.query.projects.findMany({
      limit: 20,
      with: { members: true },
    });
    console.log('--- ALL PROJECTS (Last 20) ---');
    console.log(JSON.stringify(allProj, null, 2));

    const allMembers = await db.query.projectMembers.findMany({ limit: 20 });
    console.log('--- PROJECT MEMBERS (Last 20) ---');
    console.log(JSON.stringify(allMembers, null, 2));

    process.exit(0);
  } catch (err) {
    console.error('Diagnostic failed:', err);
    process.exit(1);
  }
}

checkProjects();
