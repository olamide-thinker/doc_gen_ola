const postgres = require('postgres');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const sql = postgres(process.env.DATABASE_URL);

/**
 * Replicates the frontend calculation logic to find the grand total.
 */
function calculateGrandTotal(content) {
  if (!content || !content.table) return 0;
  
  try {
    const rows = content.table.rows || [];
    const columns = content.table.columns || [];
    const summaries = content.table.summary || [];

    // Find the last numeric/formula column (the "Total" column)
    const totalCol = [...columns].reverse().find(
      (c) => (c.type === 'formula' || c.type === 'number') && !c.hidden
    );

    if (!totalCol) return 0;

    // 1. Calculate Subtotal
    let subTotal = 0;
    for (const row of rows) {
      if (row.rowType && row.rowType !== 'row') continue;
      
      let rowVal = 0;
      if (totalCol.type === 'formula' && totalCol.formula) {
         // Dynamic formula resolver for basic multiplication/addition
         let expr = totalCol.formula;
         // Find all uppercase IDs in formula (e.g. D, E)
         const matches = expr.match(/[A-Z]+/g) || [];
         matches.forEach(cid => {
           expr = expr.replace(new RegExp(`\\b${cid}\\b`, 'g'), String(Number(row[cid]) || 0));
         });
         try {
           if (/^[0-9.()+\-*/\s]+$/.test(expr)) {
             rowVal = eval(expr);
           }
         } catch(e) {}
      } else {
         rowVal = Number(row[totalCol.id]) || 0;
      }
      subTotal += rowVal;
    }

    // 2. Apply Summary Items (evaluating basic math)
    let currentRunningTotal = subTotal;
    const prevSummaryValues = {};

    for (let i = 0; i < summaries.length; i++) {
      const item = summaries[i];
      const displayId = String.fromCharCode(65 + i);
      
      let val = 0;
      if (item.type === 'formula' && item.formula) {
        let expression = item.formula
          .replace(/subTotal/g, String(subTotal))
          .replace(/prev/g, String(currentRunningTotal))
          .replace(/(\d*\.?\d+)\s*%/g, '($1/100)');
        
        Object.keys(prevSummaryValues).forEach(key => {
          expression = expression.replace(new RegExp(`\\b${key}\\b`, 'g'), String(prevSummaryValues[key]));
        });

        try {
          if (/^[0-9.()+\-*/\s]+$/.test(expression)) {
            val = eval(expression);
          }
        } catch (e) {}
      } else {
        val = Number(item.value) || 0;
      }

      prevSummaryValues[displayId] = val;
      currentRunningTotal += val;
    }

    return currentRunningTotal;
  } catch (e) {
    console.error('  [!] Error calculating:', e.message);
    return 0;
  }
}

/**
 * Normalizes content that might be double-stringified or Buffer-encoded by the driver.
 */
function normalizeContent(raw) {
  if (!raw) return null;
  let data = raw;
  
  console.log(`  [Debug] Initial type: ${typeof raw}. IsBuffer: ${Buffer.isBuffer(raw)}`);

  // 1. If it's a Buffer, convert to string
  if (Buffer.isBuffer(raw)) {
    data = raw.toString('utf8');
  }

  // 2. If it's a string, it might be JSON
  if (typeof data === 'string') {
    try { 
      data = JSON.parse(data); 
      console.log(`  [Debug] Parsed string into: ${typeof data}`);
      if (typeof data === 'string') {
        data = JSON.parse(data);
        console.log(`  [Debug] Parsed second-level string into: ${typeof data}`);
      }
    } catch(e) { 
      console.log(`  [Debug] String parse failed for: ${data.substring(0, 40)}...`);
    }
  }
  
  // 3. If it's the weird indexed char object
  if (typeof data === 'object' && data && data['0'] !== undefined) {
    try {
      // ONLY use numeric keys for reconstruction to avoid corrupting with metadata like 'grandTotal'
      const keys = Object.keys(data)
        .filter(k => !isNaN(parseInt(k)))
        .sort((a, b) => parseInt(a) - parseInt(b));
      
      const str = keys.map(k => data[k]).join('');
      data = JSON.parse(str); 
      if (typeof data === 'string') data = JSON.parse(data);
    } catch(e) {
      console.log('  [Debug] Index object parse failed');
    }
  }
  
  if (typeof data !== 'object' || data === null || !data.table) {
    console.log(`  [Debug] Failed: type=${typeof data}, hasTable=${!!(data && data.table)}`);
    return null;
  }
  
  return data;
}

async function run() {
  console.log('🚀 Starting Invoice Totals Recovery (v3)...');
  try {
    const invoices = await sql`SELECT id, name, draft, active_version_id FROM invoices`;
    console.log(`🔍 Found ${invoices.length} invoices to check.`);

    for (const inv of invoices) {
      process.stdout.write(`  Processing ${inv.id} (${inv.name || 'Untitled'})... `);
      
      const draft = normalizeContent(inv.draft);
      if (!draft) {
        console.log('SKIP (failed to parse draft)');
        continue;
      }

      let activeVerContent = null;
      if (inv.active_version_id) {
        const [version] = await sql`SELECT content FROM invoice_versions WHERE id = ${inv.active_version_id}`;
        if (version) {
          activeVerContent = normalizeContent(version.content);
        }
      }

      const contentToCompute = activeVerContent || draft;
      const total = calculateGrandTotal(contentToCompute);
      
      // Update the draft in main table
      const updatedDraft = { ...draft, grandTotal: total };
      await sql`UPDATE invoices SET draft = ${JSON.stringify(updatedDraft)} WHERE id = ${inv.id}`;

      // Update active version
      if (inv.active_version_id && activeVerContent) {
         const updatedVerContent = { ...activeVerContent, grandTotal: total };
         await sql`UPDATE invoice_versions SET content = ${JSON.stringify(updatedVerContent)} WHERE id = ${inv.active_version_id}`;
      }

      console.log(`DONE (Total: ${total.toLocaleString()})`);
    }

    console.log('\n✅ Recovery successful! All invoices updated.');
  } catch (err) {
    console.error('\n❌ Recovery failed:', err);
  } finally {
    await sql.end();
  }
}

run();
