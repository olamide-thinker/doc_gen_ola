const postgres = require('postgres');
require('dotenv').config({ path: '../.env' }); // Make sure dotenv runs

const sql = postgres(process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/syncsalez_local');

async function run() {
  try {
    console.log("Truncating versions tables...");
    await sql`TRUNCATE TABLE receipt_versions CASCADE`;
    await sql`TRUNCATE TABLE invoice_versions CASCADE`;
    
    // Also reset invoices and receipts status to draft, and drop active_version_id
    await sql`UPDATE invoices SET status = 'draft', active_version_id = NULL`;
    await sql`UPDATE receipts SET status = 'draft', active_version_id = NULL`;
    console.log("Cleanup complete!");
  } catch (e) {
    console.error(e);
  } finally {
    await sql.end();
  }
}

run();
