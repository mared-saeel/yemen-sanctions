import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  bigint,
  float,
  boolean,
  json,
  index,
} from "drizzle-orm/mysql-core";

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  companyId: int("companyId"),
  isActive: boolean("isActive").default(true).notNull(),
  // Password-based auth fields
  username: varchar("username", { length: 100 }).unique(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Companies ────────────────────────────────────────────────────────────────
export const companies = mysqlTable("companies", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  nameAr: varchar("nameAr", { length: 255 }),
  licenseNumber: varchar("licenseNumber", { length: 100 }),
  country: varchar("country", { length: 100 }),
  contactEmail: varchar("contactEmail", { length: 320 }),
  contactPhone: varchar("contactPhone", { length: 50 }),
  isActive: boolean("isActive").default(true).notNull(),
  maxUsers: int("maxUsers").default(10).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Company = typeof companies.$inferSelect;
export type InsertCompany = typeof companies.$inferInsert;

// ─── Sanctions Records ────────────────────────────────────────────────────────
export const sanctionsRecords = mysqlTable(
  "sanctions_records",
  {
    id: int("id").autoincrement().primaryKey(),
    // Primary names
    nameEn: varchar("nameEn", { length: 512 }).notNull(),
    nameAr: varchar("nameAr", { length: 512 }),
    // Entity classification
    entityType: mysqlEnum("entityType", [
      "individual",
      "organisation",
      "vessel",
      "unspecified",
    ])
      .default("unspecified")
      .notNull(),
    // Listing details
    listingDate: varchar("listingDate", { length: 30 }),
    listingReason: varchar("listingReason", { length: 255 }),
    issuingBody: varchar("issuingBody", { length: 100 }),
    legalBasis: varchar("legalBasis", { length: 255 }),
    // Action taken
    actionTaken: varchar("actionTaken", { length: 512 }),
    // Personal details (individuals)
    nationality: varchar("nationality", { length: 255 }),
    dateOfBirth: varchar("dateOfBirth", { length: 50 }),
    placeOfBirth: varchar("placeOfBirth", { length: 512 }),
    // Alternative names (stored as JSON array)
    alternativeNames: json("alternativeNames").$type<string[]>(),
    // Notes and reference
    notes: text("notes"),
    referenceNumber: varchar("referenceNumber", { length: 100 }),
    // Full raw notes for full-text search
    rawNotes: text("rawNotes"),
    // Search optimization: concatenated searchable text
    searchIndex: text("searchIndex"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    nameEnIdx: index("nameEn_idx").on(table.nameEn),
    nameArIdx: index("nameAr_idx").on(table.nameAr),
    entityTypeIdx: index("entityType_idx").on(table.entityType),
    issuingBodyIdx: index("issuingBody_idx").on(table.issuingBody),
    listingReasonIdx: index("listingReason_idx").on(table.listingReason),
    nationalityIdx: index("nationality_idx").on(table.nationality),
    listingDateIdx: index("listingDate_idx").on(table.listingDate),
  })
);

export type SanctionsRecord = typeof sanctionsRecords.$inferSelect;
export type InsertSanctionsRecord = typeof sanctionsRecords.$inferInsert;

// ─── Audit Logs ───────────────────────────────────────────────────────────────
export const auditLogs = mysqlTable(
  "audit_logs",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    userId: int("userId"),
    companyId: int("companyId"),
    userName: varchar("userName", { length: 255 }),
    companyName: varchar("companyName", { length: 255 }),
    action: mysqlEnum("action", ["search", "view", "export", "login", "logout", "admin"]).notNull(),
    query: varchar("query", { length: 1024 }),
    filters: json("filters"),
    resultsCount: int("resultsCount"),
    topMatchScore: float("topMatchScore"),
    exportFormat: varchar("exportFormat", { length: 20 }),
    ipAddress: varchar("ipAddress", { length: 64 }),
    userAgent: varchar("userAgent", { length: 512 }),
    duration: int("duration"), // milliseconds
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("userId_idx").on(table.userId),
    companyIdIdx: index("companyId_idx").on(table.companyId),
    actionIdx: index("action_idx").on(table.action),
    createdAtIdx: index("createdAt_idx").on(table.createdAt),
  })
);

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

// ─── Import Logs ──────────────────────────────────────────────────────────────
export const importLogs = mysqlTable("import_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  userName: varchar("userName", { length: 255 }),
  fileName: varchar("fileName", { length: 512 }).notNull(),
  importMode: mysqlEnum("importMode", ["append", "replace"]).notNull().default("append"),
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).notNull().default("pending"),
  totalRows: int("totalRows"),
  importedRows: int("importedRows"),
  skippedRows: int("skippedRows"),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type ImportLog = typeof importLogs.$inferSelect;
export type InsertImportLog = typeof importLogs.$inferInsert;

// ─── Search Sessions ──────────────────────────────────────────────────────────
export const searchSessions = mysqlTable("search_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  companyId: int("companyId"),
  sessionToken: varchar("sessionToken", { length: 128 }).notNull().unique(),
  totalSearches: int("totalSearches").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
});
