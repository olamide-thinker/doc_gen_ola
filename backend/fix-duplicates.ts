import postgres from 'postgres';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function fixDuplicates() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL not found in .env');
    process.exit(1);
  }

  const sql = postgres(url);

  try {
    console.log('🚀 Fixing Duplicate Projects...');

    const duplicates = await sql`
      SELECT business_id, name, COUNT(*) 
      FROM projects 
      GROUP BY business_id, name 
      HAVING COUNT(*) > 1
    `;

    console.log(`Found ${duplicates.length} sets of duplicates.`);

    for (const dup of duplicates) {
      console.log(`Fixing set: ${dup.name} for business ${dup.business_id}`);
      
      const instances = await sql`
        SELECT id, name, created_at 
        FROM projects 
        WHERE business_id = ${dup.business_id} AND name = ${dup.name}
        ORDER BY created_at DESC
      `;
      
      const toKeep = instances[0];
      const toRename = instances.slice(1);
      
      console.log(` - Keeping ${toKeep.id} as "${toKeep.name}"`);
      
      for (const victim of toRename) {
        const newName = `${victim.name} (Duplicate ${victim.id.slice(0, 4)})`;
        console.log(` - Renaming ${victim.id} to "${newName}"`);
        await sql`UPDATE projects SET name = ${newName} WHERE id = ${victim.id}`;
      }
    }

    console.log('✅ Duplicates fixed!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Fix failed:', err);
    process.exit(1);
  }
}

fixDuplicates();
