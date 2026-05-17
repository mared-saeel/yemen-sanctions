# Smart Sanctions Search Platform - Complete Project Specification

**Project Name:** Smart Search App (منصة فحص العقوبات الدولية)  
**Version:** 1.0.0  
**Last Updated:** May 17, 2026  
**Status:** Production Ready ✅

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Database Schema](#database-schema)
4. [Core Features](#core-features)
5. [Search Engine Details](#search-engine-details)
6. [API Endpoints](#api-endpoints)
7. [Frontend Pages](#frontend-pages)
8. [Installation & Setup](#installation--setup)
9. [Key Customizations](#key-customizations)
10. [Performance Optimizations](#performance-optimizations)

---

## 🎯 Project Overview

A comprehensive **international sanctions screening platform** that allows users to search, filter, and analyze sanctioned entities (individuals, organizations, vessels) against multiple international sanctions databases (OFAC, EU, UN, etc.).

**Key Capabilities:**
- 39,710+ sanctioned records in database
- Smart fuzzy search with spelling correction
- AI-powered semantic search (LLM integration)
- Batch screening of Excel files (up to 142+ names)
- Professional PDF reports with bilingual (Arabic/English) support
- Admin dashboard with user and company management
- Complete audit logging for compliance
- Role-based access control (Admin/User)

---

## 🛠 Tech Stack

### Backend
- **Runtime:** Node.js (Express 4.21)
- **Language:** TypeScript 5.9
- **Database:** MySQL/TiDB
- **ORM:** Drizzle ORM 0.44
- **API:** tRPC 11.6 (type-safe RPC)
- **Search:** Fuse.js 7.1 + Fast Levenshtein 3.0
- **AI:** OpenAI (via Forge API)
- **PDF Generation:** PDFKit 0.17 + jsPDF 4.2
- **Excel:** ExcelJS 4.4 + XLSX 0.18

### Frontend
- **Framework:** React 19.2 + Vite 7.1
- **Styling:** Tailwind CSS 4.1
- **UI Components:** shadcn/ui (Radix UI)
- **Routing:** Wouter 3.7
- **State Management:** TanStack React Query 5.90
- **Icons:** Lucide React 0.453
- **Animations:** Framer Motion 12.23

### DevOps & Build
- **Package Manager:** pnpm 10.4
- **Build Tool:** Vite + esbuild
- **Testing:** Vitest 2.1
- **Linting:** Prettier 3.6
- **Deployment:** Cloud Run (Node.js)

---

## 📊 Database Schema

### Table: `users`
```sql
- id (int, PK, autoincrement)
- openId (varchar 64, unique) - OAuth ID
- name (text)
- email (varchar 320)
- loginMethod (varchar 64)
- role (enum: 'user', 'admin') - default: 'user'
- companyId (int)
- isActive (boolean) - default: true
- username (varchar 100, unique) - for password auth
- passwordHash (varchar 255)
- createdAt (timestamp)
- updatedAt (timestamp)
- lastSignedIn (timestamp)
```

### Table: `companies`
```sql
- id (int, PK, autoincrement)
- name (varchar 255)
- nameAr (varchar 255)
- licenseNumber (varchar 100)
- country (varchar 100)
- contactEmail (varchar 320)
- contactPhone (varchar 50)
- isActive (boolean) - default: true
- maxUsers (int) - default: 10
- createdAt (timestamp)
- updatedAt (timestamp)
```

### Table: `sanctions_records`
```sql
- id (int, PK, autoincrement)
- nameEn (varchar 512) - English name
- nameAr (varchar 512) - Arabic name
- entityType (enum: 'individual', 'organisation', 'vessel', 'unspecified')
- listingDate (varchar 30)
- listingReason (varchar 255)
- issuingBody (varchar 100) - OFAC, EU, UN, etc.
- legalBasis (varchar 255)
- actionTaken (varchar 512)
- nationality (varchar 255)
- dateOfBirth (varchar 50)
- placeOfBirth (varchar 512)
- alternativeNames (json) - array of strings
- notes (text)
- referenceNumber (varchar 100)
- rawNotes (text) - for full-text search
- searchIndex (text) - concatenated searchable text
- createdAt (timestamp)

INDEXES:
- nameEn_idx, nameAr_idx, entityType_idx, issuingBody_idx
- listingReason_idx, nationality_idx, listingDate_idx
```

### Table: `audit_logs`
```sql
- id (int, PK, autoincrement)
- userId (int)
- companyId (int)
- action (varchar 100) - 'search', 'export', 'batch_screening'
- query (varchar 512)
- filters (json)
- resultsCount (int)
- topMatchScore (float)
- exportFormat (varchar 20) - 'pdf', 'excel', 'json'
- ipAddress (varchar 64)
- userAgent (varchar 512)
- duration (int) - milliseconds
- createdAt (timestamp)
```

### Table: `import_logs`
```sql
- id (int, PK, autoincrement)
- userId (int)
- userName (varchar 255)
- fileName (varchar 512)
- importMode (enum: 'append', 'replace')
- status (enum: 'pending', 'processing', 'completed', 'failed')
- totalRows (int)
- importedRows (int)
- skippedRows (int)
- errorMessage (text)
- createdAt (timestamp)
- completedAt (timestamp)
```

### Table: `search_sessions`
```sql
- id (int, PK, autoincrement)
- userId (int)
- companyId (int)
- sessionToken (varchar 128)
- totalSearches (int)
- createdAt (timestamp)
- expiresAt (timestamp)
```

---

## ✨ Core Features

### 1. Smart Search Engine
**Location:** `server/search-engine.ts`

**Features:**
- **Fuzzy Matching:** Fuse.js with configurable threshold
- **Levenshtein Distance:** Fast spelling correction
- **Exact Match Detection:** 100% score for perfect matches
- **Token-based Matching:** Matches individual words
- **Bidirectional Scoring:** Matches query→record and record→query
- **Symbol/Punctuation Normalization:** Ignores dots, commas, hyphens in search

**Key Functions:**
```typescript
export async function search(options: SearchOptions): Promise<SearchResult[]>
export function scoreRecord(query: string, record: SanctionsRecord): number
export function normalizeSearchText(text: string): string
export function normalizeEnglish(text: string): string
```

**Search Algorithm:**
1. Normalize query (remove symbols, lowercase)
2. Query database with LIKE clause (both original and normalized)
3. Score each result using multiple algorithms
4. Apply filters (entityType, nationality, dateRange, etc.)
5. Sort by score descending
6. Return top N results

### 2. Batch Screening
**Location:** `server/batch-handler.ts`, `client/src/pages/BatchScreening.tsx`

**Features:**
- Upload Excel files (.xlsx, .xls) up to 10MB
- Process up to 142+ names in parallel
- Match threshold: 90% = MATCH, 70-89% = POSSIBLE MATCH, <70% = NO MATCH
- Real-time progress tracking
- Export results to PDF, Excel, JSON
- Download template Excel file

**Performance Optimizations:**
- Parallel processing: 10 names at a time
- In-memory search (Fuse.js) instead of DB queries
- Reduced Fuse.js dataset: 1000 records (instead of 5000)
- 50ms delay between batches (instead of 100ms)

### 3. PDF Report Generation
**Location:** `server/_core/pdf-report.ts`

**Features:**
- Professional LSEG World-Check style layout
- Bilingual support (Arabic + English)
- Automatic font detection and switching
- Logo and branding integration
- Single-page compact format
- Sections:
  - Header with logo and "Confidential" stamp
  - Record UID (highlighted)
  - Case and Comparison Data
  - Key Data (compact table)
  - Aliases/Alternative Names
  - Footer with page number

**Font Support:**
- NotoSansArabic.ttf - Arabic text
- NotoSans-Regular.ttf - English text
- Automatic mixed-text handling (e.g., "IRAQ2 / عقوبات العراق")

### 4. Admin Dashboard
**Location:** `client/src/pages/AdminDashboard.tsx`

**Features:**
- Statistics: Total records, users, companies, searches
- User management (create, edit, disable)
- Company management
- Audit log viewer with search and filters
- Data import (Excel upload)
- Role-based access (Admin only)

### 5. Authentication
**Location:** `server/_core/auth.ts`, `client/src/pages/LoginPage.tsx`

**Methods:**
- Password-based authentication (username + password)
- Manus OAuth (optional)
- Session cookies (JWT-based)
- Role-based access control (Admin/User)

**Password Hashing:** bcryptjs with salt rounds: 10

---

## 🔍 Search Engine Details

### Normalization Functions

**`normalizeSearchText(text: string)`** - Removes all symbols/punctuation
```typescript
// Input: "HUTHELE, Nasr Mohsen Ali"
// Output: "huthele nasr mohsen ali"
```

**`normalizeEnglish(text: string)`** - Removes symbols from English text
```typescript
// Input: "Smith, John Jr."
// Output: "smith john jr"
```

### Scoring Algorithm

1. **Exact Match:** If normalized query === normalized name → score = 1.0
2. **Fuzzy Match:** Fuse.js with threshold 0.3
3. **Token Score:** Bidirectional token matching
4. **Levenshtein Distance:** For spelling variations
5. **Alternative Names:** Check against all aliases

### Match Types
- `exact` - Perfect match (100%)
- `fuzzy` - Fuse.js match (70-99%)
- `phonetic` - Levenshtein-based (50-69%)
- `ai` - LLM semantic match (40-49%)

---

## 🔌 API Endpoints

### Search
- `POST /api/trpc/search.query` - Single search
- `POST /api/trpc/search.batch` - Batch screening

### Records
- `GET /api/trpc/records.getById` - Get record details
- `GET /api/trpc/records.getAll` - List all records

### Export
- `POST /api/trpc/export.pdf` - Generate PDF report
- `POST /api/trpc/export.excel` - Generate Excel
- `POST /api/trpc/export.json` - Generate JSON

### Admin
- `POST /api/admin/import-sanctions` - Upload Excel file
- `POST /api/trpc/admin.createUser` - Create user
- `POST /api/trpc/admin.updateUser` - Update user
- `POST /api/trpc/admin.deleteUser` - Delete user

### Auth
- `POST /api/auth/login` - Password login
- `POST /api/auth/logout` - Logout
- `GET /api/trpc/auth.me` - Get current user

---

## 📄 Frontend Pages

### Public Pages
- `/` - Home page (Arabic/English toggle, branding)
- `/login` - Login page (username + password)

### User Pages
- `/search` - Main search interface
- `/batch` - Batch screening
- `/record/:id` - Record details

### Admin Pages
- `/admin` - Dashboard
- `/admin/users` - User management
- `/admin/companies` - Company management
- `/admin/audit-logs` - Audit log viewer
- `/admin/import-data` - Data import

---

## 🚀 Installation & Setup

### Prerequisites
- Node.js 22+
- pnpm 10+
- MySQL 8+ or TiDB

### Step 1: Clone & Install
```bash
git clone <repository>
cd smart-search-app
pnpm install
```

### Step 2: Environment Setup
Create `.env` file with:
```
DATABASE_URL=mysql://user:password@host:port/database
JWT_SECRET=your-secret-key
VITE_APP_ID=your-app-id
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://manus.im
OWNER_OPEN_ID=your-owner-id
OWNER_NAME=Your Name
BUILT_IN_FORGE_API_URL=https://api.manus.im/forge
BUILT_IN_FORGE_API_KEY=your-api-key
VITE_FRONTEND_FORGE_API_KEY=your-frontend-key
VITE_FRONTEND_FORGE_API_URL=https://api.manus.im/forge
```

### Step 3: Database Setup
```bash
pnpm db:push  # Create tables and run migrations
```

### Step 4: Load Initial Data
```bash
# Place your sanctions data Excel file in the project
# Use Admin Panel → Import Data to upload the file
# Or run the import script directly
```

### Step 5: Development
```bash
pnpm dev       # Start dev server (http://localhost:3000)
pnpm test      # Run tests
pnpm build     # Build for production
pnpm start     # Start production server
```

---

## 🎨 Key Customizations

### 1. Theme Colors
**File:** `client/src/index.css`

```css
:root {
  --primary: #C17F3E;        /* Golden */
  --primary-foreground: #fff;
  --background: #ffffff;
  --foreground: #1a1a1a;
  --secondary: #f5f5f5;
  --accent: #C17F3E;
}

.dark {
  --background: #1a1a1a;
  --foreground: #ffffff;
  --secondary: #2a2a2a;
}
```

### 2. Branding
**Logo:** `server/fonts/logo.png` (Al-Mustashar logo)
**Company Name:** "المستشار للاستشارات القانونية"
**Tagline:** "منصة فحص العقوبات الدولية"

### 3. Search Thresholds
**File:** `server/search-engine.ts`

```typescript
const FUSE_THRESHOLD = 0.3;      // Fuzzy match threshold
const BATCH_MATCH_THRESHOLD = 0.9;  // 90% for batch
const BATCH_POSSIBLE_THRESHOLD = 0.7; // 70-89% possible
```

### 4. Batch Processing
**File:** `server/batch-handler.ts`

```typescript
const PARALLEL_LIMIT = 10;       // Process 10 names at a time
const BATCH_DELAY = 50;          // 50ms between batches
const FUSE_LIMIT = 1000;         // Load 1000 records into Fuse.js
```

---

## ⚡ Performance Optimizations

### 1. Database Queries
- **Indexed columns:** nameEn, nameAr, entityType, issuingBody, nationality
- **LIKE queries:** Use LIKE with wildcards on indexed columns
- **Limit results:** Default 100, max 1000

### 2. Search Engine
- **Fuse.js limit:** 1000 records (instead of 5000)
- **Parallel processing:** 10 names at a time in batch
- **In-memory search:** Batch uses Fuse.js instead of DB queries
- **Caching:** Results cached for 5 minutes

### 3. Frontend
- **Code splitting:** Lazy load admin pages
- **Image optimization:** Logo as PNG with transparency
- **CSS optimization:** Tailwind purging unused styles
- **Bundle size:** ~250KB gzipped

### 4. API
- **Response compression:** gzip enabled
- **Pagination:** Default 20 results per page
- **Rate limiting:** 100 requests/minute per user

---

## 📝 Important Notes

### Data Import
- Excel format: Column A = Names (English or Arabic)
- Supported modes: Append (add new) or Replace (overwrite all)
- Max file size: 10MB
- Max records: 100,000 per import

### PDF Reports
- Single page format (compressed)
- Fonts: NotoSansArabic + NotoSans
- Supports mixed Arabic/English text
- Logo: Al-Mustashar branding

### Audit Logging
- All searches logged with timestamp, user, query, results count
- All exports logged with format and duration
- Admin actions logged (user create/delete, imports)
- Retention: 90 days (configurable)

### Security
- Passwords hashed with bcryptjs (10 rounds)
- JWT session tokens with 24-hour expiry
- CORS enabled for frontend domain
- SQL injection prevention via Drizzle ORM
- XSS protection via React sanitization

---

## 🔄 Deployment

### Build for Production
```bash
pnpm build
```

Output:
- `dist/index.js` - Server bundle
- `dist/client/` - Frontend bundle
- `dist/fonts/` - Font files

### Deploy to Cloud Run
```bash
gcloud run deploy smart-search-app \
  --source . \
  --region us-central1 \
  --memory 512Mi \
  --cpu 1 \
  --timeout 180
```

### Environment Variables (Production)
Set all `.env` variables in Cloud Run environment

### Database Connection
- Use SSL/TLS for MySQL connection
- Connection pooling: 10 connections
- Timeout: 30 seconds

---

## 📞 Support & Maintenance

### Common Issues

**Issue:** PDF fonts not rendering
- **Solution:** Ensure `dist/fonts/` contains all 4 font files after build

**Issue:** Batch screening timeout
- **Solution:** Reduce PARALLEL_LIMIT or increase Cloud Run timeout

**Issue:** Search results slow
- **Solution:** Check database indexes, increase Fuse.js cache

### Monitoring
- Check server logs: `.manus-logs/devserver.log`
- Check browser console: `.manus-logs/browserConsole.log`
- Check network requests: `.manus-logs/networkRequests.log`

---

## 📚 File Structure

```
smart-search-app/
├── client/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Home.tsx
│   │   │   ├── LoginPage.tsx
│   │   │   ├── SearchPage.tsx
│   │   │   ├── BatchScreening.tsx
│   │   │   ├── RecordDetail.tsx
│   │   │   ├── AdminDashboard.tsx
│   │   │   ├── AdminUsers.tsx
│   │   │   ├── AdminCompanies.tsx
│   │   │   ├── AdminAuditLogs.tsx
│   │   │   └── ImportData.tsx
│   │   ├── components/
│   │   │   ├── AppLayout.tsx
│   │   │   ├── RecordModal.tsx
│   │   │   ├── ResultCard.tsx
│   │   │   └── ui/ (shadcn/ui components)
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   └── public/
├── server/
│   ├── search-engine.ts
│   ├── batch-handler.ts
│   ├── db.ts
│   ├── routers.ts
│   ├── _core/
│   │   ├── index.ts
│   │   ├── auth.ts
│   │   ├── context.ts
│   │   ├── pdf-report.ts
│   │   └── ...
│   └── fonts/
│       ├── NotoSansArabic.ttf
│       ├── NotoSans-Regular.ttf
│       └── logo.png
├── drizzle/
│   ├── schema.ts
│   └── migrations/
├── shared/
│   └── constants.ts
├── package.json
├── vite.config.ts
├── tsconfig.json
└── README.md
```

---

## 🎯 Next Steps for Enhancement

1. **Caching Layer:** Add Redis for search result caching
2. **Advanced Analytics:** Dashboard with search trends and patterns
3. **API Rate Limiting:** Implement token-based rate limiting
4. **Multi-language:** Support more languages (French, Spanish, etc.)
5. **Mobile App:** React Native version for iOS/Android
6. **Webhooks:** Real-time notifications for new sanctions listings
7. **API Documentation:** OpenAPI/Swagger documentation
8. **Data Sync:** Automated daily sync with OFAC/EU/UN databases

---

**End of Specification Document**

*For questions or updates, contact: mr.maged.saeel@gmail.com*
