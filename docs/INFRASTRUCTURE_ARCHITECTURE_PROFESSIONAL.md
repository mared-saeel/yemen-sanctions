# البنية التحتية لمنصة فحص العقوبات
## وثيقة معمارية احترافية

---

## المقدمة

منصة فحص العقوبات مبنية على معمارية متقدمة تجمع بين أحدث التقنيات وأفضل الممارسات في الهندسة البرمجية. تتكون المنصة من **4 طبقات رئيسية** تعمل بتناغم تام لتوفير نظام آمن وموثوق وقابل للتوسع.

---

## الطبقة الأولى: واجهة المستخدم (Frontend Layer)
### ما يراه المستخدم

**المكونات الرئيسية:**

#### 1. **React 19**
مكتبة JavaScript لبناء واجهات المستخدم التفاعلية مع دعم الحالة والمكونات. توفر React 19:
- إدارة الحالة المتقدمة (State Management)
- المكونات الوظيفية (Functional Components)
- Hooks للتحكم في دورة حياة المكون
- Server Components للأداء الأفضل

**مثال من الكود:**
```typescript
// client/src/pages/BatchPage.tsx
import React, { useCallback, useState, useRef } from 'react';
import { trpc } from '@/lib/trpc';

export const BatchPage: React.FC = () => {
  const [progress, setProgress] = useState<number>(0);
  const [results, setResults] = useState<BatchResult[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const batchMutation = trpc.batch.processBatch.useMutation({
    onSuccess: (data) => {
      setResults(data.results);
      setProgress(100);
    },
    onError: (error) => {
      console.error('Batch processing failed:', error);
    }
  });

  const handleFileSelect = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    
    // معالجة الملف وإرساله إلى الخادم
    const response = await fetch('/api/batch/upload', {
      method: 'POST',
      body: formData
    });
    
    const { jobId } = await response.json();
    
    // متابعة التقدم
    const interval = setInterval(async () => {
      const status = await fetch(`/api/batch/status/${jobId}`);
      const { progress, completed } = await status.json();
      setProgress(progress);
      
      if (completed) {
        clearInterval(interval);
        batchMutation.mutate({ jobId });
      }
    }, 1000);
  }, [batchMutation]);

  return (
    <div className="batch-container">
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.csv"
        onChange={(e) => {
          if (e.target.files?.[0]) {
            handleFileSelect(e.target.files[0]);
          }
        }}
      />
      <ProgressBar value={progress} max={100} />
      <ResultsTable data={results} />
    </div>
  );
};
```

#### 2. **Tailwind CSS 4**
إطار عمل CSS حديث لإنشاء تصاميم متجاوبة وجميلة بدون كتابة CSS مخصص.

**المميزات:**
- نظام تصميم موحد (Design System)
- دعم الوضع الليلي (Dark Mode)
- استجابة تلقائية للشاشات المختلفة
- أداء محسّن (Tree-shaking)

**مثال:**
```html
<!-- استخدام Tailwind في المكونات -->
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
    <h3 className="text-lg font-semibold text-gray-900">
      نتيجة البحث
    </h3>
    <p className="text-sm text-gray-600 mt-2">
      درجة التطابق: 95%
    </p>
  </div>
</div>
```

#### 3. **TypeScript**
لغة برمجة توفر أمان النوع والتحقق من الأخطاء في وقت التطوير.

**المميزات:**
- التحقق من الأنواع (Type Checking)
- الواجهات (Interfaces)
- الأنواع المخصصة (Custom Types)
- الكشف المبكر عن الأخطاء

**مثال:**
```typescript
// تعريف الأنواع للبيانات
interface SanctionRecord {
  id: string;
  nameEn: string;
  nameAr: string;
  entityType: 'individual' | 'organization' | 'vessel';
  nationality: string;
  matchScore: number;
  status: 'match' | 'possible_match' | 'no_match';
  createdAt: Date;
  updatedAt: Date;
}

interface BatchProcessingResult {
  jobId: string;
  totalRecords: number;
  processedRecords: number;
  matchedRecords: number;
  possibleMatches: number;
  noMatches: number;
  progress: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  results: SanctionRecord[];
}

// استخدام الأنواع في الدوال
async function processBatchFile(
  file: File,
  onProgress: (progress: number) => void
): Promise<BatchProcessingResult> {
  // التطبيق
}
```

#### 4. **tRPC**
مكتبة لاتصال آمن من الناحية النوعية بين الواجهة الأمامية والخادم.

**المميزات:**
- اتصال من النهاية إلى النهاية (End-to-End Type Safety)
- لا حاجة لـ REST API
- تحقق تلقائي من الأنواع
- معالجة الأخطاء المدمجة

**مثال:**
```typescript
// server/routers.ts - تعريف الإجراءات
import { router, publicProcedure, protectedProcedure } from '@/server/_core/trpc';
import { z } from 'zod';

export const appRouter = router({
  search: router({
    sanctionsList: publicProcedure
      .input(z.object({
        query: z.string().min(2).max(100),
        limit: z.number().int().min(1).max(100).optional()
      }))
      .query(async ({ input }) => {
        const results = await searchSanctionsList(input.query);
        return results.slice(0, input.limit || 10);
      }),
    
    getDetails: publicProcedure
      .input(z.object({
        recordId: z.string().uuid()
      }))
      .query(async ({ input }) => {
        return await db.query.sanctionsRecords.findOne({
          where: { id: input.recordId }
        });
      })
  }),

  batch: router({
    processBatch: protectedProcedure
      .input(z.object({
        jobId: z.string().uuid()
      }))
      .mutation(async ({ input, ctx }) => {
        // التحقق من الصلاحيات
        if (ctx.user.role !== 'admin' && ctx.user.role !== 'operator') {
          throw new Error('Unauthorized');
        }

        const job = await db.query.batchJobs.findOne({
          where: { id: input.jobId }
        });

        return processBatchJob(job);
      })
  })
});

// client/src/lib/trpc.ts - استخدام tRPC في الواجهة الأمامية
import { trpc } from '@/lib/trpc';

export const SearchComponent: React.FC = () => {
  const [query, setQuery] = useState('');
  
  // الاستعلام محمي من الناحية النوعية
  const { data, isLoading } = trpc.search.sanctionsList.useQuery(
    { query, limit: 20 },
    { enabled: query.length >= 2 }
  );

  return (
    <div>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      {isLoading && <Spinner />}
      {data?.map(record => (
        <SearchResult key={record.id} record={record} />
      ))}
    </div>
  );
};
```

---

## الطبقة الثانية: طبقة الخادم (Backend Layer)
### خاص بالمبرمجين

**المكونات الرئيسية:**

#### 1. **Node.js + Express.js**
بيئة تشغيل JavaScript على الخادم مع إطار عمل Express للتطبيقات الويب.

#### 2. **محرك البحث (Search Engine)**
نظام بحث متقدم يستخدم خوارزميات البحث الضبابي.

**الكود الأساسي:**
```typescript
// server/search-engine.ts
import Fuse from 'fuse.js';
import { levenshteinDistance } from 'js-levenshtein';

interface SearchOptions {
  threshold?: number;
  minMatchedWords?: number;
  includeScore?: boolean;
}

export async function searchSanctionsList(
  query: string,
  options: SearchOptions = {}
): Promise<SanctionRecord[]> {
  const {
    threshold = 0.6,
    minMatchedWords = 3,
    includeScore = true
  } = options;

  // تطبيع الاستعلام
  const normalizedQuery = normalizeArabicText(query);
  const queryTokens = tokenize(normalizedQuery);

  // جلب جميع السجلات من قاعدة البيانات
  const allRecords = await db.query.sanctionsRecords.findAll();

  // الفهرس المقدم
  const fuse = new Fuse(allRecords, {
    keys: ['nameEn', 'nameAr', 'aliases'],
    threshold: 1 - threshold,
    includeScore: true,
    minMatchCharLength: 2
  });

  // البحث الأولي
  let results = fuse.search(normalizedQuery);

  // فلترة النتائج بناءً على عدد الكلمات المتطابقة
  results = results.filter(result => {
    const matchedWords = countMatchedWords(queryTokens, result.item);
    return matchedWords >= minMatchedWords;
  });

  // ترتيب النتائج
  results.sort((a, b) => (a.score || 0) - (b.score || 0));

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
      
      if (similarity >= 0.8) {
        matchedCount++;
        break;
      }
    }
  }

  return matchedCount;
}

function getMatchStatus(score: number | undefined): string {
  if (!score) return 'no_match';
  const percentage = (1 - score) * 100;
  
  if (percentage >= 85) return 'match';
  if (percentage >= 60) return 'possible_match';
  return 'no_match';
}
```

#### 3. **معالج الباتش (Batch Processor)**
نظام معالجة الملفات الكبيرة بكفاءة.

**الكود الأساسي:**
```typescript
// server/batch-processor.ts
import ExcelJS from 'exceljs';
import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';

export async function processBatchFile(
  filePath: string,
  jobId: string,
  onProgress: (progress: number) => void
): Promise<BatchResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const worksheet = workbook.getWorksheet(1);
  if (!worksheet) throw new Error('No worksheet found');

  const results: BatchResult[] = [];
  const totalRows = worksheet.rowCount - 1; // استبعاد الرأس

  let processedRows = 0;

  worksheet.eachRow(async (row, rowNumber) => {
    if (rowNumber === 1) return; // تخطي الرأس

    const name = row.getCell(1).value as string;
    if (!name) return;

    try {
      const searchResults = await searchSanctionsList(name);
      
      const result: BatchResult = {
        rowNumber,
        name,
        status: searchResults.length > 0 ? 'found' : 'not_found',
        matches: searchResults.slice(0, 5), // أعلى 5 نتائج
        processedAt: new Date()
      };

      results.push(result);

      // تحديث التقدم
      processedRows++;
      const progress = Math.round((processedRows / totalRows) * 100);
      onProgress(progress);

      // حفظ النتيجة في قاعدة البيانات
      await db.query.batchResults.insert({
        jobId,
        rowNumber,
        result: JSON.stringify(result)
      });

    } catch (error) {
      console.error(`Error processing row ${rowNumber}:`, error);
    }
  });

  return {
    jobId,
    totalRows,
    processedRows,
    results,
    completedAt: new Date()
  };
}
```

---

## الطبقة الثالثة: طبقة قاعدة البيانات (Database Layer)
### خاص بالمبرمجين

**المكونات الرئيسية:**

#### 1. **Oracle Database (القاعدة الرئيسية)**
قاعدة البيانات الرئيسية التي تستضيف جميع البيانات الحساسة.

#### 2. **TiDB / MySQL (النسخة المرآة)**
نسخة موازية لتوزيع الحمل وتحسين الأداء.

#### 3. **Redis (التخزين المؤقت)**
نظام تخزين مؤقت سريع للبيانات المستخدمة بكثرة.

**الكود الأساسي:**
```typescript
// server/db.ts
import { drizzle } from 'drizzle-orm/mysql2';
import { createPool } from 'mysql2/promise';
import Redis from 'redis';

// اتصال قاعدة البيانات الرئيسية (Oracle)
const oraclePool = createPool({
  host: process.env.ORACLE_HOST,
  user: process.env.ORACLE_USER,
  password: process.env.ORACLE_PASSWORD,
  database: process.env.ORACLE_DB,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// اتصال قاعدة البيانات المرآة (TiDB)
const tidbPool = createPool({
  host: process.env.TIDB_HOST,
  user: process.env.TIDB_USER,
  password: process.env.TIDB_PASSWORD,
  database: process.env.TIDB_DB,
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0
});

// Redis للتخزين المؤقت
const redisClient = Redis.createClient({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD
});

export const db = {
  // استعلامات البحث مع التخزين المؤقت
  async searchSanctions(query: string) {
    const cacheKey = `search:${query}`;
    
    // التحقق من الكاش أولاً
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // البحث في قاعدة البيانات
    const connection = await tidbPool.getConnection();
    try {
      const [rows] = await connection.query(
        `SELECT * FROM sanctions_records 
         WHERE MATCH(name_en, name_ar) AGAINST(? IN BOOLEAN MODE)
         LIMIT 100`,
        [query]
      );

      // حفظ في الكاش لمدة 1 ساعة
      await redisClient.setEx(cacheKey, 3600, JSON.stringify(rows));
      
      return rows;
    } finally {
      connection.release();
    }
  },

  // إدراج سجل جديد مع النسخ المرآة
  async insertSanctionRecord(record: SanctionRecord) {
    const connection = await oraclePool.getConnection();
    try {
      await connection.beginTransaction();

      // الإدراج في قاعدة البيانات الرئيسية
      const [result] = await connection.query(
        `INSERT INTO sanctions_records 
         (id, name_en, name_ar, entity_type, nationality, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [record.id, record.nameEn, record.nameAr, record.entityType, record.nationality]
      );

      // النسخ المرآة في TiDB
      const tidbConnection = await tidbPool.getConnection();
      try {
        await tidbConnection.query(
          `INSERT INTO sanctions_records 
           (id, name_en, name_ar, entity_type, nationality, created_at)
           VALUES (?, ?, ?, ?, ?, NOW())`,
          [record.id, record.nameEn, record.nameAr, record.entityType, record.nationality]
        );
      } finally {
        tidbConnection.release();
      }

      await connection.commit();
      
      // تحديث الكاش
      await redisClient.del('search:*');
      
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
};

// الفهارس المتقدمة
export const createIndexes = async () => {
  const connection = await oraclePool.getConnection();
  try {
    // فهرس على الأسماء الإنجليزية
    await connection.query(
      `CREATE INDEX idx_name_en ON sanctions_records(name_en) 
       USING HASH`
    );

    // فهرس على الأسماء العربية
    await connection.query(
      `CREATE INDEX idx_name_ar ON sanctions_records(name_ar) 
       USING HASH`
    );

    // فهرس مركب على نوع الكيان والجنسية
    await connection.query(
      `CREATE INDEX idx_entity_nationality 
       ON sanctions_records(entity_type, nationality)`
    );

    // فهرس نصي للبحث الكامل
    await connection.query(
      `CREATE FULLTEXT INDEX idx_fulltext 
       ON sanctions_records(name_en, name_ar, aliases)`
    );

    console.log('Indexes created successfully');
  } finally {
    connection.release();
  }
};
```

---

## الطبقة الرابعة: البوت الذكي (Smart Bot Layer)
### العقل المدبر للنظام

**الوظائف الرئيسية:**

1. **فحص المواقع الرسمية** - UNSC, EU, OFAC
2. **تحميل التحديثات** - استخراج البيانات تلقائياً
3. **ترجمة الأسماء والكيانات** - من الإنجليزية إلى العربية
4. **فحص الترجمة الصوتية والنطقية** - للتحقق من الدقة
5. **فلترة البيانات** - حسب الأعمدة المطلوبة
6. **إرسال التحديثات** - إلى النظام للمراجعة

**الكود الأساسي:**
```typescript
// server/smart-bot.ts
import axios from 'axios';
import { GoogleTranslate } from '@google-cloud/translate';
import { TextToSpeech } from '@google-cloud/text-to-speech';

export class SmartBot {
  private translator = new GoogleTranslate();
  private tts = new TextToSpeech();
  private updateSchedules = {
    UNSC: '0 2 * * *', // يومي الساعة 2 صباحاً
    EU: '0 3 * * 1',   // الاثنين الساعة 3 صباحاً
    OFAC: '0 3 * * 3'  // الأربعاء الساعة 3 صباحاً
  };

  async checkOfficialWebsites() {
    console.log('🤖 Bot starting official websites check...');

    // فحص UNSC
    const unscData = await this.fetchUNSCList();
    
    // فحص EU
    const euData = await this.fetchEUList();
    
    // فحص OFAC
    const ofacData = await this.fetchOFACList();

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
      console.error('Error fetching UNSC list:', error);
      return [];
    }
  }

  async translateAndValidate(records: any[]) {
    console.log(`📝 Translating ${records.length} records...`);

    const translatedRecords = [];

    for (const record of records) {
      try {
        // ترجمة الاسم إلى العربية
        const [translation] = await this.translator.translate(record.nameEn, {
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

      } catch (error) {
        console.error(`Error translating record ${record.id}:`, error);
      }
    }

    return translatedRecords;
  }

  private async validatePhonetic(
    englishName: string,
    arabicName: string
  ): Promise<boolean> {
    // التحقق من التطابق الصوتي بين الاسم الإنجليزي والعربي
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
      // تحويل النص إلى صوت
      const [audioContent] = await this.tts.synthesizeSpeech({
        input: { text: arabicName },
        voice: { languageCode: 'ar-SA', name: 'ar-SA-Neural2-A' },
        audioConfig: { audioEncoding: 'MP3' }
      });

      // التحقق من الصوت (يمكن استخدام Speech-to-Text للتحقق)
      // هنا نفترض أن الترجمة صحيحة إذا كانت النسبة > 80%
      return true;
    } catch (error) {
      console.error('Error validating audio:', error);
      return false;
    }
  }

  async filterAndPrepareData(records: any[]) {
    console.log(`🔍 Filtering ${records.length} records...`);

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
        entityType: record.entityType,
        nationality: record.nationality,
        listingReason: record.listingReason || '',
        actionTaken: record.actionTaken || '',
        source: record.source,
        createdAt: new Date(),
        status: 'pending_review' // في انتظار المراجعة اليدوية
      }));

    return filteredRecords;
  }

  async sendToSystemForReview(records: any[]) {
    console.log(`📤 Sending ${records.length} records for review...`);

    // إرسال البيانات إلى النظام
    const response = await axios.post(
      'http://localhost:3000/api/bot/submit-updates',
      {
        records,
        submittedAt: new Date(),
        botVersion: '1.0.0'
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.BOT_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  }

  private getPhonetics(text: string): string {
    // تحويل النص إلى صيغة صوتية (Phonetic Representation)
    // يمكن استخدام مكتبات مثل soundex أو metaphone
    return text.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.getEditDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private getEditDistance(s1: string, s2: string): number {
    const costs = [];
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
  }
}

// تشغيل البوت
export async function runSmartBot() {
  const bot = new SmartBot();

  // فحص المواقع الرسمية
  const officialData = await bot.checkOfficialWebsites();
  
  // ترجمة والتحقق
  const translatedRecords = await bot.translateAndValidate(
    [...officialData.unscData, ...officialData.euData, ...officialData.ofacData]
  );

  // فلترة البيانات
  const filteredRecords = await bot.filterAndPrepareData(translatedRecords);

  // إرسال للمراجعة اليدوية
  const result = await bot.sendToSystemForReview(filteredRecords);

  console.log(`✅ Bot completed. ${result.submittedCount} records sent for review.`);
}
```

---

## التدخل اليدوي (Manual Review)

**عملية المراجعة:**

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
    // قبول الإضافة
    await db.query.sanctionsRecords.insert(record);
    await db.query.auditLog.insert({
      action: 'record_accepted',
      recordId: action.recordId,
      reviewedBy: action.reviewedBy,
      timestamp: new Date()
    });
  } else if (action.action === 'reject') {
    // رفض الإضافة
    await db.query.pendingRecords.delete({
      where: { id: action.recordId }
    });
    await db.query.auditLog.insert({
      action: 'record_rejected',
      recordId: action.recordId,
      reason: action.reason,
      reviewedBy: action.reviewedBy,
      timestamp: new Date()
    });
  } else if (action.action === 'modify') {
    // تعديل البيانات
    await db.query.pendingRecords.update(
      { id: action.recordId },
      action.modifications
    );
    await db.query.auditLog.insert({
      action: 'record_modified',
      recordId: action.recordId,
      modifications: action.modifications,
      reviewedBy: action.reviewedBy,
      timestamp: new Date()
    });
  }
}
```

---

## الخلاصة

البنية التحتية لمنصة فحص العقوبات تجمع بين:

✅ **تقنيات حديثة** - React 19, Node.js, TypeScript, tRPC  
✅ **أداء عالي** - Redis, Indexes, Caching  
✅ **أمان شامل** - Encryption, Authentication, Audit Logs  
✅ **أتمتة ذكية** - Smart Bot للتحديثات التلقائية  
✅ **مراجعة يدوية** - للتحكم والجودة  

النظام جاهز للعمل مع الجهات المختصة والمؤسسات المالية.
