import { eq, desc, and, like, sql, count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, companies, auditLogs, sanctionsRecords, InsertAuditLog, InsertCompany } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllUsers(page = 1, pageSize = 20) {
  const db = await getDb();
  if (!db) return { users: [], total: 0 };
  const offset = (page - 1) * pageSize;
  const [rows, [{ total }]] = await Promise.all([
    db.select().from(users).orderBy(desc(users.createdAt)).limit(pageSize).offset(offset),
    db.select({ total: count() }).from(users),
  ]);
  return { users: rows, total: Number(total) };
}

export async function updateUserStatus(userId: number, isActive: boolean) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ isActive }).where(eq(users.id, userId));
}

export async function updateUserRole(userId: number, role: "user" | "admin") {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ role }).where(eq(users.id, userId));
}

// ─── Companies ────────────────────────────────────────────────────────────────

export async function createCompany(data: InsertCompany) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(companies).values(data);
  return result;
}

export async function getAllCompanies() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(companies).orderBy(desc(companies.createdAt));
}

export async function updateCompany(id: number, data: Partial<InsertCompany>) {
  const db = await getDb();
  if (!db) return;
  await db.update(companies).set(data).where(eq(companies.id, id));
}

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export async function createAuditLog(data: InsertAuditLog) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(auditLogs).values(data);
  } catch (err) {
    console.error("[AuditLog] Failed to create:", err);
  }
}

export async function getAuditLogs(options: {
  page?: number;
  pageSize?: number;
  userId?: number;
  companyId?: number;
  action?: string;
}) {
  const db = await getDb();
  if (!db) return { logs: [], total: 0 };
  const { page = 1, pageSize = 50, userId, companyId, action } = options;
  const offset = (page - 1) * pageSize;
  const conditions = [];
  if (userId) conditions.push(eq(auditLogs.userId, userId));
  if (companyId) conditions.push(eq(auditLogs.companyId, companyId));
  if (action) conditions.push(eq(auditLogs.action, action as any));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const [rows, [{ total }]] = await Promise.all([
    db.select().from(auditLogs).where(whereClause).orderBy(desc(auditLogs.createdAt)).limit(pageSize).offset(offset),
    db.select({ total: count() }).from(auditLogs).where(whereClause),
  ]);
  return { logs: rows, total: Number(total) };
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export async function getDashboardStats() {
  const db = await getDb();
  if (!db) return null;
  const [
    [{ totalRecords }],
    [{ totalUsers }],
    [{ totalSearches }],
    [{ totalCompanies }],
  ] = await Promise.all([
    db.select({ totalRecords: count() }).from(sanctionsRecords),
    db.select({ totalUsers: count() }).from(users),
    db.select({ totalSearches: count() }).from(auditLogs).where(eq(auditLogs.action, "search")),
    db.select({ totalCompanies: count() }).from(companies),
  ]);
  return {
    totalRecords: Number(totalRecords),
    totalUsers: Number(totalUsers),
    totalSearches: Number(totalSearches),
    totalCompanies: Number(totalCompanies),
  };
}
