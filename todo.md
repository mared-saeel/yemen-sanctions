# Smart Sanctions Search Platform - TODO

## Phase 1: Database Schema & Backend Foundation
- [x] Design and push database schema (sanctions, companies, audit_logs tables)
- [x] Install required packages (fuse.js, xlsx, exceljs, pdfkit, fast-levenshtein)
- [x] Build data import script to load 39,710 records from Excel into DB
- [x] Build fuzzy search engine with Levenshtein Distance + Fuse.js
- [x] Build AI-powered semantic search using LLM (Forge API)
- [x] Build tRPC search router with advanced filtering
- [x] Build audit log system for all search operations

## Phase 2: Frontend - Search Interface
- [x] Design dark professional theme (LSEG World-Check style)
- [x] Build main search page with smart search bar
- [x] Build entity type filter (Individual / Organisation / Vessel / Unspecified)
- [x] Build advanced filters (nationality, date range, listing reason, issuing body)
- [x] Build search results list with match score display
- [x] Build detailed record view modal/page
- [ ] Build batch search mode (placeholder - coming soon)

## Phase 3: Admin Dashboard
- [x] Build admin dashboard with statistics
- [x] Build user management (create, edit, disable users)
- [x] Build company management
- [x] Build audit log viewer with search and filters
- [ ] Build system monitoring charts (coming soon)

## Phase 4: Export & Reports
- [x] Export search results to PDF (print-to-PDF)
- [x] Export search results to Excel/CSV
- [x] Export search results to JSON
- [ ] Generate detailed screening report per record (coming soon)

## Phase 5: Testing & Polish
- [x] Write vitest unit tests for search engine
- [x] Write vitest unit tests for auth/permissions
- [x] Final UI polish and responsiveness
- [x] Save checkpoint and deliver

## Phase 6: UI Redesign - White Professional Theme
- [x] Redesign index.css with white/light professional theme
- [x] Update AppLayout with new sidebar and header design
- [x] Update SearchPage with white theme and new card design
- [x] Update Admin pages with new white theme
- [x] Update RecordModal with new design
- [x] Test and verify all pages look correct

## Phase 7: Logo & Branding
- [x] Upload Almustashar logo to CDN
- [x] Remove "World-Check" text from all UI components
- [x] Add logo to sidebar in AppLayout
- [x] Add logo to SearchPage header/check types section
- [x] Save checkpoint and deliver

## Phase 8: Password Authentication System
- [x] Add passwordHash and username fields to users table in schema
- [x] Add password-based login API (POST /api/auth/login)
- [x] Add create user API for admins (with username + password)
- [x] Add change password API
- [x] Build login page with username/password form
- [x] Update AdminUsers page with create/edit user modal
- [x] Write vitest tests for auth (24/24 passed)
- [x] Save checkpoint and deliver

## Phase 9: Fix Sign In Redirect
- [x] Fix Sign In button in Home page to redirect to /login instead of Manus OAuth
- [x] Fix AppLayout Sign In link to redirect to /login
- [x] Ensure all auth redirects bypass OAuth and go directly to password login
- [x] Save checkpoint and deliver

## Phase 10: Golden Brand Colors
- [x] Update CSS --primary variable to golden color (#C17F3E)
- [x] Update sidebar active nav item to golden
- [x] Update SCREEN button and all primary buttons to golden
- [x] Update login page accent to golden
- [x] Update badges and highlights to golden
- [x] Test all pages visually
- [x] Save checkpoint and deliver

## Phase 11: Excel Import from Admin Panel
- [x] Build Express multipart endpoint for Excel file upload (/api/admin/import-sanctions)
- [x] Write Excel parsing and DB insert logic (append mode + replace mode)
- [x] Add import_logs table to track import history
- [x] Build ImportData page in admin panel
- [x] Add "Import Data" link in sidebar navigation
- [x] Test feature and save checkpoint

## Phase 12: Professional PDF Report
- [x] Study RecordModal and data structure
- [x] Build tRPC procedure to generate PDF report for a record
- [x] Design professional PDF layout with logo, record details, legal disclaimer
- [x] Add "Download Report" button in RecordModal footer
- [x] Test and save checkpoint
