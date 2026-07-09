import { describe, it, expect } from "vitest";
import { PersonalDataSchema, AddressSchema } from "./profile.schema";

describe("PersonalDataSchema (Data Integrity Audit)", () => {
	it("should accept valid personal data", () => {
		const validData = {
			firstName: "Helmut",
			lastName: "Klar",
			dateOfBirth: "2000-07-12",
			placeOfBirth: "Brasil",
			legalGender: "Female",
		};
		const result = PersonalDataSchema.safeParse(validData);
		expect(result.success).toBe(true);
	});

	it("should reject invalid date format", () => {
		const invalidData = {
			firstName: "Helmut",
			lastName: "Klar",
			dateOfBirth: "12.07.2000", // Wrong format (DD.MM.YYYY)
			placeOfBirth: "Brasil",
			legalGender: "Female",
		};
		const result = PersonalDataSchema.safeParse(invalidData);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].message).toContain("Invalid date format");
		}
	});

	it("should reject non-existent dates", () => {
		const invalidData = {
			firstName: "Helmut",
			lastName: "Klar",
			dateOfBirth: "2000-02-31", // February 31st
			placeOfBirth: "Brasil",
			legalGender: "Female",
		};
		const result = PersonalDataSchema.safeParse(invalidData);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].message).toBe("Invalid date");
		}
	});

	it("should reject invalid gender enum values", () => {
		const invalidData = {
			firstName: "Helmut",
			lastName: "Klar",
			dateOfBirth: "12.07.2000",
			placeOfBirth: "Brasil",
			legalGender: "Unknown",
		};
		const result = PersonalDataSchema.safeParse(invalidData);
		expect(result.success).toBe(false);
	});

	it("should enforce 255 character limit", () => {
		const oversizedName = "A".repeat(256);
		const invalidData = {
			firstName: oversizedName,
			lastName: "Klar",
			dateOfBirth: "12.07.2000",
			placeOfBirth: "Brasil",
			legalGender: "Female",
		};
		const result = PersonalDataSchema.safeParse(invalidData);
		expect(result.success).toBe(false);
	});
});

describe("AddressSchema (Data Integrity Audit)", () => {
	it("should accept valid address with null values", () => {
		const validData = {
			street: "ohne feste Adresse",
			houseNumber: null,
			zipCode: null,
			city: null,
			state: null,
		};
		const result = AddressSchema.safeParse(validData);
		expect(result.success).toBe(true);
	});
});
