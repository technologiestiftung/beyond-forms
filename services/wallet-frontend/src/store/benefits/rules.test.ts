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
	assessSgbIiBasicIncome,
	assessSgbXiiOldAgeReducedCapacity,
	assessSgbXiiSubsistenceAid,
} from "./rules";

const TODAY = "2026-09-09";

/** A 32-year-old single whose income falls short — the domain spec's case A. */
const CASE_A: PartialBenefitCheckAnswers = {
	dateOfBirth: "1994-01-15",
	workCapacity: WorkCapacity.FULL,
	household: { composition: HouseholdComposition.SINGLE, children: [] },
	employment: { isEmployed: true, monthlyGrossIncome: 1400 },
	monthlyNetHouseholdIncome: 1100,
	monthlyWarmRent: 650,
	assetsBand: AssetsBand.UNDER_5000,
	receivesBenefitsAlready: false,
	citizenship: Citizenship.DE_EU,
	livesInBerlin: true,
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
	household: { composition: HouseholdComposition.SINGLE, children: [] },
	employment: { isEmployed: false, monthlyGrossIncome: 0 },
	monthlyNetHouseholdIncome: 950,
	monthlyWarmRent: 550,
	assetsBand: AssetsBand.FROM_5000_TO_15000,
	receivesBenefitsAlready: false,
	citizenship: Citizenship.DE_EU,
	livesInBerlin: true,
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

/** Temporarily unable to work at 45 — the domain spec's case D. The case gives no rent,
 *  so 500 is supplied here to make the needs test computable. */
const CASE_D: PartialBenefitCheckAnswers = {
	dateOfBirth: "1981-04-10",
	workCapacity: WorkCapacity.TEMPORARILY_REDUCED,
	household: { composition: HouseholdComposition.SINGLE, children: [] },
	employment: { isEmployed: false, monthlyGrossIncome: 0 },
	monthlyNetHouseholdIncome: 300,
	monthlyWarmRent: 500,
	assetsBand: AssetsBand.UNDER_5000,
	receivesBenefitsAlready: false,
	citizenship: Citizenship.DE_EU,
	livesInBerlin: true,
};

describe("assessSgbXiiSubsistenceAid", () => {
	it("is likely for case D", () => {
		const result = assessSgbXiiSubsistenceAid(CASE_D, TODAY);
		expect(result.benefit).toBe(BenefitId.SGB_XII_SUBSISTENCE_AID);
		expect(result.status).toBe(BenefitStatus.LIKELY_YES);
	});

	it("does not apply to an applicant with full work capacity", () => {
		const result = assessSgbXiiSubsistenceAid(
			{ ...CASE_D, workCapacity: WorkCapacity.FULL },
			TODAY,
		);
		expect(result.status).toBe(BenefitStatus.NOT_APPLICABLE);
		expect(result.reasons).toEqual([ReasonCode.NOT_IN_CAPACITY_GAP]);
	});

	it("does not apply to a permanently reduced applicant", () => {
		const result = assessSgbXiiSubsistenceAid(
			{ ...CASE_D, workCapacity: WorkCapacity.PERMANENTLY_REDUCED },
			TODAY,
		);
		expect(result.status).toBe(BenefitStatus.NOT_APPLICABLE);
	});

	it("does not apply once the retirement age is reached", () => {
		const result = assessSgbXiiSubsistenceAid(
			{ ...CASE_D, dateOfBirth: "1955-04-10" },
			TODAY,
		);
		expect(result.status).toBe(BenefitStatus.NOT_APPLICABLE);
	});

	/**
	 * The domain spec §6.3 has no "income covers needs" exit: once the applicant is in
	 * the capacity gap, the fallthrough is "moeglich_pruefen", never "eher_nein".
	 */
	it("advises a check rather than rejecting when income covers the needs", () => {
		const result = assessSgbXiiSubsistenceAid(
			{ ...CASE_D, monthlyNetHouseholdIncome: 3000 },
			TODAY,
		);
		expect(result.status).toBe(BenefitStatus.CHECK_ADVISED);
		expect(result.reasons).toContain(ReasonCode.CAPACITY_GAP_PRECONDITION_MET);
	});

	it("advises a check when answers are missing", () => {
		const result = assessSgbXiiSubsistenceAid({}, TODAY);
		expect(result.status).toBe(BenefitStatus.CHECK_ADVISED);
		expect(result.reasons).toEqual([ReasonCode.INSUFFICIENT_DATA]);
	});
});
