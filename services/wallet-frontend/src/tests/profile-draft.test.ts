import { describe, it, expect } from "vitest";
import {
	DraftPersonalDataSchema,
	PersonalDataSchema,
	DraftProfileUpdatePayloadSchema,
} from "../schemas/profile.schema";
import { sanitizeDraftPayload } from "../utils/transform";

describe("Profile Draft Schemas & Composition", () => {
	describe("DraftPersonalDataSchema vs PersonalDataSchema", () => {
		it("DraftPersonalDataSchema allows empty strings as null, and allows nulls/options", () => {
			const payload = {
				firstName: null,
				lastName: null,
				placeOfBirth: "",
			};
			// Cleans empty string to null
			const sanitized = sanitizeDraftPayload(payload) as Record<
				string,
				unknown
			>;
			expect(sanitized.placeOfBirth).toBe(null);

			const result = DraftPersonalDataSchema.partial().safeParse(sanitized);
			expect(result.success).toBe(true);
		});

		it("PersonalDataSchema rejects nulls and empty strings for required fields", () => {
			const payload = {
				firstName: null,
				lastName: "",
				placeOfBirth: "Berlin",
			};
			const sanitized = sanitizeDraftPayload(payload) as Record<
				string,
				unknown
			>;
			const result = PersonalDataSchema.partial().safeParse(sanitized);
			expect(result.success).toBe(false);
		});

		it("DraftProfileUpdatePayloadSchema allows combined partial personal and address draft inputs", () => {
			const payload = {
				firstName: "Helmut",
				street: "",
				houseNumber: null,
			};
			const sanitized = sanitizeDraftPayload(payload) as Record<
				string,
				unknown
			>;
			const result = DraftProfileUpdatePayloadSchema.safeParse(sanitized);
			expect(result.success).toBe(true);
		});
	});

	describe("Deep Recursive Payload Sanitizer", () => {
		it("recursively maps empty strings to null, leaves valid values alone", () => {
			const rawData = {
				firstName: "Helmut",
				lastName: "",
				nested: {
					street: "",
					zipCode: "12101",
					deeper: {
						someVal: "",
					},
				},
				arrayVal: ["", "valid", { key: "" }],
			};

			const expected = {
				firstName: "Helmut",
				lastName: null,
				nested: {
					street: null,
					zipCode: "12101",
					deeper: {
						someVal: null,
					},
				},
				arrayVal: [null, "valid", { key: null }],
			};

			expect(sanitizeDraftPayload(rawData)).toEqual(expected);
		});
	});
});
