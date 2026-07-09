import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
	applicationService,
	mapEligibilityToProfilePayload,
} from "./application.service";
import {
	Binary,
	NationalityStatus,
	PensionStatus,
} from "../schemas/eligibility.schema";
import { env } from "../config/env.config";

describe("applicationService: Guest Data Sync", () => {
	let originalMocks: boolean;
	let originalMockAuth: boolean;

	beforeEach(() => {
		originalMocks = env.VITE_USE_MOCKS;
		originalMockAuth = env.VITE_USE_MOCK_AUTH;
		env.VITE_USE_MOCKS = false;
		env.VITE_USE_MOCK_AUTH = false;

		vi.stubGlobal(
			"fetch",
			vi.fn().mockImplementation(() => {
				return Promise.resolve({
					ok: true,
					status: 200,
					json: () => Promise.resolve({ status: "success" }),
				});
			}),
		);
	});

	afterEach(() => {
		env.VITE_USE_MOCKS = originalMocks;
		env.VITE_USE_MOCK_AUTH = originalMockAuth;
		vi.unstubAllGlobals();
	});

	describe("mapEligibilityToProfilePayload", () => {
		it("maps nationality German to correct profile flags", () => {
			const payload = mapEligibilityToProfilePayload({
				nationality: NationalityStatus.GERMAN,
			});
			expect(payload).toEqual({
				is_german_citizen: true,
				nationality: "DE",
				residence_status: "Citizen",
			});
		});

		it("maps nationality EU_5_PLUS to PermanentResident", () => {
			const payload = mapEligibilityToProfilePayload({
				nationality: NationalityStatus.EU_5_PLUS,
			});
			expect(payload).toEqual({
				is_german_citizen: false,
				nationality: "EU",
				residence_status: "PermanentResident",
			});
		});

		it("maps nationality RESIDENCE_PERMIT to Other", () => {
			const payload = mapEligibilityToProfilePayload({
				nationality: NationalityStatus.RESIDENCE_PERMIT,
			});
			expect(payload).toEqual({
				is_german_citizen: false,
				residence_status: "Other",
			});
		});

		it("maps old age pension to income source", () => {
			const payload = mapEligibilityToProfilePayload({
				pension: PensionStatus.OLD_AGE,
			});
			expect(payload).toEqual({
				income_sources: ["Altersrente"],
			});
		});

		it("maps reduced earning capacity pension to income source and work capability status", () => {
			const payload = mapEligibilityToProfilePayload({
				pension: PensionStatus.REDUCED_EARNING_CAPACITY,
			});
			expect(payload).toEqual({
				income_sources: ["Erwerbsminderungsrente"],
				ability_to_work: "Permanently disabled",
				has_permanent_reduction_in_earning_capacity: true,
			});
		});

		it("maps assets above threshold correctly", () => {
			const payload = mapEligibilityToProfilePayload({
				hasAssetsAboveThreshold: Binary.YES,
			});
			expect(payload).toEqual({
				has_assets: true,
			});
		});
	});

	describe("syncGuestData", () => {
		it("sends mapped payload to profile endpoint", async () => {
			const answers = {
				dateOfBirth: "1960-01-01",
				livesInGermany: Binary.YES,
				nationality: NationalityStatus.GERMAN,
			};

			const result = await applicationService.syncGuestData(answers);
			expect(result.success).toBe(true);

			expect(fetch).toHaveBeenCalledWith(
				`${env.VITE_API_URL}/profile`,
				expect.objectContaining({
					method: "POST",
					body: JSON.stringify({
						date_of_birth: "1960-01-01",
						is_resident_in_germany: true,
						is_german_citizen: true,
						nationality: "DE",
						residence_status: "Citizen",
					}),
				}),
			);
		});

		it("skips post request if mapped payload is empty", async () => {
			const result = await applicationService.syncGuestData({});
			expect(result.success).toBe(true);
			expect(fetch).not.toHaveBeenCalled();
		});
	});
});
