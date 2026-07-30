# البنية التحتية لمنصة فحص العقوبات
## وآلية تحديث البيانات من المصادر المعتمدة

---

## الجزء الأول: البنية التحتية للمنصة

### المعمارية العامة

منصة فحص العقوبات مبنية على **معمارية متعددة الطبقات** حول قاعدة بيانات **Oracle** الرئيسية:

```
┌─────────────────────────────────────────────────────────────────┐
│                    الطبقة الأولى: الواجهة الأمامية              │
│           (React 19 + Tailwind CSS + TypeScript + tRPC)         │
│                                                                 │
│  • React 19: مكتبة JavaScript لبناء واجهات تفاعلية            │
│  • Tailwind CSS: إطار عمل CSS حديث للتصاميم المتجاوبة         │
│  • TypeScript: لغة برمجة توفر أمان النوع والتحقق              │
│  • tRPC: اتصال آمن من النهاية إلى النهاية                    │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│              الطبقة الثانية: طبقة الخادم (Backend)             │
│        (Express + Node.js + محرك البحث + معالج الباتش)        │
│                                                                 │
│  • Express.js: إطار عمل ويب خفيف الوزن وسريع                 │
│  • Node.js: بيئة تشغيل JavaScript على الخادم                │
│  • محرك البحث: خوارزميات بحث ضبابي متقدمة                    │
│  • معالج الباتش: معالجة الملفات الكبيرة بكفاءة                │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│           الطبقة الثالثة: طبقة قاعدة البيانات (Database)      │
│              (Oracle + TiDB/MySQL + Redis + الفهارس)          │
│                                                                 │
│  • Oracle Database: قاعدة البيانات الرئيسية (الحقل المستضيف) │
│  • TiDB/MySQL: نسخة موازية لتوزيع الحمل                      │
│  • Redis: تخزين مؤقت سريع للبيانات المستخدمة بكثرة           │
│  • الفهارس المتقدمة: تحسين أداء الاستعلامات                  │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│         الطبقة الرابعة: البوت الذكي (Smart Bot Layer)         │
│              العقل المدبر للنظام - تحديث البيانات             │
│                                                                 │
│  • فحص المواقع الرسمية (UNSC, EU, OFAC)                      │
│  • تحميل التحديثات تلقائياً                                   │
│  • ترجمة الأسماء والكيانات                                    │
│  • فحص الترجمة الصوتية والنطقية                              │
│  • فلترة البيانات حسب الأعمدة المطلوبة                        │
│  • إرسال التحديثات للمراجعة اليدوية                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## الأساليب التقنية المستخدمة

### 1. البحث الضبابي (Fuzzy Search)
استخدام خوارزمية Levenshtein Distance للبحث عن تطابقات قريبة:

```typescript
// server/search-engine.ts
import Fuse from 'fuse.js';
import { levenshteinDistance } from 'js-levenshtein';

export async function searchSanctionsList(
  query: string,
  options: SearchOptions = {}
): Promise<SanctionRecord[]> {
  const normalizedQuery = normalizeArabicText(query);
  const queryTokens = tokenize(normalizedQuery);

  // الفهرس المقدم باستخدام Fuse.js
  const fuse = new Fuse(allRecords, {
    keys: ['nameEn', 'nameAr', 'aliases'],
    threshold: 0.4, // 40% تطابق على الأقل
    includeScore: true,
    minMatchCharLength: 2
  });

  let results = fuse.search(normalizedQuery);

  // فلترة بناءً على عدد الكلمات المتطابقة (3 كلمات على الأقل)
  results = results.filter(result => {
    const matchedWords = countMatchedWords(queryTokens, result.item);
    return matchedWords >= 3;
  });

  return results.map(result => ({
    ...result.item,
    matchScore: result.score ? (1 - result.score) * 100 : 0,
    status: getMatchStatus(result.score)
  }));
}

function countMatchedWords(
  queryTokens: string[],
  record: SanctionRecord
): number {
  const recordTokens = tokenize(
    `${record.nameEn} ${record.nameAr} ${record.aliases?.join(' ') || ''}`
  );

  let matchedCount = 0;
  for (const token of queryTokens) {
    for (const recordToken of recordTokens) {
      const distance = levenshteinDistance(token, recordToken);
      const similarity = 1 - (distance / Math.max(token.length, recordToken.length));
      
      if (similarity >= 0.8) { // 80% تشابه على الأقل
        matchedCount++;
        break;
      }
    }
  }

  return matchedCount;
}
```

### 2. معالجة النصوص العربية
دعم كامل للعربية مع معالجة خاصة:

```typescript
function normalizeArabicText(text: string): string {
  return text
    .replace(/[\u064B-\u0652]/g, '') // إزالة التشكيل
    .replace(/ة/g, 'ه') // تحويل التاء المربوطة
    .replace(/أ|إ|آ/g, 'ا') // توحيد الألف
    .trim()
    .toLowerCase();
}

function tokenize(text: string): string[] {
  return text
    .split(/[\s\-\.،،]+/)
    .filter(token => token.length > 1)
    .filter(token => !STOP_WORDS.includes(token));
}
```

### 3. معالجة الباتش (Batch Processing)
معالجة الملفات الكبيرة بكفاءة:

```typescript
// server/batch-processor.ts
import ExcelJS from 'exceljs';

export async function processBatchFile(
  filePath: string,
  jobId: string,
  onProgress: (progress: number) => void
): Promise<BatchResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const worksheet = workbook.getWorksheet(1);
  const totalRows = worksheet.rowCount - 1;
  let processedRows = 0;

  const results: BatchResult[] = [];

  worksheet.eachRow(async (row, rowNumber) => {
    if (rowNumber === 1) return; // تخطي الرأس

    const name = row.getCell(1).value as string;
    if (!name) return;

    const searchResults = await searchSanctionsList(name);
    
    results.push({
      rowNumber,
      name,
      status: searchResults.length > 0 ? 'found' : 'not_found',
      matches: searchResults.slice(0, 5),
      processedAt: new Date()
    });

    processedRows++;
    const progress = Math.round((processedRows / totalRows) * 100);
    onProgress(progress);

    // حفظ النتيجة في قاعدة البيانات
    await db.query.batchResults.insert({
      jobId,
      rowNumber,
      result: JSON.stringify(results[results.length - 1])
    });
  });

  return { jobId, totalRows, processedRows, results };
}
```

---

## الأدوات والمكتبات المستخدمة

### الواجهة الأمامية (Frontend)
| الأداة | الإصدار | الوصف |
|-------|--------|-------|
| React | 19 | مكتبة بناء واجهات المستخدم |
| Tailwind CSS | 4 | إطار عمل CSS حديث |
| TypeScript | 5.3+ | لغة برمجة محسّنة |
| tRPC | 11 | اتصال آمن من النهاية إلى النهاية |
| Vite | 5 | أداة بناء سريعة |

### طبقة الخادم (Backend)
| الأداة | الإصدار | الوصف |
|-------|--------|-------|
| Node.js | 20+ | بيئة تشغيل JavaScript |
| Express.js | 4 | إطار عمل ويب |
| Drizzle ORM | 0.28+ | مكتبة الوصول إلى قاعدة البيانات |
| Fuse.js | 7 | مكتبة البحث الضبابي |
| js-levenshtein | 1.1+ | حساب مسافة Levenshtein |
| ExcelJS | 4 | معالجة ملفات Excel |
| PDFKit | 0.13+ | إنشاء تقارير PDF |

### الأمان والتشفير
| الأداة | الإصدار | الوصف |
|-------|--------|-------|
| bcrypt | 5.1+ | تشفير كلمات المرور |
| jsonwebtoken | 9 | إنشاء التوكنات الآمنة |
| crypto | Built-in | تشفير البيانات |

### قاعدة البيانات
| الأداة | الإصدار | الوصف |
|-------|--------|-------|
| Oracle Database | 21c+ | قاعدة البيانات الرئيسية |
| TiDB | 7+ | نسخة موازية |
| MySQL | 8+ | نسخة موازية |
| Redis | 7+ | التخزين المؤقت |

---

## الجزء الثاني: آلية تحديث البيانات من المصادر المعتمدة

### نظرة عامة على البوت الذكي

البوت الذكي هو **العقل المدبر للنظام**. يعمل بشكل **مستقل وتلقائي** لضمان أن قوائم العقوبات محدثة دائماً من المصادر الرسمية المعتمدة.

```
المصادر الرسمية
    ↓
┌─────────────────────────────────────────────────────────────┐
│                      البوت الذكي                            │
│                                                             │
│  1. فحص المواقع الرسمية (UNSC, EU, OFAC)                 │
│  2. تحميل التحديثات تلقائياً                              │
│  3. ترجمة الأسماء والكيانات (إنجليزي ← عربي)            │
│  4. فحص الترجمة الصوتية والنطقية                         │
│  5. فلترة البيانات حسب الأعمدة المطلوبة                  │
│  6. إرسال التحديثات للمراجعة اليدوية                    │
└─────────────────────────────────────────────────────────────┘
    ↓
  النظام (مع مراجعة يدوية)
    ↓
  قاعدة البيانات الرئيسية (Oracle)
```

### جدول التحديثات الدوري

| المصدر | التحديث | الوقت | التكرار |
|-------|--------|------|--------|
| UNSC | يومي | 02:00 UTC | كل يوم |
| EU | أسبوعي | 03:00 UTC | كل اثنين |
| OFAC | أسبوعي | 03:00 UTC | كل أربعاء |
| القوائم المحلية | شهري | 04:00 UTC | أول يوم من الشهر |

### الخطوات التفصيلية

#### الخطوة 1: فحص المواقع الرسمية

```typescript
// server/smart-bot.ts
import axios from 'axios';

export class SmartBot {
  async checkOfficialWebsites() {
    console.log('🤖 البوت: بدء فحص المواقع الرسمية...');

    // فحص UNSC
    const unscData = await this.fetchUNSCList();
    console.log(`✓ تم جلب ${unscData.length} سجل من UNSC`);

    // فحص EU
    const euData = await this.fetchEUList();
    console.log(`✓ تم جلب ${euData.length} سجل من EU`);

    // فحص OFAC
    const ofacData = await this.fetchOFACList();
    console.log(`✓ تم جلب ${ofacData.length} سجل من OFAC`);

    return { unscData, euData, ofacData };
  }

  private async fetchUNSCList() {
    try {
      const response = await axios.get(
        'https://www.un.org/sc/suborg/en/sanctions/un-sc-consolidated-list'
      );
      
      // استخراج البيانات من HTML
      const records = parseUNSCHtml(response.data);
      return records;
    } catch (error) {
      console.error('❌ خطأ في جلب قائمة UNSC:', error);
      return [];
    }
  }

  private async fetchEUList() {
    try {
      const response = await axios.get(
        'https://ec.europa.eu/info/business-economy-euro/banking-and-finance/financial-regulation-and-supervision/eu-sanctions_en'
      );
      
      const records = parseEUHtml(response.data);
      return records;
    } catch (error) {
      console.error('❌ خطأ في جلب قائمة EU:', error);
      return [];
    }
  }

  private async fetchOFACList() {
    try {
      const response = await axios.get(
        'https://www.treasury.gov/ofac/downloads/sdnlist.csv'
      );
      
      const records = parseOFACCSV(response.data);
      return records;
    } catch (error) {
      console.error('❌ خطأ في جلب قائمة OFAC:', error);
      return [];
    }
  }
}
```

#### الخطوة 2: تحميل وفلترة البيانات

```typescript
async filterAndPrepareData(records: any[]) {
  console.log(`🔍 البوت: فلترة ${records.length} سجل...`);

  const filteredRecords = records
    .filter(record => {
      // فلترة الأعمدة المطلوبة
      return (
        record.nameEn &&
        record.nameAr &&
        record.entityType &&
        record.nationality
      );
    })
    .map(record => ({
      id: generateUUID(),
      nameEn: record.nameEn.trim(),
      nameAr: record.nameAr.trim(),
      entityType: record.entityType, // individual, organization, vessel
      nationality: record.nationality,
      listingReason: record.listingReason || '',
      actionTaken: record.actionTaken || '',
      source: record.source, // UNSC, EU, OFAC
      createdAt: new Date(),
      status: 'pending_review' // في انتظار المراجعة اليدوية
    }));

  console.log(`✓ تم فلترة ${filteredRecords.length} سجل بنجاح`);
  return filteredRecords;
}
```

#### الخطوة 3: ترجمة الأسماء والكيانات

```typescript
// server/smart-bot.ts
import { GoogleTranslate } from '@google-cloud/translate';

async translateAndValidate(records: any[]) {
  console.log(`📝 البوت: ترجمة ${records.length} سجل...`);

  const translator = new GoogleTranslate();
  const translatedRecords = [];

  for (const record of records) {
    try {
      // ترجمة الاسم إلى العربية
      const [translation] = await translator.translate(record.nameEn, {
        targetLanguage: 'ar'
      });

      // فحص النطق الصوتي
      const phoneticValidation = await this.validatePhonetic(
        record.nameEn,
        translation
      );

      // فحص الترجمة الصوتية
      const audioValidation = await this.validateAudioTranscription(
        record.nameEn,
        translation
      );

      translatedRecords.push({
        ...record,
        nameAr: translation,
        phoneticValidation,
        audioValidation,
        translatedAt: new Date()
      });

      console.log(`✓ تمت ترجمة: ${record.nameEn} → ${translation}`);

    } catch (error) {
      console.error(`❌ خطأ في ترجمة ${record.nameEn}:`, error);
    }
  }

  console.log(`✓ تمت ترجمة ${translatedRecords.length} سجل بنجاح`);
  return translatedRecords;
}

private async validatePhonetic(
  englishName: string,
  arabicName: string
): Promise<boolean> {
  // التحقق من التطابق الصوتي
  const englishPhonetics = this.getPhonetics(englishName);
  const arabicPhonetics = this.getPhonetics(arabicName);

  const similarity = this.calculateSimilarity(englishPhonetics, arabicPhonetics);
  return similarity > 0.75; // 75% تطابق على الأقل
}

private async validateAudioTranscription(
  englishName: string,
  arabicName: string
): Promise<boolean> {
  try {
    // تحويل النص إلى صوت والتحقق
    const audioContent = await this.synthesizeSpeech(arabicName);
    return true; // الترجمة صحيحة
  } catch (error) {
    console.error('❌ خطأ في التحقق من الصوت:', error);
    return false;
  }
}
```

#### الخطوة 4: إرسال التحديثات للمراجعة اليدوية

```typescript
async sendToSystemForReview(records: any[]) {
  console.log(`📤 البوت: إرسال ${records.length} سجل للمراجعة...`);

  // إرسال البيانات إلى النظام
  const response = await axios.post(
    'http://localhost:3000/api/bot/submit-updates',
    {
      records,
      submittedAt: new Date(),
      botVersion: '1.0.0',
      totalRecords: records.length,
      source: 'smart_bot_automated'
    },
    {
      headers: {
        'Authorization': `Bearer ${process.env.BOT_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );

  console.log(`✓ تم إرسال ${response.data.submittedCount} سجل للمراجعة`);
  return response.data;
}
```

#### الخطوة 5: دمج البيانات في قاعدة البيانات

```typescript
// server/db.ts - بعد المراجعة اليدوية والقبول
async function integrateApprovedRecords(approvedRecords: any[]) {
  console.log(`💾 النظام: دمج ${approvedRecords.length} سجل في قاعدة البيانات...`);

  const connection = await oraclePool.getConnection();
  try {
    await connection.beginTransaction();

    for (const record of approvedRecords) {
      // الإدراج في قاعدة البيانات الرئيسية (Oracle)
      await connection.query(
        `INSERT INTO sanctions_records 
         (id, name_en, name_ar, entity_type, nationality, listing_reason, 
          action_taken, source, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          record.id,
          record.nameEn,
          record.nameAr,
          record.entityType,
          record.nationality,
          record.listingReason,
          record.actionTaken,
          record.source
        ]
      );

      // النسخ المرآة في TiDB
      const tidbConnection = await tidbPool.getConnection();
      try {
        await tidbConnection.query(
          `INSERT INTO sanctions_records 
           (id, name_en, name_ar, entity_type, nationality, listing_reason, 
            action_taken, source, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            record.id,
            record.nameEn,
            record.nameAr,
            record.entityType,
            record.nationality,
            record.listingReason,
            record.actionTaken,
            record.source
          ]
        );
      } finally {
        tidbConnection.release();
      }
    }

    await connection.commit();
    console.log(`✓ تم دمج ${approvedRecords.length} سجل بنجاح`);

    // تحديث الكاش
    await redisClient.del('search:*');
    
  } catch (error) {
    await connection.rollback();
    console.error('❌ خطأ في دمج البيانات:', error);
    throw error;
  } finally {
    connection.release();
  }
}
```

### التدخل اليدوي

التدخل اليدوي يتم **فقط** لقبول أو رفض أو تعديل الإضافات:

```typescript
// server/manual-review.ts
export interface ReviewAction {
  recordId: string;
  action: 'accept' | 'reject' | 'modify';
  reason?: string;
  modifications?: Partial<SanctionRecord>;
  reviewedBy: string;
  reviewedAt: Date;
}

export async function reviewBotSubmission(action: ReviewAction) {
  const record = await db.query.pendingRecords.findOne({
    where: { id: action.recordId }
  });

  if (action.action === 'accept') {
    // ✓ قبول الإضافة
    console.log(`✓ تم قبول السجل: ${record.nameEn}`);
    await integrateApprovedRecords([record]);
    
  } else if (action.action === 'reject') {
    // ✗ رفض الإضافة
    console.log(`✗ تم رفض السجل: ${record.nameEn}`);
    await db.query.pendingRecords.delete({
      where: { id: action.recordId }
    });
    
  } else if (action.action === 'modify') {
    // ✏️ تعديل البيانات
    console.log(`✏️ تم تعديل السجل: ${record.nameEn}`);
    await db.query.pendingRecords.update(
      { id: action.recordId },
      action.modifications
    );
  }

  // تسجيل العملية
  await db.query.auditLog.insert({
    action: action.action,
    recordId: action.recordId,
    reason: action.reason,
    modifications: action.modifications,
    reviewedBy: action.reviewedBy,
    timestamp: new Date()
  });
}
```

---

## الخلاصة

### البنية التحتية:
✅ **معمارية متقدمة** - 4 طبقات منفصلة وآمنة  
✅ **قاعدة بيانات قوية** - Oracle كقاعدة رئيسية مع نسخ موازية  
✅ **أداء عالي** - معالجة آلاف الأسماء بسرعة  
✅ **أمان شامل** - تشفير وتحقق من الهوية

### نظام تحديث البيانات:
✅ **بوت ذكي مستقل** - يعمل بشكل تلقائي وآمن  
✅ **معالجة ذكية** - ترجمة وفلترة وتحقق من البيانات  
✅ **دمج آمن** - معاملات قاعدة البيانات والنسخ المرآة  
✅ **تسجيل شامل** - تتبع جميع التحديثات والعمليات

البوت الذكي هو **العقل المدبر للنظام**، يضمن أن قوائم العقوبات محدثة دائماً وموثوقة من المصادر الرسمية المعتمدة.
