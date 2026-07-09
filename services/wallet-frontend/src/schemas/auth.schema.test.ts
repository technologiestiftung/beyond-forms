import { describe, it, expect } from "vitest";
import { PhoneNumberSchema, OTPSchema } from "./auth.schema";

describe("Auth Schemas (Inclusivity & Security)", () => {
	describe("PhoneNumberSchema", () => {
		it("should validate valid German numbers", () => {
			expect(PhoneNumberSchema.safeParse("+4917612345678").success).toBe(true);
			expect(PhoneNumberSchema.safeParse("4917612345678").success).toBe(true);
		});

		it("should validate valid international numbers", () => {
			expect(PhoneNumberSchema.safeParse("+15551234567").success).toBe(true);
			expect(PhoneNumberSchema.safeParse("+380671234567").success).toBe(true);
		});

		it("should reject invalid formats", () => {
			expect(PhoneNumberSchema.safeParse("017612345678").success).toBe(false);
			expect(PhoneNumberSchema.safeParse("+A123456789").success).toBe(false);
			expect(PhoneNumberSchema.safeParse("123").success).toBe(false);
		});
	});

	describe("OTPSchema", () => {
		it("should validate exactly 6 digits", () => {
			expect(OTPSchema.safeParse("123456").success).toBe(true);
		});

		it("should reject non-digit characters", () => {
			expect(OTPSchema.safeParse("12345A").success).toBe(false);
		});

		it("should reject incorrect lengths", () => {
			expect(OTPSchema.safeParse("12345").success).toBe(false);
			expect(OTPSchema.safeParse("1234567").success).toBe(false);
		});
	});
});
