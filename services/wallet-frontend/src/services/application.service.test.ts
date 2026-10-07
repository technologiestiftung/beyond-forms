import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
	applicationService,
	mapEligibilityToProfilePayload,
} from "./application.service";
import {
	AssetsBand,
	Binary,
	Citizenship,
	HouseholdComposition,
	WorkCapacity,
} from "../schemas/eligibility.schema";
import type { EligibilityCheck } from "../schemas/eligibility.schema";
import { env } from "../config/env.config";

const completed: Partial<EligibilityCheck> = {
	householdComposition: HouseholdComposition.SINGLE,
	dateOfBirth: "1990-05-01",
	livesInGermany: Binary.YES,
	isEmployed: Binary.NO,
	workCapacity: WorkCapacity.FULL,
	monthlyNetHouseholdIncome: 300,
	monthlyWarmRent: 600,
	assetsBand: AssetsBand.FROM_5000_TO_10000,
	receivesBenefits: Binary.NO,
	citizenship: Citizenship.EU,
};

const baseline = {
	date_of_birth: "1990-05-01",
	is_resident_in_germany: true,
	is_german_citizen: false,
	nationality: "EU",
	ability_to_work: "Fully able",
	has_assets: false,
};

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
		it("maps an EU citizen without guessing a residence status", () => {
			expect(mapEligibilityToProfilePayload(completed)).toEqual(baseline);
		});

		it("maps German citizenship", () => {
			const payload = mapEligibilityToProfilePayload({
				...completed,
				citizenship: Citizenship.GERMAN,
			});
			expect(payload).toEqual({
				...baseline,
				is_german_citizen: true,
				nationality: "DE",
				residence_status: "Citizen",
			});
		});

		it("maps a non-EU citizen with a secure residence permit", () => {
			const payload = mapEligibilityToProfilePayload({
				...completed,
				citizenship: Citizenship.NON_EU,
				hasSecureResidenceStatus: Binary.YES,
			});
			expect(payload).toEqual({
				...baseline,
				nationality: undefined,
				residence_status: "Other",
			});
		});

		it("maps permanently reduced work capacity", () => {
			const payload = mapEligibilityToProfilePayload({
				...completed,
				workCapacity: WorkCapacity.PERMANENTLY_REDUCED,
			});
			expect(payload).toEqual({
				...baseline,
				ability_to_work: "Permanently disabled",
				has_permanent_reduction_in_earning_capacity: true,
			});
		});

		it("does not sync a work capacity the path skipped", () => {
			const payload = mapEligibilityToProfilePayload({
				...completed,
				dateOfBirth: "1950-01-01",
				workCapacity: WorkCapacity.PERMANENTLY_REDUCED,
			});
			expect(payload).toEqual({
				date_of_birth: "1950-01-01",
				is_resident_in_germany: true,
				has_assets: false,
				is_german_citizen: false,
				nationality: "EU",
			});
		});

		it("maps savings bands to the 10,000 € question", () => {
			expect(
				mapEligibilityToProfilePayload({
					...completed,
					assetsBand: AssetsBand.FROM_5000_TO_10000,
				}).has_assets,
			).toBe(false);
			expect(
				mapEligibilityToProfilePayload({
					...completed,
					assetsBand: AssetsBand.FROM_10000_TO_12500,
				}).has_assets,
			).toBe(true);
		});
	});

	describe("syncGuestData", () => {
		it("sends mapped payload to profile endpoint", async () => {
			const result = await applicationService.syncGuestData(completed);
			expect(result.success).toBe(true);

			expect(fetch).toHaveBeenCalledWith(
				`${env.VITE_API_URL}/profile`,
				expect.objectContaining({
					method: "POST",
					body: JSON.stringify(baseline),
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
