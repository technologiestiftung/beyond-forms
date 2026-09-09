import { describe, expect, it } from "vitest";
import {
	AssetsBand,
	BenefitId,
	BenefitStatus,
	Citizenship,
	HintCode,
	HouseholdComposition,
	WorkCapacity,
} from "../../schemas/benefitCheck.schema";
import type { PartialBenefitCheckAnswers } from "../../schemas/benefitCheck.schema";
import { evaluateBenefitCheck } from "./evaluate";

const TODAY = "2026-09-09";

const CASE_C: PartialBenefitCheckAnswers = {
	dateOfBirth: "1997-05-02",
	workCapacity: WorkCapacity.FULL,
	household: {
		composition: HouseholdComposition.SINGLE_PARENT,
		children: [{ dateOfBirth: "2020-02-11" }],
	},
	employment: { isEmployed: true, monthlyGrossIncome: 1400 },
	monthlyNetHouseholdIncome: 1900,
	monthlyWarmRent: 700,
	assetsBand: AssetsBand.UNDER_5000,
	receivesBenefitsAlready: false,
	citizenship: Citizenship.DE_EU,
	childSupport: { receivesFullSupport: false, monthsWithoutSupport: 8 },
	livesInBerlin: true,
};

describe("evaluateBenefitCheck", () => {
	it("always returns all six benefits in a stable order", () => {
		const result = evaluateBenefitCheck({}, TODAY);
		expect(result.assessments.map((a) => a.benefit)).toEqual([
			BenefitId.SGB_II_BASIC_INCOME,
			BenefitId.SGB_XII_OLD_AGE_REDUCED_CAPACITY,
			BenefitId.SGB_XII_SUBSISTENCE_AID,
			BenefitId.HOUSING_BENEFIT,
			BenefitId.CHILD_SUPPLEMENT,
			BenefitId.ADVANCE_MAINTENANCE,
		]);
	});

	it("never rejects on an empty answer set", () => {
		const result = evaluateBenefitCheck({}, TODAY);
		for (const assessment of result.assessments) {
			expect(assessment.status).not.toBe(BenefitStatus.LIKELY_NO);
		}
	});

	it("can return several live benefits at once", () => {
		const result = evaluateBenefitCheck(CASE_C, TODAY);
		const live = result.assessments.filter(
			(a) =>
				a.status === BenefitStatus.LIKELY_YES ||
				a.status === BenefitStatus.CHECK_ADVISED,
		);
		expect(live.map((a) => a.benefit)).toContain(BenefitId.ADVANCE_MAINTENANCE);
		expect(live.map((a) => a.benefit)).toContain(BenefitId.CHILD_SUPPLEMENT);
		expect(live.map((a) => a.benefit)).toContain(BenefitId.HOUSING_BENEFIT);
	});

	it("hints at the education package when a base benefit is live and children are present", () => {
		const result = evaluateBenefitCheck(CASE_C, TODAY);
		expect(result.hints).toContain(HintCode.EDUCATION_PARTICIPATION_PACKAGE);
	});

	it("hints at Kindergeld whenever children are present", () => {
		const result = evaluateBenefitCheck(CASE_C, TODAY);
		expect(result.hints).toContain(HintCode.CHILD_BENEFIT_PREREQUISITE);
	});

	it("omits child hints when there are no children", () => {
		const result = evaluateBenefitCheck(
			{
				...CASE_C,
				household: { composition: HouseholdComposition.SINGLE, children: [] },
			},
			TODAY,
		);
		expect(result.hints).not.toContain(HintCode.CHILD_BENEFIT_PREREQUISITE);
		expect(result.hints).not.toContain(
			HintCode.EDUCATION_PARTICIPATION_PACKAGE,
		);
	});

	it("refers to asylum benefits when the residence status is not secure", () => {
		const result = evaluateBenefitCheck(
			{
				...CASE_C,
				citizenship: Citizenship.NON_EU,
				hasSecureResidenceStatus: false,
			},
			TODAY,
		);
		expect(result.hints).toContain(HintCode.ASYLUM_BENEFITS_REFERRAL);
	});

	it("does not refer to asylum benefits for EU citizens", () => {
		const result = evaluateBenefitCheck(CASE_C, TODAY);
		expect(result.hints).not.toContain(HintCode.ASYLUM_BENEFITS_REFERRAL);
	});
});
