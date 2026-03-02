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
} from "./db";
import { searchSanctions, aiEnhancedSearch, getRecordById, getFilterOptions } from "./search-engine";
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
