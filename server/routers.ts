import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  getAllUsers,
  getAllCompanies,
  createCompany,
  updateCompany,
  updateUserStatus,
  updateUserRole,
  getAuditLogs,
  createAuditLog,
  getDashboardStats,
  getDb,
  getUserByUsername,
  createLocalUser,
  updateUserPassword,
  deleteUser,
  updateUserLastSignIn,
} from "./db";
import bcrypt from "bcryptjs";
import { searchSanctions, aiEnhancedSearch, getRecordById, getFilterOptions, loadAllRecordsForBatch, buildBatchFuseIndex, batchSearchOne } from "./search-engine";
import { processBatch, formatBatchResults, getBatchStatistics } from "./batch-processor";
import { sanctionsRecords } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { ENV } from "./_core/env";

// Admin guard middleware
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,

  // ─── Auth ──────────────────────────────────────────────────────────────────
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),

    // Login with username + password
    loginWithPassword: publicProcedure
      .input(z.object({
        username: z.string().min(1).max(100),
        password: z.string().min(1).max(255),
      }))
      .mutation(async ({ ctx, input }) => {
        const user = await getUserByUsername(input.username.toLowerCase().trim());
        if (!user || !user.passwordHash) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid username or password" });
        }
        if (!user.isActive) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Account is disabled" });
        }
        const isValid = await bcrypt.compare(input.password, user.passwordHash);
        if (!isValid) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid username or password" });
        }
        // Create session token using the SDK
        const { sdk } = await import("./_core/sdk");
        // For local users, use username as openId if not set
        const openId = user.openId || `local:${user.username}`;
        const token = await sdk.createSessionToken(openId, { name: user.name ?? user.username ?? "" });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, cookieOptions);
        await updateUserLastSignIn(user.id);
        await createAuditLog({
          userId: user.id,
          companyId: user.companyId ?? undefined,
          userName: user.name ?? user.username ?? undefined,
          action: "login",
          ipAddress: ctx.req.headers["x-forwarded-for"] as string ?? "unknown",
          userAgent: ctx.req.headers["user-agent"] ?? "unknown",
        });
        return { success: true, user: { id: user.id, name: user.name, role: user.role } };
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Search ────────────────────────────────────────────────────────────────
  search: router({
    query: protectedProcedure
      .input(z.object({
        query: z.string().min(1).max(500),
        filters: z.object({
          entityType: z.enum(["individual", "organisation", "vessel", "unspecified"]).nullable().optional(),
          nationality: z.string().nullable().optional(),
          issuingBody: z.string().nullable().optional(),
          listingReason: z.string().nullable().optional(),
          dateFrom: z.string().nullable().optional(),
          dateTo: z.string().nullable().optional(),
        }).optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
        enableAI: z.boolean().default(false),
        threshold: z.number().min(0).max(1).default(0.35),
      }))
      .mutation(async ({ ctx, input }) => {
        const startTime = Date.now();
        let aiData = null;

        // AI enhancement if requested
        if (input.enableAI) {
          aiData = await aiEnhancedSearch(
            input.query,
            ENV.forgeApiUrl,
            ENV.forgeApiKey
          );
        }

        const searchQuery = aiData?.expandedQuery || input.query;
        const result = await searchSanctions({
          query: searchQuery,
          filters: input.filters,
          limit: input.limit,
          offset: input.offset,
          threshold: input.threshold,
        });

        const duration = Date.now() - startTime;

        // Log the search
        await createAuditLog({
          userId: ctx.user.id,
          companyId: ctx.user.companyId ?? undefined,
          userName: ctx.user.name ?? undefined,
          action: "search",
          query: input.query,
          filters: input.filters ?? null,
          resultsCount: result.total,
          topMatchScore: result.results[0]?.matchScore ?? null,
          ipAddress: ctx.req.headers["x-forwarded-for"] as string ?? "unknown",
          userAgent: ctx.req.headers["user-agent"] ?? "unknown",
          duration,
        });

        return {
          ...result,
          aiEnhancement: aiData,
        };
      }),

    getRecord: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const record = await getRecordById(input.id);
        if (!record) throw new TRPCError({ code: "NOT_FOUND" });

        await createAuditLog({
          userId: ctx.user.id,
          companyId: ctx.user.companyId ?? undefined,
          userName: ctx.user.name ?? undefined,
          action: "view",
          query: `record:${input.id}`,
          resultsCount: 1,
        });

        return record;
      }),

    filterOptions: protectedProcedure.query(async () => {
      return getFilterOptions();
    }),

    aiSuggest: protectedProcedure
      .input(z.object({ query: z.string().min(1) }))
      .mutation(async ({ input }) => {
        return aiEnhancedSearch(input.query, ENV.forgeApiUrl, ENV.forgeApiKey);
      }),
  }),

  // ─── Admin ─────────────────────────────────────────────────────────────────
  admin: router({
    stats: adminProcedure.query(async () => {
      return getDashboardStats();
    }),

    users: router({
      list: adminProcedure
        .input(z.object({ page: z.number().default(1), pageSize: z.number().default(20) }))
        .query(async ({ input }) => {
          return getAllUsers(input.page, input.pageSize);
        }),

      setStatus: adminProcedure
        .input(z.object({ userId: z.number(), isActive: z.boolean() }))
        .mutation(async ({ input }) => {
          await updateUserStatus(input.userId, input.isActive);
          return { success: true };
        }),

      setRole: adminProcedure
        .input(z.object({ userId: z.number(), role: z.enum(["user", "admin"]) }))
        .mutation(async ({ input }) => {
          await updateUserRole(input.userId, input.role);
          return { success: true };
        }),

      create: adminProcedure
        .input(z.object({
          username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_]+$/, "Username must be alphanumeric"),
          password: z.string().min(6).max(100),
          name: z.string().min(1).max(255),
          role: z.enum(["user", "admin"]).default("user"),
          companyId: z.number().optional(),
        }))
        .mutation(async ({ input }) => {
          // Check if username already exists
          const existing = await getUserByUsername(input.username.toLowerCase());
          if (existing) {
            throw new TRPCError({ code: "CONFLICT", message: "Username already exists" });
          }
          const passwordHash = await bcrypt.hash(input.password, 12);
          await createLocalUser({
            username: input.username.toLowerCase(),
            passwordHash,
            name: input.name,
            role: input.role,
            companyId: input.companyId,
          });
          return { success: true };
        }),

      changePassword: adminProcedure
        .input(z.object({
          userId: z.number(),
          newPassword: z.string().min(6).max(100),
        }))
        .mutation(async ({ input }) => {
          const passwordHash = await bcrypt.hash(input.newPassword, 12);
          await updateUserPassword(input.userId, passwordHash);
          return { success: true };
        }),

      delete: adminProcedure
        .input(z.object({ userId: z.number() }))
        .mutation(async ({ input }) => {
          await deleteUser(input.userId);
          return { success: true };
        }),
    }),

    companies: router({
      list: adminProcedure.query(async () => {
        return getAllCompanies();
      }),

      create: adminProcedure
        .input(z.object({
          name: z.string().min(1),
          nameAr: z.string().optional(),
          licenseNumber: z.string().optional(),
          country: z.string().optional(),
          contactEmail: z.string().email().optional(),
          contactPhone: z.string().optional(),
          maxUsers: z.number().default(10),
        }))
        .mutation(async ({ input }) => {
          await createCompany(input);
          return { success: true };
        }),

      update: adminProcedure
        .input(z.object({
          id: z.number(),
          name: z.string().optional(),
          nameAr: z.string().optional(),
          isActive: z.boolean().optional(),
          maxUsers: z.number().optional(),
        }))
        .mutation(async ({ input }) => {
          const { id, ...data } = input;
          await updateCompany(id, data);
          return { success: true };
        }),
    }),

    updateSanctionRecord: adminProcedure
      .input(z.object({
        id: z.number(),
        nameEn: z.string().optional(),
        nameAr: z.string().optional(),
        entityType: z.enum(["individual", "organisation", "vessel", "unspecified"]).optional(),
        listingDate: z.string().optional(),
        listingReason: z.string().optional(),
        issuingBody: z.string().optional(),
        legalBasis: z.string().optional(),
        actionTaken: z.string().optional(),
        nationality: z.string().optional(),
        dateOfBirth: z.string().optional(),
        placeOfBirth: z.string().optional(),
        notes: z.string().optional(),
        referenceNumber: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { id, ...updates } = input;

        await db
          .update(sanctionsRecords)
          .set(updates)
          .where(eq(sanctionsRecords.id, id));

        await createAuditLog({
          userId: ctx.user.id,
          companyId: ctx.user.companyId ?? undefined,
          userName: ctx.user.name ?? undefined,
          action: "admin",
          query: `update:record:${id}`,
          resultsCount: 1,
        });

        return { success: true };
      }),

    auditLogs: router({
      list: adminProcedure
        .input(z.object({
          page: z.number().default(1),
          pageSize: z.number().default(50),
          userId: z.number().optional(),
          companyId: z.number().optional(),
          action: z.string().optional(),
        }))
        .query(async ({ input }) => {
          return getAuditLogs(input);
        }),
    }),
  }),

  // ─── Batch Processing ────────────────────────────────────────────────────────
  batch: router({
    // Start a batch job (returns jobId immediately, processing happens in background)
    start: protectedProcedure
      .input(z.object({
        names: z.array(z.string()).min(1).max(100),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const { createBatchJob, processJobInBackground } = await import("./batch-processor");
          const jobId = createBatchJob(input.names);

          // Start background processing (non-blocking)
          processJobInBackground(jobId, input.names).then(async () => {
            // Log the batch operation when done
            const { getJob } = await import("./batch-processor");
            const job = getJob(jobId);
            if (job) {
              await createAuditLog({
                userId: ctx.user.id,
                companyId: ctx.user.companyId ?? undefined,
                userName: ctx.user.name ?? undefined,
                action: "search",
                query: `batch:${input.names.length}:names`,
                resultsCount: job.matchCount,
              });
            }
          });

          return { jobId, total: input.names.length };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "Batch processing failed",
          });
        }
      }),

    // Poll job status and progress
    status: protectedProcedure
      .input(z.object({
        jobId: z.string(),
      }))
      .query(async ({ input }) => {
        const { getJob, getBatchStatistics } = await import("./batch-processor");
        const job = getJob(input.jobId);
        if (!job) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Job not found or expired" });
        }
        return {
          jobId: job.id,
          status: job.status,
          progress: job.progress,
          total: job.total,
          processed: job.processed,
          results: job.status === 'done' ? job.results : [],
          stats: job.status === 'done' ? getBatchStatistics(job.results) : null,
          error: job.error,
        };
      }),

    // Legacy sync process (kept for backward compatibility)
    process: protectedProcedure
      .input(z.object({
        names: z.array(z.string()).min(1).max(100),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const batchItems = input.names.map(name => ({ name }));
          const results = await processBatch(batchItems);
          const stats = getBatchStatistics(results);

          await createAuditLog({
            userId: ctx.user.id,
            companyId: ctx.user.companyId ?? undefined,
            userName: ctx.user.name ?? undefined,
            action: "search",
            query: `batch:${input.names.length}:names`,
            resultsCount: results.filter((r: any) => r.status === 'MATCH').length,
          });

          return { results, stats };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "Batch processing failed",
          });
        }
      }),
  }),

  // ─── Export ────────────────────────────────────────────────────────────────
  export: router({
    logExport: protectedProcedure
      .input(z.object({
        query: z.string(),
        format: z.enum(["pdf", "excel", "json"]),
        count: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        await createAuditLog({
          userId: ctx.user.id,
          companyId: ctx.user.companyId ?? undefined,
          userName: ctx.user.name ?? undefined,
          action: "export",
          query: input.query,
          exportFormat: input.format,
          resultsCount: input.count,
        });
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
