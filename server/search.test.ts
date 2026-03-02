import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the search engine
vi.mock("./search-engine", () => ({
  searchSanctions: vi.fn().mockResolvedValue({
    results: [
      {
        id: 1,
        nameEn: "SADDAM HUSSEIN",
        nameAr: "صدام حسين",
        entityType: "individual",
        listingDate: "2003-05-23",
        listingReason: "Terrorism",
        issuingBody: "UN",
        legalBasis: "UNSCR 1483",
        actionTaken: "Asset freeze",
        nationality: "IRAQI",
        dateOfBirth: "1937-04-28",
        placeOfBirth: "Tikrit",
        alternativeNames: ["Saddam Hussein al-Tikriti"],
        notes: null,
        referenceNumber: "QI.S.2.01",
        rawNotes: null,
        matchScore: 98,
        matchType: "exact",
      },
    ],
    total: 1,
    queryTime: 45,
  }),
  aiEnhancedSearch: vi.fn().mockResolvedValue({
    expandedQuery: "SADDAM HUSSEIN",
    suggestions: ["Saddam Husein", "صدام حسين"],
    explanation: "Name variations for Saddam Hussein",
  }),
  getRecordById: vi.fn().mockResolvedValue({
    id: 1,
    nameEn: "SADDAM HUSSEIN",
    nameAr: "صدام حسين",
    entityType: "individual",
    alternativeNames: ["Saddam Hussein al-Tikriti"],
    listingDate: "2003-05-23",
    listingReason: "Terrorism",
    issuingBody: "UN",
    legalBasis: "UNSCR 1483",
    actionTaken: "Asset freeze",
    nationality: "IRAQI",
    dateOfBirth: "1937-04-28",
    placeOfBirth: "Tikrit",
    notes: null,
    referenceNumber: "QI.S.2.01",
    rawNotes: null,
  }),
  getFilterOptions: vi.fn().mockResolvedValue({
    issuingBodies: ["UN", "EU", "OFAC"],
    listingReasons: ["Terrorism", "Proliferation"],
    nationalities: ["IRAQI", "IRANIAN", "SYRIAN"],
  }),
}));

vi.mock("./db", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  getDb: vi.fn().mockResolvedValue(null),
  upsertUser: vi.fn().mockResolvedValue(undefined),
  getUserByOpenId: vi.fn().mockResolvedValue(undefined),
  getAllUsers: vi.fn().mockResolvedValue({ users: [], total: 0 }),
  getAllCompanies: vi.fn().mockResolvedValue([]),
  createCompany: vi.fn().mockResolvedValue(undefined),
  updateCompany: vi.fn().mockResolvedValue(undefined),
  updateUserStatus: vi.fn().mockResolvedValue(undefined),
  updateUserRole: vi.fn().mockResolvedValue(undefined),
  getAuditLogs: vi.fn().mockResolvedValue({ logs: [], total: 0 }),
  getDashboardStats: vi.fn().mockResolvedValue({
    totalRecords: 39710,
    totalUsers: 5,
    totalSearches: 100,
    totalCompanies: 3,
  }),
}));

function createUserContext(role: "user" | "admin" = "user"): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "manus",
      role,
      companyId: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: { "x-forwarded-for": "127.0.0.1", "user-agent": "test" },
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

// ─── Auth Tests ───────────────────────────────────────────────────────────────

describe("auth", () => {
  it("returns null for unauthenticated user", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("returns user for authenticated user", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).not.toBeNull();
    expect(result?.name).toBe("Test User");
  });

  it("clears session cookie on logout", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result.success).toBe(true);
  });
});

// ─── Search Tests ─────────────────────────────────────────────────────────────

describe("search", () => {
  it("performs a basic search and returns results", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.search.query({
      query: "Saddam Hussein",
      limit: 20,
      offset: 0,
      enableAI: false,
      threshold: 0.35,
    });
    expect(result.results).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.results[0].nameEn).toBe("SADDAM HUSSEIN");
    expect(result.results[0].matchScore).toBe(98);
  });

  it("returns filter options", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.search.filterOptions();
    expect(result.issuingBodies).toContain("UN");
    expect(result.nationalities).toContain("IRAQI");
  });

  it("retrieves a record by ID", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.search.getRecord({ id: 1 });
    expect(result.id).toBe(1);
    expect(result.nameEn).toBe("SADDAM HUSSEIN");
  });

  it("throws NOT_FOUND for non-existent record", async () => {
    const { getRecordById } = await import("./search-engine");
    vi.mocked(getRecordById).mockResolvedValueOnce(null);
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.search.getRecord({ id: 99999 })).rejects.toThrow("NOT_FOUND");
  });

  it("performs AI-enhanced search", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.search.query({
      query: "Saddam Husein",
      limit: 20,
      offset: 0,
      enableAI: true,
      threshold: 0.35,
    });
    expect(result.aiEnhancement).not.toBeNull();
    expect(result.aiEnhancement?.suggestions).toContain("صدام حسين");
  });

  it("requires authentication for search", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.search.query({ query: "test", limit: 20, offset: 0, enableAI: false, threshold: 0.35 })
    ).rejects.toThrow();
  });
});

// ─── Admin Tests ──────────────────────────────────────────────────────────────

describe("admin", () => {
  it("returns dashboard stats for admin", async () => {
    const ctx = createUserContext("admin");
    const caller = appRouter.createCaller(ctx);
    const stats = await caller.admin.stats();
    expect(stats?.totalRecords).toBe(39710);
    expect(stats?.totalUsers).toBe(5);
  });

  it("denies admin access to regular users", async () => {
    const ctx = createUserContext("user");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.admin.stats()).rejects.toThrow("Admin access required");
  });

  it("lists users for admin", async () => {
    const ctx = createUserContext("admin");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.admin.users.list({ page: 1, pageSize: 20 });
    expect(result.users).toBeDefined();
    expect(result.total).toBeDefined();
  });

  it("lists companies for admin", async () => {
    const ctx = createUserContext("admin");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.admin.companies.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("lists audit logs for admin", async () => {
    const ctx = createUserContext("admin");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.admin.auditLogs.list({ page: 1, pageSize: 50 });
    expect(result.logs).toBeDefined();
    expect(result.total).toBeDefined();
  });
});

// ─── Export Tests ─────────────────────────────────────────────────────────────

describe("export", () => {
  it("logs export activity", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.export.logExport({
      query: "test query",
      format: "json",
      count: 5,
    });
    expect(result.success).toBe(true);
  });
});
