const postgres = require('postgres');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const sql = postgres(process.env.DATABASE_URL);

async function dump() {
  try {
    const id = 'inv_1776038124208';
    let output = `Dumping ${id}...\n`;
    const [inv] = await sql`SELECT * FROM invoices WHERE id = ${id}`;
    if (inv) {
      output += '--- Draft ---\n';
      output += JSON.stringify(inv.draft, null, 2);
      
      if (inv.active_version_id) {
        const [version] = await sql`SELECT * FROM invoice_versions WHERE id = ${inv.active_version_id}`;
        if (version) {
          output += '\n\n--- Active Version Content ---\n';
          output += JSON.stringify(version.content, null, 2);
        }
      }
    } else {
      output += 'Not found';
    }
    fs.writeFileSync(path.join(__dirname, 'dump.json'), output, 'utf8');
    console.log('Written to dump.json');
  } catch (err) {
    console.error(err);
  } finally {
    await sql.end();
  }
}

dump();
