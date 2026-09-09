import { describe, expect, it } from "vitest";
import {
	AssetsBand,
	Citizenship,
	HouseholdComposition,
} from "../../schemas/benefitCheck.schema";
import {
	ageInMonths,
	ageInYears,
	assetAllowance,
	assetsVsAllowance,
	childrenUnder25,
	hasReachedRetirementAge,
	householdStandardNeeds,
	isCouple,
	minorChildren,
	residenceRequirementMet,
	totalNeeds,
} from "./derive";

const TODAY = "2026-09-09";

describe("ageInYears", () => {
	it("counts a birthday that has already passed this year", () => {
		expect(ageInYears("1990-03-15", "2026-09-09")).toBe(36);
	});

	it("does not count a birthday still ahead this year", () => {
		expect(ageInYears("1990-12-15", "2026-09-09")).toBe(35);
	});

	it("counts the birthday itself", () => {
		expect(ageInYears("1990-09-09", "2026-09-09")).toBe(36);
	});

	it("does not count the day before the birthday", () => {
		expect(ageInYears("1990-09-10", "2026-09-09")).toBe(35);
	});
});

describe("ageInMonths", () => {
	it("counts whole months only", () => {
		expect(ageInMonths("2026-01-15", "2026-09-09")).toBe(7);
		expect(ageInMonths("2026-01-09", "2026-09-09")).toBe(8);
	});
});

describe("hasReachedRetirementAge", () => {
	it("is false for someone clearly of working age", () => {
		expect(hasReachedRetirementAge("1990-01-01", "2026-09-09")).toBe(false);
	});

	it("uses 67 years for the 1964 cohort and later", () => {
		expect(hasReachedRetirementAge("1964-09-09", "2031-09-08")).toBe(false);
		expect(hasReachedRetirementAge("1964-09-09", "2031-09-09")).toBe(true);
	});

	it("uses 65 years for cohorts up to 1946", () => {
		expect(hasReachedRetirementAge("1946-06-01", "2011-05-31")).toBe(false);
		expect(hasReachedRetirementAge("1946-06-01", "2011-06-01")).toBe(true);
	});

	it("applies the staggered months for the 1959 cohort (66 years, 2 months)", () => {
		expect(hasReachedRetirementAge("1959-01-15", "2025-03-14")).toBe(false);
		expect(hasReachedRetirementAge("1959-01-15", "2025-03-15")).toBe(true);
	});
});

describe("assetAllowance", () => {
	it("staggers by age", () => {
		expect(assetAllowance(29)).toBe(5000);
		expect(assetAllowance(30)).toBe(10000);
		expect(assetAllowance(39)).toBe(10000);
		expect(assetAllowance(40)).toBe(12500);
		expect(assetAllowance(49)).toBe(12500);
		expect(assetAllowance(50)).toBe(20000);
		expect(assetAllowance(84)).toBe(20000);
	});
});

describe("assetsVsAllowance", () => {
	it("reports BELOW when the whole band is under the allowance", () => {
		expect(assetsVsAllowance(AssetsBand.UNDER_5000, 10000)).toBe("BELOW");
	});

	it("reports ABOVE when the whole band is at or over the allowance", () => {
		expect(assetsVsAllowance(AssetsBand.FROM_15000_TO_25000, 12500)).toBe(
			"ABOVE",
		);
		expect(assetsVsAllowance(AssetsBand.OVER_25000, 20000)).toBe("ABOVE");
	});

	it("reports SPANS when the band straddles the allowance", () => {
		// The domain spec's test case E: age 38 -> allowance 10000, assets 5000-15000.
		expect(assetsVsAllowance(AssetsBand.FROM_5000_TO_15000, 10000)).toBe(
			"SPANS",
		);
	});

	it("treats an allowance exactly on the upper bound as BELOW", () => {
		expect(assetsVsAllowance(AssetsBand.UNDER_5000, 5000)).toBe("BELOW");
	});

	it("treats an allowance exactly on the lower bound as ABOVE", () => {
		expect(assetsVsAllowance(AssetsBand.FROM_5000_TO_15000, 5000)).toBe(
			"ABOVE",
		);
	});
});

describe("householdStandardNeeds", () => {
	it("uses level 1 for a single adult", () => {
		expect(
			householdStandardNeeds(
				{ composition: HouseholdComposition.SINGLE, children: [] },
				TODAY,
			),
		).toBe(563);
	});

	it("uses level 2 twice for a couple", () => {
		expect(
			householdStandardNeeds(
				{ composition: HouseholdComposition.COUPLE_NO_CHILDREN, children: [] },
				TODAY,
			),
		).toBe(1012);
	});

	it("adds a level by child age band", () => {
		expect(
			householdStandardNeeds(
				{
					composition: HouseholdComposition.SINGLE_PARENT,
					children: [
						{ dateOfBirth: "2023-01-01" }, // 3 -> level 6, 357
						{ dateOfBirth: "2016-01-01" }, // 10 -> level 5, 390
						{ dateOfBirth: "2010-01-01" }, // 16 -> level 4, 471
						{ dateOfBirth: "2005-01-01" }, // 21 -> level 3, 451
					],
				},
				TODAY,
			),
		).toBe(563 + 357 + 390 + 471 + 451);
	});
});

describe("totalNeeds", () => {
	it("adds the warm rent to the standard needs", () => {
		expect(
			totalNeeds(
				{ composition: HouseholdComposition.SINGLE, children: [] },
				650,
				TODAY,
			),
		).toBe(1213);
	});
});

describe("child filters", () => {
	const household = {
		composition: HouseholdComposition.SINGLE_PARENT,
		children: [
			{ dateOfBirth: "2020-01-01" }, // 6
			{ dateOfBirth: "2008-09-09" }, // 18 exactly
			{ dateOfBirth: "2008-09-10" }, // 17
			{ dateOfBirth: "2001-09-09" }, // 25 exactly
		],
	};

	it("counts a child as a minor until the 18th birthday", () => {
		expect(minorChildren(household, TODAY)).toHaveLength(2);
	});

	it("excludes a child on their 25th birthday", () => {
		expect(childrenUnder25(household, TODAY)).toHaveLength(3);
	});
});

describe("isCouple", () => {
	it("is true for both couple compositions", () => {
		expect(isCouple(HouseholdComposition.COUPLE_NO_CHILDREN)).toBe(true);
		expect(isCouple(HouseholdComposition.COUPLE_WITH_CHILDREN)).toBe(true);
		expect(isCouple(HouseholdComposition.SINGLE)).toBe(false);
		expect(isCouple(HouseholdComposition.SINGLE_PARENT)).toBe(false);
	});
});

describe("residenceRequirementMet", () => {
	it("is met for German and EU citizens", () => {
		expect(residenceRequirementMet({ citizenship: Citizenship.DE_EU })).toBe(
			true,
		);
	});

	it("is met for non-EU citizens with a secure status", () => {
		expect(
			residenceRequirementMet({
				citizenship: Citizenship.NON_EU,
				hasSecureResidenceStatus: true,
			}),
		).toBe(true);
	});

	it("is not met for non-EU citizens without a secure status", () => {
		expect(
			residenceRequirementMet({
				citizenship: Citizenship.NON_EU,
				hasSecureResidenceStatus: false,
			}),
		).toBe(false);
	});

	it("is undefined while citizenship is unanswered", () => {
		expect(residenceRequirementMet({})).toBeUndefined();
	});

	it("is undefined while a non-EU applicant's status is unanswered", () => {
		expect(
			residenceRequirementMet({ citizenship: Citizenship.NON_EU }),
		).toBeUndefined();
	});
});
