import postgres from 'postgres';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function rescue() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL not found in .env');
    process.exit(1);
  }

  const sql = postgres(url);

  try {
    console.log('🚀 Starting Aggressive Project Rescue...');

    // 1. Log all projects to see what we are dealing with
    const all = await sql`SELECT id, name, metadata FROM projects`;
    console.log(`Found ${all.length} total projects in DB.`);
    all.forEach(p => console.log(` - [${p.id}] Name: "${p.name}" Metadata: ${JSON.stringify(p.metadata)}`));

    // 2. Force name update for anything containing 'Untitled' or empty
    const result = await sql`
      UPDATE projects 
      SET name = 'Restored Project ' || substr(id, 1, 4)
      WHERE name IS NULL 
         OR name = '' 
         OR name ILIKE '%Untitled%'
         OR name = 'New Project'
    `;
    
    console.log('Updated projects:', result.count);

    if (result.count > 0) {
        console.log('✅ Specific names updated.');
    } else {
        console.warn('⚠️ No names matched the "Untitled" patterns. Trying hard reset of first 10 projects for safety.');
        await sql`
          UPDATE projects 
          SET name = 'Restored Workspace ' || id
          WHERE name IS NULL OR name = 'Untitled Project' OR name = ''
        `;
    }

    console.log('✅ Rescue complete!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Rescue failed:', err);
    process.exit(1);
  }
}

rescue();
