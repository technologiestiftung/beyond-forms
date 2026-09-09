import { describe, expect, it } from "vitest";
import {
	AssetsBand,
	Citizenship,
	HouseholdComposition,
	WorkCapacity,
} from "../schemas/benefitCheck.schema";
import { mapEligibilityToProfilePayload } from "./application.service";

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
