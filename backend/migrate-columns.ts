import postgres from 'postgres';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function migrate() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL not found in .env');
    process.exit(1);
  }

  const sql = postgres(url);

  try {
    console.log('🚀 Starting schema migration...');

    // 1. Folders table (projects_folders is the likely internal name or folders)
    // Checking both 'folders' and 'project_folders' based on Drizzle common naming
    console.log('Adding members column to folders...');
    await sql`ALTER TABLE folders ADD COLUMN IF NOT EXISTS members text[]`.catch(e => console.warn('folders skip:', e.message));
    
    console.log('Adding members column to documents...');
    await sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS members text[]`.catch(e => console.warn('documents skip:', e.message));
    
    console.log('Adding members column to invoices...');
    await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS members text[]`.catch(e => console.warn('invoices skip:', e.message));

    console.log('✅ Migration complete!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

migrate();
