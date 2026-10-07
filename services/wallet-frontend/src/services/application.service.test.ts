import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
	applicationService,
	mapEligibilityToProfilePayload,
} from "./application.service";
import {
	Binary,
	Citizenship,
	WorkCapacity,
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
		it("maps a non-EU citizen with a secure residence permit", () => {
			const payload = mapEligibilityToProfilePayload({
				citizenship: Citizenship.NON_EU,
				hasSecureResidenceStatus: Binary.YES,
			});
			expect(payload).toEqual({
				is_german_citizen: false,
				residence_status: "Other",
			});
		});

		it("does not guess German citizenship from DE/EU", () => {
			const payload = mapEligibilityToProfilePayload({
				citizenship: Citizenship.DE_EU,
			});
			expect(payload).toEqual({});
		});

		it("maps permanently reduced work capacity", () => {
			const payload = mapEligibilityToProfilePayload({
				workCapacity: WorkCapacity.PERMANENTLY_REDUCED,
			});
			expect(payload).toEqual({
				ability_to_work: "Permanently disabled",
				has_permanent_reduction_in_earning_capacity: true,
			});
		});

		it("maps full work capacity", () => {
			const payload = mapEligibilityToProfilePayload({
				workCapacity: WorkCapacity.FULL,
			});
			expect(payload).toEqual({ ability_to_work: "Fully able" });
		});
	});

	describe("syncGuestData", () => {
		it("sends mapped payload to profile endpoint", async () => {
			const answers = {
				dateOfBirth: "1960-01-01",
				livesInGermany: Binary.YES,
				citizenship: Citizenship.NON_EU,
				hasSecureResidenceStatus: Binary.YES,
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
						is_german_citizen: false,
						residence_status: "Other",
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
