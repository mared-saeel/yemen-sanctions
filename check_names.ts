import { db } from './server/db.ts';
import { sanctionsRecords } from './drizzle/schema.ts';

// فحص أول 10 سجلات
const records = await db.select().from(sanctionsRecords).limit(10);

console.log('\nفحص بيانات السجلات:');
console.log('='.repeat(80));

for (const record of records) {
  console.log(`\nID: ${record.id}`);
  console.log(`nameEn: ${record.nameEn?.substring(0, 50) || 'NULL'}`);
  console.log(`nameAr: ${record.nameAr?.substring(0, 50) || 'NULL'}`);
  console.log(`alternativeNames: ${record.alternativeNames ? JSON.stringify(record.alternativeNames).substring(0, 50) : 'NULL'}`);
}
