import { describe, expect, it } from "vitest";
import {
	AssetsBand,
	BenefitId,
	BenefitStatus,
	Citizenship,
	HouseholdComposition,
	ReasonCode,
	WorkCapacity,
} from "../../schemas/benefitCheck.schema";
import type { PartialBenefitCheckAnswers } from "../../schemas/benefitCheck.schema";
import {
	assessChildSupplement,
	assessHousingBenefit,
	assessSgbIiBasicIncome,
	assessSgbXiiOldAgeReducedCapacity,
} from "./rules";

const TODAY = "2026-09-09";

/** A 32-year-old single whose income falls short — the domain spec's case A. */
const CASE_A: PartialBenefitCheckAnswers = {
	dateOfBirth: "1994-01-15",
	workCapacity: WorkCapacity.FULL,
	householdComposition: HouseholdComposition.SINGLE,
	children: [],
	isEmployed: true,
	monthlyGrossIncome: 1400,
	monthlyNetHouseholdIncome: 1100,
	monthlyWarmRent: 650,
	assetsBand: AssetsBand.UNDER_5000,
	receivesBenefitsAlready: false,
	citizenship: Citizenship.DE_EU,
	livesInGermany: true,
};

describe("assessSgbIiBasicIncome", () => {
	it("is likely for case A", () => {
		const result = assessSgbIiBasicIncome(CASE_A, TODAY);
		expect(result.benefit).toBe(BenefitId.SGB_II_BASIC_INCOME);
		expect(result.status).toBe(BenefitStatus.LIKELY_YES);
		expect(result.reasons).toContain(ReasonCode.INCOME_BELOW_NEEDS);
		expect(result.reasons).toContain(ReasonCode.ASSETS_BELOW_ALLOWANCE);
	});

	it("is not applicable once the retirement age is reached", () => {
		const result = assessSgbIiBasicIncome(
			{ ...CASE_A, dateOfBirth: "1955-01-15" },
			TODAY,
		);
		expect(result.status).toBe(BenefitStatus.NOT_APPLICABLE);
		expect(result.reasons).toEqual([ReasonCode.RETIREMENT_AGE_REACHED]);
	});

	it("is not applicable when work capacity is not full", () => {
		const result = assessSgbIiBasicIncome(
			{ ...CASE_A, workCapacity: WorkCapacity.PERMANENTLY_REDUCED },
			TODAY,
		);
		expect(result.status).toBe(BenefitStatus.NOT_APPLICABLE);
		expect(result.reasons).toEqual([ReasonCode.WORK_CAPACITY_NOT_FULL]);
	});

	it("is doubtful when the residence status is not secure", () => {
		const result = assessSgbIiBasicIncome(
			{
				...CASE_A,
				citizenship: Citizenship.NON_EU,
				hasSecureResidenceStatus: false,
			},
			TODAY,
		);
		expect(result.status).toBe(BenefitStatus.LIKELY_NO);
		expect(result.reasons).toEqual([ReasonCode.RESIDENCE_STATUS_UNCLEAR]);
	});

	it("is likely when benefits are already being received", () => {
		const result = assessSgbIiBasicIncome(
			{ ...CASE_A, receivesBenefitsAlready: true },
			TODAY,
		);
		expect(result.status).toBe(BenefitStatus.LIKELY_YES);
		expect(result.reasons).toEqual([ReasonCode.ALREADY_RECEIVING_BENEFITS]);
	});

	it("is unlikely when income covers the needs", () => {
		const result = assessSgbIiBasicIncome(
			{ ...CASE_A, monthlyNetHouseholdIncome: 2500 },
			TODAY,
		);
		expect(result.status).toBe(BenefitStatus.LIKELY_NO);
		expect(result.reasons).toEqual([ReasonCode.INCOME_COVERS_NEEDS]);
	});

	it("advises a check when the asset band straddles the allowance", () => {
		// Case E: 38 years old -> allowance 10000, band 5000-15000.
		const result = assessSgbIiBasicIncome(
			{
				...CASE_A,
				dateOfBirth: "1988-01-15",
				assetsBand: AssetsBand.FROM_5000_TO_15000,
			},
			TODAY,
		);
		expect(result.status).toBe(BenefitStatus.CHECK_ADVISED);
		expect(result.reasons).toContain(ReasonCode.ASSETS_SPAN_ALLOWANCE);
	});

	it("advises a check for a couple above the single allowance, whose own is unknown", () => {
		const result = assessSgbIiBasicIncome(
			{
				...CASE_A,
				householdComposition: HouseholdComposition.COUPLE_NO_CHILDREN,
				monthlyNetHouseholdIncome: 800,
				assetsBand: AssetsBand.OVER_25000,
			},
			TODAY,
		);
		expect(result.status).toBe(BenefitStatus.CHECK_ADVISED);
		expect(result.reasons).toContain(ReasonCode.COUPLE_ASSET_ALLOWANCE_UNKNOWN);
	});

	it("still says likely for a couple below even the single allowance", () => {
		const result = assessSgbIiBasicIncome(
			{
				...CASE_A,
				householdComposition: HouseholdComposition.COUPLE_NO_CHILDREN,
				monthlyNetHouseholdIncome: 800,
				assetsBand: AssetsBand.UNDER_5000,
			},
			TODAY,
		);
		expect(result.status).toBe(BenefitStatus.LIKELY_YES);
		expect(result.reasons).toContain(ReasonCode.ASSETS_BELOW_ALLOWANCE);
	});

	it("is unlikely when assets are clearly above the allowance", () => {
		const result = assessSgbIiBasicIncome(
			{ ...CASE_A, assetsBand: AssetsBand.OVER_25000 },
			TODAY,
		);
		expect(result.status).toBe(BenefitStatus.LIKELY_NO);
		expect(result.reasons).toEqual([ReasonCode.ASSETS_ABOVE_ALLOWANCE]);
	});

	it("advises a check rather than rejecting when answers are missing", () => {
		const result = assessSgbIiBasicIncome({}, TODAY);
		expect(result.status).toBe(BenefitStatus.CHECK_ADVISED);
		expect(result.reasons).toEqual([ReasonCode.INSUFFICIENT_DATA]);
	});

	it("advises a check when only the asset band is missing", () => {
		const { assetsBand: _dropped, ...withoutAssets } = CASE_A;
		const result = assessSgbIiBasicIncome(withoutAssets, TODAY);
		expect(result.status).toBe(BenefitStatus.CHECK_ADVISED);
		expect(result.reasons).toEqual([ReasonCode.INSUFFICIENT_DATA]);
	});
});

/** A 71-year-old on a small pension — the domain spec's case B. */
const CASE_B: PartialBenefitCheckAnswers = {
	dateOfBirth: "1955-03-20",
	householdComposition: HouseholdComposition.SINGLE,
	children: [],
	isEmployed: false,
	monthlyGrossIncome: 0,
	monthlyNetHouseholdIncome: 950,
	monthlyWarmRent: 550,
	assetsBand: AssetsBand.FROM_5000_TO_15000,
	receivesBenefitsAlready: false,
	citizenship: Citizenship.DE_EU,
	livesInGermany: true,
};

describe("assessSgbXiiOldAgeReducedCapacity", () => {
	it("is likely for case B", () => {
		const result = assessSgbXiiOldAgeReducedCapacity(CASE_B, TODAY);
		expect(result.benefit).toBe(BenefitId.SGB_XII_OLD_AGE_REDUCED_CAPACITY);
		expect(result.status).toBe(BenefitStatus.LIKELY_YES);
		expect(result.reasons).toContain(ReasonCode.ASSETS_BELOW_ALLOWANCE);
	});

	it("applies below the retirement age when capacity is permanently reduced", () => {
		const result = assessSgbXiiOldAgeReducedCapacity(
			{
				...CASE_B,
				dateOfBirth: "1981-03-20", // 45 -> allowance 12500
				workCapacity: WorkCapacity.PERMANENTLY_REDUCED,
				// Case B's band (5000-15000) would straddle the allowance at this age and
				// yield CHECK_ADVISED. This test is about the applicability gate, not the
				// means test, so the band is unambiguous here.
				assetsBand: AssetsBand.UNDER_5000,
			},
			TODAY,
		);
		expect(result.status).toBe(BenefitStatus.LIKELY_YES);
	});

	it("does not apply to a working-age applicant with full capacity", () => {
		const result = assessSgbXiiOldAgeReducedCapacity(
			{
				...CASE_B,
				dateOfBirth: "1994-01-15",
				workCapacity: WorkCapacity.FULL,
			},
			TODAY,
		);
		expect(result.status).toBe(BenefitStatus.NOT_APPLICABLE);
		expect(result.reasons).toEqual([ReasonCode.RETIREMENT_AGE_NOT_REACHED]);
	});

	it("does not apply to a temporarily reduced applicant below retirement age", () => {
		const result = assessSgbXiiOldAgeReducedCapacity(
			{
				...CASE_B,
				dateOfBirth: "1981-03-20",
				workCapacity: WorkCapacity.TEMPORARILY_REDUCED,
			},
			TODAY,
		);
		expect(result.status).toBe(BenefitStatus.NOT_APPLICABLE);
	});

	it("does not apply below 18", () => {
		const result = assessSgbXiiOldAgeReducedCapacity(
			{
				...CASE_B,
				dateOfBirth: "2012-03-20",
				workCapacity: WorkCapacity.PERMANENTLY_REDUCED,
			},
			TODAY,
		);
		expect(result.status).toBe(BenefitStatus.NOT_APPLICABLE);
	});

	it("advises a check when answers are missing", () => {
		const result = assessSgbXiiOldAgeReducedCapacity({}, TODAY);
		expect(result.status).toBe(BenefitStatus.CHECK_ADVISED);
		expect(result.reasons).toEqual([ReasonCode.INSUFFICIENT_DATA]);
	});
});

describe("assessHousingBenefit", () => {
	/** Income covers subsistence, rent burden 700/1900 = 0.37. */
	const RENT_BURDENED: PartialBenefitCheckAnswers = {
		dateOfBirth: "1994-01-15",
		householdComposition: HouseholdComposition.SINGLE,
		children: [],
		monthlyNetHouseholdIncome: 1900,
		monthlyWarmRent: 700,
		receivesBenefitsAlready: false,
		citizenship: Citizenship.DE_EU,
	};

	it("advises a check when income suffices but rent is heavy", () => {
		const result = assessHousingBenefit(RENT_BURDENED, TODAY);
		expect(result.benefit).toBe(BenefitId.HOUSING_BENEFIT);
		expect(result.status).toBe(BenefitStatus.CHECK_ADVISED);
		expect(result.reasons).toEqual([ReasonCode.RENT_BURDEN_HIGH]);
	});

	it("does not apply while other benefits are received", () => {
		const result = assessHousingBenefit(
			{ ...RENT_BURDENED, receivesBenefitsAlready: true },
			TODAY,
		);
		expect(result.status).toBe(BenefitStatus.NOT_APPLICABLE);
		expect(result.reasons).toEqual([ReasonCode.BENEFITS_TAKE_PRECEDENCE]);
	});

	it("is unlikely when income does not even cover subsistence", () => {
		const result = assessHousingBenefit(
			{ ...RENT_BURDENED, monthlyNetHouseholdIncome: 400 },
			TODAY,
		);
		expect(result.status).toBe(BenefitStatus.LIKELY_NO);
		expect(result.reasons).toEqual([ReasonCode.INCOME_BELOW_SUBSISTENCE]);
	});

	it("is unlikely when the rent burden is unremarkable", () => {
		const result = assessHousingBenefit(
			{ ...RENT_BURDENED, monthlyWarmRent: 400 },
			TODAY,
		);
		expect(result.status).toBe(BenefitStatus.LIKELY_NO);
		expect(result.reasons).toEqual([ReasonCode.RENT_BURDEN_NORMAL]);
	});

	it("advises a check when answers are missing", () => {
		const result = assessHousingBenefit({}, TODAY);
		expect(result.status).toBe(BenefitStatus.CHECK_ADVISED);
		expect(result.reasons).toEqual([ReasonCode.INSUFFICIENT_DATA]);
	});
});

/** Single parent, one child of 6, gross 1400 — the domain spec's case C. */
const CASE_C: PartialBenefitCheckAnswers = {
	dateOfBirth: "1997-05-02",
	workCapacity: WorkCapacity.FULL,
	householdComposition: HouseholdComposition.SINGLE_PARENT,
	children: [{ dateOfBirth: "2020-02-11" }],
	isEmployed: true,
	monthlyGrossIncome: 1400,
	monthlyNetHouseholdIncome: 1900,
	monthlyWarmRent: 700,
	assetsBand: AssetsBand.UNDER_5000,
	receivesBenefitsAlready: false,
	citizenship: Citizenship.DE_EU,
	livesInGermany: true,
};

describe("assessChildSupplement", () => {
	it("advises a check for case C", () => {
		const result = assessChildSupplement(CASE_C, TODAY);
		expect(result.benefit).toBe(BenefitId.CHILD_SUPPLEMENT);
		expect(result.status).toBe(BenefitStatus.CHECK_ADVISED);
		expect(result.reasons).toEqual([ReasonCode.KIZ_MIN_INCOME_MET]);
	});

	it("does not apply without children", () => {
		const result = assessChildSupplement(
			{
				...CASE_C,
				householdComposition: HouseholdComposition.SINGLE,
				children: [],
			},
			TODAY,
		);
		expect(result.status).toBe(BenefitStatus.NOT_APPLICABLE);
		expect(result.reasons).toEqual([ReasonCode.NO_ELIGIBLE_CHILDREN]);
	});

	/**
	 * Corrects an error in the domain spec §6.5, which requires ALL children to be under
	 * 25 and therefore drops a household that also has an older child.
	 */
	it("still applies when one child is over 25 and another is not", () => {
		const result = assessChildSupplement(
			{
				...CASE_C,
				householdComposition: HouseholdComposition.SINGLE_PARENT,
				children: [
					{ dateOfBirth: "1999-01-01" }, // 27
					{ dateOfBirth: "2021-01-01" }, // 5
				],
			},
			TODAY,
		);
		expect(result.status).not.toBe(BenefitStatus.NOT_APPLICABLE);
	});

	it("does not apply when every child is 25 or older", () => {
		const result = assessChildSupplement(
			{
				...CASE_C,
				householdComposition: HouseholdComposition.SINGLE_PARENT,
				children: [{ dateOfBirth: "1999-01-01" }],
			},
			TODAY,
		);
		expect(result.status).toBe(BenefitStatus.NOT_APPLICABLE);
	});

	it("does not apply while other benefits are received", () => {
		const result = assessChildSupplement(
			{ ...CASE_C, receivesBenefitsAlready: true },
			TODAY,
		);
		expect(result.status).toBe(BenefitStatus.NOT_APPLICABLE);
		expect(result.reasons).toEqual([ReasonCode.BENEFITS_TAKE_PRECEDENCE]);
	});

	it("is unlikely below the minimum gross income for a single parent", () => {
		const result = assessChildSupplement(
			{
				...CASE_C,
				isEmployed: true,
				monthlyGrossIncome: 500,
			},
			TODAY,
		);
		expect(result.status).toBe(BenefitStatus.LIKELY_NO);
		expect(result.reasons).toEqual([ReasonCode.KIZ_MIN_INCOME_NOT_MET]);
	});

	it("applies the higher minimum to a couple's combined gross income", () => {
		const couple: PartialBenefitCheckAnswers = {
			...CASE_C,
			householdComposition: HouseholdComposition.COUPLE_WITH_CHILDREN,
			children: [{ dateOfBirth: "2020-02-11" }],
			isEmployed: true,
			monthlyGrossIncome: 700,
			partnerMonthlyGrossIncome: 100,
		};
		// 800 together, under the 900 a couple needs — though it would clear a single's 600.
		expect(assessChildSupplement(couple, TODAY).status).toBe(
			BenefitStatus.LIKELY_NO,
		);
		expect(
			assessChildSupplement(
				{ ...couple, partnerMonthlyGrossIncome: 300 },
				TODAY,
			).status,
		).toBe(BenefitStatus.CHECK_ADVISED);
	});

	it("waits for the partner's gross income before judging a couple", () => {
		const couple: PartialBenefitCheckAnswers = {
			...CASE_C,
			householdComposition: HouseholdComposition.COUPLE_WITH_CHILDREN,
			children: [{ dateOfBirth: "2020-02-11" }],
			monthlyGrossIncome: 1400,
		};
		const result = assessChildSupplement(couple, TODAY);
		expect(result.status).toBe(BenefitStatus.CHECK_ADVISED);
		expect(result.reasons).toEqual([ReasonCode.INSUFFICIENT_DATA]);
	});

	it("advises a check when answers are missing", () => {
		const result = assessChildSupplement({}, TODAY);
		expect(result.status).toBe(BenefitStatus.CHECK_ADVISED);
		expect(result.reasons).toEqual([ReasonCode.INSUFFICIENT_DATA]);
	});
});

describe("children guards after flattening", () => {
	it("child supplement is not applicable for a definitively childless household", () => {
		const result = assessChildSupplement(
			{ ...CASE_C, householdComposition: HouseholdComposition.SINGLE },
			TODAY,
		);
		expect(result.status).toBe(BenefitStatus.NOT_APPLICABLE);
		expect(result.reasons).toEqual([ReasonCode.NO_ELIGIBLE_CHILDREN]);
	});

	it("child supplement advises a check while the children list is unanswered", () => {
		const { children: _dropped, ...withoutChildren } = CASE_C;
		const result = assessChildSupplement(withoutChildren, TODAY);
		expect(result.status).toBe(BenefitStatus.CHECK_ADVISED);
		expect(result.reasons).toEqual([ReasonCode.INSUFFICIENT_DATA]);
	});
});
