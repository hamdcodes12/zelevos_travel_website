const fs = require("fs");
const path = require("path");

const migrationsDir = path.resolve("supabase/migrations");
const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith(".sql"));

const references = [];

for (const file of files) {
  const content = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
  // Find table and column references
  const lines = content.split("\n");
  let currentTable = "";
  for (const line of lines) {
    const tableMatch = line.match(/create\s+table\s+(?:if\s+not\s+exists\s+)?([a-zA-Z0-9_\.]+)/i);
    if (tableMatch) {
      currentTable = tableMatch[1].replace("public.", "");
    }
    const refMatch = line.match(/([a-zA-Z0-9_]+)\s+.*?references\s+([a-zA-Z0-9_\.]+)\s*(?:\(([^)]+)\))?(?:\s+on\s+delete\s+([a-zA-Z\s]+))?/i);
    if (refMatch && currentTable) {
      references.push({
        table: currentTable,
        column: refMatch[1],
        targetTable: refMatch[2].replace("public.", ""),
        targetCol: refMatch[3] || "id",
        onDelete: (refMatch[4] || "RESTRICT").trim(),
        file
      });
    }
  }
}

const relevant = references.filter(r => 
  r.targetTable.includes("profiles") || 
  r.targetTable.includes("users") || 
  r.targetTable.includes("bpo_partners") || 
  r.targetTable.includes("bpo_partner_applications") ||
  r.targetTable.includes("bpo_centre_verification") ||
  r.targetTable.includes("bpo_centres")
);

console.log(`Found ${relevant.length} references:`);
for (const r of relevant) {
  console.log(`${r.table}.${r.column} -> ${r.targetTable}(${r.targetCol}) [ON DELETE ${r.onDelete}]`);
}
