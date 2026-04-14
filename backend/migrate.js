const postgres = require('postgres');
require('dotenv').config();

const sql = postgres(process.env.DATABASE_URL);

async function migrate() {
  console.log('Running migration...');
  try {
    await sql`ALTER TABLE receipt_versions ALTER COLUMN sequence TYPE integer USING sequence::integer;`;
    console.log('Migration successful!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await sql.end();
  }
}

migrate();
