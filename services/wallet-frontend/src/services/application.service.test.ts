import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	AssetsBand,
	Citizenship,
	HouseholdComposition,
	WorkCapacity,
} from "../schemas/benefitCheck.schema";
import type { PartialBenefitCheckAnswers } from "../schemas/benefitCheck.schema";
import {
	applicationService,
	mapEligibilityToProfilePayload,
} from "./application.service";

/**
 * env.config parses import.meta.env once at module scope, and vitest.setup.ts stubs
 * VITE_USE_MOCKS=true before any module loads — so syncGuestData would return before it
 * ever fetches. vi.stubEnv cannot undo that after the fact; the module has to be mocked.
 */
vi.mock("../config/env.config", () => ({
	env: {
		VITE_API_URL: "/api",
		VITE_AUTH_URL: "/auth-proxy",
		VITE_USE_MOCKS: false,
		VITE_USE_MOCK_AUTH: false,
		VITE_BYPASS_AUTH: false,
	},
}));

describe("mapEligibilityToProfilePayload", () => {
	it("is empty for an empty answer set", () => {
		expect(mapEligibilityToProfilePayload({})).toEqual({});
	});

	it("maps the date of birth straight through", () => {
		expect(
			mapEligibilityToProfilePayload({ dateOfBirth: "1994-01-15" }),
		).toEqual({ date_of_birth: "1994-01-15" });
	});

	it("maps residence in Germany to a boolean", () => {
		expect(mapEligibilityToProfilePayload({ livesInGermany: true })).toEqual({
			is_resident_in_germany: true,
		});
	});

	it("maps EU citizenship onto the three profile fields", () => {
		expect(
			mapEligibilityToProfilePayload({ citizenship: Citizenship.DE_EU }),
		).toEqual({
			is_german_citizen: true,
			nationality: "DE",
			residence_status: "Citizen",
		});
	});

	it("maps non-EU citizenship with secure status", () => {
		expect(
			mapEligibilityToProfilePayload({
				citizenship: Citizenship.NON_EU,
				hasSecureResidenceStatus: true,
			}),
		).toEqual({
			is_german_citizen: false,
			residence_status: "PermanentResident",
		});
	});

	it("maps work capacity onto ability_to_work", () => {
		expect(
			mapEligibilityToProfilePayload({
				workCapacity: WorkCapacity.PERMANENTLY_REDUCED,
			}),
		).toEqual({
			ability_to_work: "Permanently disabled",
			has_permanent_reduction_in_earning_capacity: true,
		});
		expect(
			mapEligibilityToProfilePayload({ workCapacity: WorkCapacity.FULL }),
		).toEqual({ ability_to_work: "Fully able" });
	});

	it("maps the asset band onto the has_assets boolean", () => {
		expect(
			mapEligibilityToProfilePayload({ assetsBand: AssetsBand.UNDER_5000 }),
		).toEqual({ has_assets: false });
		expect(
			mapEligibilityToProfilePayload({
				assetsBand: AssetsBand.FROM_5000_TO_15000,
			}),
		).toEqual({ has_assets: true });
	});

	it("maps the household composition onto marital status and head count", () => {
		expect(
			mapEligibilityToProfilePayload({
				householdComposition: HouseholdComposition.SINGLE,
				children: [],
			}),
		).toEqual({ marital_status: "Single", persons_in_household_count: 1 });
	});

	it("counts children into the household size", () => {
		expect(
			mapEligibilityToProfilePayload({
				householdComposition: HouseholdComposition.COUPLE_WITH_CHILDREN,
				children: [{ dateOfBirth: "2019-04-02" }],
			}),
		).toEqual({ marital_status: "Cohabiting", persons_in_household_count: 3 });
	});

	it("maps the net household income", () => {
		expect(
			mapEligibilityToProfilePayload({ monthlyNetHouseholdIncome: 1100 }),
		).toEqual({ monthly_income: 1100 });
	});

	it("does not send the fields the profile schema has no column for", () => {
		const payload = mapEligibilityToProfilePayload({
			monthlyGrossIncome: 1400,
			assetsBand: AssetsBand.OVER_25000,
			childReceivesFullSupport: false,
			monthsWithoutChildSupport: 8,
			monthlyWarmRent: 650,
		});
		expect(payload).not.toHaveProperty("monthly_gross_income");
		expect(payload).not.toHaveProperty("assets_band");
		expect(payload).not.toHaveProperty("child_receives_full_support");
		expect(payload).not.toHaveProperty("months_without_child_support");
		expect(payload).not.toHaveProperty("rent_total");
	});
});

describe("syncGuestData: children", () => {
	const CHILD_ANSWERS: PartialBenefitCheckAnswers = {
		householdComposition: HouseholdComposition.SINGLE_PARENT,
		children: [{ dateOfBirth: "2020-02-11" }],
	};

	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		fetchMock = vi.fn();
		// authenticatedFetch wraps the global fetch and reads the auth store for a
		// bearer token; stubbing fetch is the right level and needs no token.
		vi.stubGlobal("fetch", fetchMock);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	const jsonResponse = (body: unknown) =>
		Promise.resolve({
			ok: true,
			status: 200,
			json: () => Promise.resolve(body),
		} as Response);

	const bodyOfLastPost = (): Record<string, unknown> => {
		const post = fetchMock.mock.calls.find(
			(call) => (call[1] as Parameters<typeof fetch>[1])?.method === "POST",
		);
		const init = post?.[1] as Parameters<typeof fetch>[1];
		if (!init?.body) {
			throw new Error("no POST with a body was made");
		}
		return JSON.parse(init.body as string);
	};

	it("merges the children into the existing collection", async () => {
		fetchMock
			.mockImplementationOnce(() =>
				jsonResponse({
					associated_persons: [
						{
							association_type: "Spouse",
							first_name: "Ingrid",
							sort_order: 0,
							lives_in_household: true,
						},
					],
				}),
			)
			.mockImplementationOnce(() => jsonResponse({}));

		await applicationService.syncGuestData(CHILD_ANSWERS);

		const persons = bodyOfLastPost().associated_persons as Array<
			Record<string, unknown>
		>;
		expect(persons).toHaveLength(2);
		expect(persons[0].first_name).toBe("Ingrid");
		expect(persons[1].association_type).toBe("Child");
	});

	it("still sends everything else when the profile cannot be read", async () => {
		fetchMock
			.mockImplementationOnce(() => Promise.reject(new Error("offline")))
			.mockImplementationOnce(() => jsonResponse({}));

		const result = await applicationService.syncGuestData({
			...CHILD_ANSWERS,
			dateOfBirth: "1997-05-02",
		});

		expect(result.success).toBe(true);
		const body = bodyOfLastPost();
		expect(body).not.toHaveProperty("associated_persons");
		expect(body.date_of_birth).toBe("1997-05-02");
	});

	/**
	 * The questionnaire writes `children: []` by itself when the household is childless,
	 * so a merge here would let "I live alone" delete someone's children.
	 */
	it("never reads or writes the collection for a childless household", async () => {
		fetchMock.mockImplementation(() => jsonResponse({}));

		await applicationService.syncGuestData({
			householdComposition: HouseholdComposition.SINGLE,
			children: [],
		});

		expect(
			fetchMock.mock.calls.filter(
				(call) => (call[1] as Parameters<typeof fetch>[1])?.method !== "POST",
			),
		).toHaveLength(0);
		expect(bodyOfLastPost()).not.toHaveProperty("associated_persons");
	});
});
