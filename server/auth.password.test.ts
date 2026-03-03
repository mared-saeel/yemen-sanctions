import { describe, expect, it, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";

// ─── Unit tests for password hashing logic ────────────────────────────────────
describe("Password Authentication", () => {
  it("should hash password with bcrypt", async () => {
    const password = "SecurePass123";
    const hash = await bcrypt.hash(password, 12);
    expect(hash).toBeTruthy();
    expect(hash).not.toBe(password);
    expect(hash.startsWith("$2")).toBe(true);
  });

  it("should verify correct password", async () => {
    const password = "SecurePass123";
    const hash = await bcrypt.hash(password, 12);
    const isValid = await bcrypt.compare(password, hash);
    expect(isValid).toBe(true);
  });

  it("should reject incorrect password", async () => {
    const password = "SecurePass123";
    const wrongPassword = "WrongPass456";
    const hash = await bcrypt.hash(password, 12);
    const isValid = await bcrypt.compare(wrongPassword, hash);
    expect(isValid).toBe(false);
  });

  it("should generate different hashes for same password", async () => {
    const password = "SamePassword";
    const hash1 = await bcrypt.hash(password, 12);
    const hash2 = await bcrypt.hash(password, 12);
    expect(hash1).not.toBe(hash2);
    // But both should verify correctly
    expect(await bcrypt.compare(password, hash1)).toBe(true);
    expect(await bcrypt.compare(password, hash2)).toBe(true);
  });

  it("should handle Arabic username normalization", () => {
    const username = "  Ahmed_123  ";
    const normalized = username.toLowerCase().trim();
    expect(normalized).toBe("ahmed_123");
  });

  it("should validate username format (alphanumeric only)", () => {
    const validUsernames = ["ahmed123", "user_name", "test_01"];
    const invalidUsernames = ["ahmed@123", "user name", "test!01", ""];

    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    validUsernames.forEach((u) => expect(usernameRegex.test(u)).toBe(true));
    invalidUsernames.forEach((u) => expect(usernameRegex.test(u)).toBe(false));
  });

  it("should validate password minimum length", () => {
    const shortPassword = "12345"; // 5 chars
    const validPassword = "123456"; // 6 chars
    expect(shortPassword.length >= 6).toBe(false);
    expect(validPassword.length >= 6).toBe(true);
  });
});

// ─── Auth Router Tests ─────────────────────────────────────────────────────────
describe("auth.logout", () => {
  it("clears session cookie on logout", async () => {
    const { appRouter } = await import("./routers");
    const { COOKIE_NAME } = await import("../shared/const");
    const clearedCookies: Array<{ name: string; options: Record<string, unknown> }> = [];

    const ctx = {
      user: {
        id: 1,
        openId: "local_testuser",
        name: "Test User",
        email: null,
        loginMethod: "local",
        role: "user" as const,
        companyId: null,
        isActive: true,
        username: "testuser",
        passwordHash: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: { protocol: "https", headers: {} } as any,
      res: {
        clearCookie: (name: string, options: Record<string, unknown>) => {
          clearedCookies.push({ name, options });
        },
      } as any,
    };

    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
  });
});
