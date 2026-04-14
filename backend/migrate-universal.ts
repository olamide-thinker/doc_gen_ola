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
    console.log('🚀 Starting Universal Schema Audit...');

    // 1. Find all tables
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    
    const tableNames = tables.map(t => t.table_name);
    console.log('Found tables:', tableNames.join(', '));

    const columnsToAdd = ['members', 'metadata'];
    
    for (const tableName of tableNames) {
      // Check for folders/documents/projects/invoices
      const match = /folder|document|project|invoice/i.test(tableName);
      if (match) {
        console.log(`Checking table: ${tableName}...`);
        
        // Add members column (text array)
        if (!tableName.includes('projects')) { // projects usually uses memberships table, but for safety:
             await sql.unsafe(`ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS members text[]`).catch(e => {});
        }
        
        // Add metadata column (jsonb)
        await sql.unsafe(`ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS metadata jsonb`).catch(e => {});
      }
    }

    console.log('✅ Universal Migration complete!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Universal Migration failed:', err);
    process.exit(1);
  }
}

migrate();
