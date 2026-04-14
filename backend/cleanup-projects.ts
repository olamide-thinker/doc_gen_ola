import postgres from 'postgres';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function cleanup() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL not found in .env');
    process.exit(1);
  }

  const sql = postgres(url);

  try {
    console.log('🚀 Starting Project Cleanup...');

    // 1. Log all projects to see context
    const all = await sql`SELECT id, name, created_at, owner_id FROM projects ORDER BY created_at DESC`;
    console.log(`Found ${all.length} total projects.`);

    if (all.length > 5) {
        console.log('Deleting duplicate "Untitled" projects...');
        // Delete projects that have null name or 'Untitled Project' or 'New Project' and keep only the newest one
        const victims = all.slice(1).filter(p => !p.name || p.name === 'Untitled Project' || p.name === 'New Project' || p.name.includes('Restored'));
        
        for (const victim of victims) {
            console.log(` - Deleting ${victim.id} ("${victim.name}")`);
            await sql`DELETE FROM project_members WHERE project_id = ${victim.id}`;
            await sql`DELETE FROM projects WHERE id = ${victim.id}`;
        }
        console.log(`✅ Deleted ${victims.length} duplicates.`);
    }

    console.log('✅ Cleanup complete!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Cleanup failed:', err);
    process.exit(1);
  }
}

cleanup();
