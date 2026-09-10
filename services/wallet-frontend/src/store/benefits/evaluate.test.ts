import { describe, expect, it } from "vitest";
import {
	AssetsBand,
	BenefitId,
	BenefitStatus,
	Citizenship,
	HintCode,
	HouseholdComposition,
	ReasonCode,
	WorkCapacity,
} from "../../schemas/benefitCheck.schema";
import type {
	BenefitCheckResult,
	PartialBenefitCheckAnswers,
} from "../../schemas/benefitCheck.schema";
import { evaluateBenefitCheck } from "./evaluate";

const educationPackage = (result: BenefitCheckResult) => {
	const assessment = result.assessments.find(
		(a) => a.benefit === BenefitId.EDUCATION_PARTICIPATION_PACKAGE,
	);
	if (assessment === undefined) {
		throw new Error("the education package is missing from the result");
	}
	return assessment;
};

const TODAY = "2026-09-09";

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
	childReceivesFullSupport: false,
	monthsWithoutChildSupport: 8,
	livesInGermany: true,
};

describe("evaluateBenefitCheck", () => {
	it("always returns all seven benefits in a stable order", () => {
		const result = evaluateBenefitCheck({}, TODAY);
		expect(result.assessments.map((a) => a.benefit)).toEqual([
			BenefitId.SGB_II_BASIC_INCOME,
			BenefitId.SGB_XII_OLD_AGE_REDUCED_CAPACITY,
			BenefitId.SGB_XII_SUBSISTENCE_AID,
			BenefitId.HOUSING_BENEFIT,
			BenefitId.CHILD_SUPPLEMENT,
			BenefitId.ADVANCE_MAINTENANCE,
			BenefitId.EDUCATION_PARTICIPATION_PACKAGE,
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

	it("carries the education package along when a base benefit is live", () => {
		const result = evaluateBenefitCheck(CASE_C, TODAY);
		expect(educationPackage(result)).toMatchObject({
			status: BenefitStatus.CHECK_ADVISED,
			reasons: [ReasonCode.EDUCATION_PACKAGE_FOLLOWS_BASE_BENEFIT],
		});
	});

	it("is as confident about the education package as the strongest base benefit", () => {
		// Nothing coming in, no savings: SGB II lands on LIKELY_YES, so the package does too.
		const result = evaluateBenefitCheck(
			{
				...CASE_C,
				isEmployed: false,
				monthlyGrossIncome: 0,
				monthlyNetHouseholdIncome: 0,
			},
			TODAY,
		);
		expect(educationPackage(result).status).toBe(BenefitStatus.LIKELY_YES);
	});

	it("rules the education package out when no base benefit carries it", () => {
		const result = evaluateBenefitCheck(
			{
				...CASE_C,
				// Gross below the Kinderzuschlag minimum kills that one; the comfortable
				// net income and the savings kill the other four.
				isEmployed: false,
				monthlyGrossIncome: 0,
				monthlyNetHouseholdIncome: 4200,
				monthlyWarmRent: 500,
				assetsBand: AssetsBand.OVER_25000,
			},
			TODAY,
		);
		expect(educationPackage(result)).toMatchObject({
			status: BenefitStatus.LIKELY_NO,
			reasons: [ReasonCode.EDUCATION_PACKAGE_NEEDS_BASE_BENEFIT],
		});
	});

	it("hints at Kindergeld whenever children are present", () => {
		const result = evaluateBenefitCheck(CASE_C, TODAY);
		expect(result.hints).toContain(HintCode.CHILD_BENEFIT_PREREQUISITE);
	});

	it("omits child hints when there are no children", () => {
		const result = evaluateBenefitCheck(
			{
				...CASE_C,
				householdComposition: HouseholdComposition.SINGLE,
				children: [],
			},
			TODAY,
		);
		expect(result.hints).not.toContain(HintCode.CHILD_BENEFIT_PREREQUISITE);
	});

	it("grants the education package to a household already on benefits", () => {
		const result = evaluateBenefitCheck(
			{ ...CASE_C, receivesBenefitsAlready: true },
			TODAY,
		);
		expect(educationPackage(result).status).toBe(BenefitStatus.LIKELY_YES);
	});

	it("sets the education package aside when there are no children", () => {
		const result = evaluateBenefitCheck(
			{
				...CASE_C,
				householdComposition: HouseholdComposition.SINGLE,
				children: [],
			},
			TODAY,
		);
		expect(educationPackage(result)).toMatchObject({
			status: BenefitStatus.NOT_APPLICABLE,
			reasons: [ReasonCode.NO_ELIGIBLE_CHILDREN],
		});
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
