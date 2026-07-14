import { db } from './server/db.ts';
import { sanctionsRecords } from './drizzle/schema.ts';

// Get a test record
const record = await db.query.sanctionsRecords.findFirst({
  where: (table) => table.nameEn.like('%MOHAMMAD SADIQ%'),
});

console.log("Record found:", record?.nameEn);
console.log("Record ID:", record?.id);

// Now test search
import { searchSanctions } from './server/search-engine.ts';

const result = await searchSanctions({ query: "محمود مقبل حزام محمد", limit: 1 });
console.log("\nSearch result:");
console.log("Query: محمود مقبل حزام محمد");
console.log("Results:", result.results.length);
if (result.results.length > 0) {
  console.log("Top result:", result.results[0].nameEn);
  console.log("Match score (raw):", result.results[0].matchScore);
}
