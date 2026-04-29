/**
 * One-shot migration runner — applies all SQL files in ./drizzle/ that haven't
 * already been recorded in the `_drizzle_migrations` table.
 *
 * drizzle-kit v0.20 doesn't ship a built-in `migrate` command, so this stub
 * does the same thing the official migrator does: read the journal, find any
 * unapplied migration files, run them inside a transaction, then record them.
 */
const postgres = require('postgres');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function run() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const sql = postgres(url, { max: 1 });

  try {
    // Ensure the bookkeeping table exists.
    await sql`
      CREATE TABLE IF NOT EXISTS "_drizzle_migrations" (
        id SERIAL PRIMARY KEY,
        hash TEXT NOT NULL UNIQUE,
        created_at BIGINT
      )
    `;

    const journalPath = path.join(__dirname, 'drizzle', 'meta', '_journal.json');
    if (!fs.existsSync(journalPath)) {
      console.log('No drizzle journal found — nothing to do.');
      return;
    }

    const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
    const applied = new Set(
      (await sql`SELECT hash FROM "_drizzle_migrations"`).map(r => r.hash),
    );

    for (const entry of journal.entries) {
      const tag = entry.tag;
      if (applied.has(tag)) {
        console.log(`✓ ${tag} (already applied)`);
        continue;
      }
      const file = path.join(__dirname, 'drizzle', `${tag}.sql`);
      if (!fs.existsSync(file)) {
        console.warn(`⚠ ${tag} listed in journal but file missing — skipping`);
        continue;
      }
      const body = fs.readFileSync(file, 'utf8');

      // Drizzle separates statements with `--> statement-breakpoint` markers.
      // Some statements include their own semicolons; some don't. Splitting on
      // the breakpoint and running each fragment as one query is the safest.
      const statements = body
        .split('--> statement-breakpoint')
        .map(s => s.trim())
        .filter(Boolean);

      console.log(`→ Applying ${tag} (${statements.length} statements)…`);
      try {
        await sql.begin(async (tx) => {
          for (const stmt of statements) {
            await tx.unsafe(stmt);
          }
          await tx`INSERT INTO "_drizzle_migrations" (hash, created_at) VALUES (${tag}, ${entry.when})`;
        });
        console.log(`✓ ${tag} applied`);
      } catch (e) {
        console.error(`✗ ${tag} failed:`, e.message);
        throw e;
      }
    }

    console.log('All migrations applied.');
  } finally {
    await sql.end();
  }
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
