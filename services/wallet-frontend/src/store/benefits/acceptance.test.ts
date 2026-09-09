import { describe, expect, it } from "vitest";
import {
	AssetsBand,
	BenefitId,
	BenefitStatus,
	Citizenship,
	HouseholdComposition,
	WorkCapacity,
} from "../../schemas/benefitCheck.schema";
import type {
	BenefitId as BenefitIdType,
	BenefitStatus as BenefitStatusType,
	PartialBenefitCheckAnswers,
} from "../../schemas/benefitCheck.schema";
import { evaluateBenefitCheck } from "./evaluate";

/**
 * The five cases from section 9 of leistungscheck-agent-spezifikation.md.
 *
 * `today` is pinned so ages stay fixed as the calendar moves. Where the domain spec
 * leaves a value unspecified (case D gives no rent), the fixture supplies one and says so.
 */
const TODAY = "2026-09-09";

const statusOf = (
	answers: PartialBenefitCheckAnswers,
	benefit: BenefitIdType,
): BenefitStatusType => {
	const result = evaluateBenefitCheck(answers, TODAY);
	const assessment = result.assessments.find((a) => a.benefit === benefit);
	if (!assessment) {
		throw new Error(`no assessment for ${benefit}`);
	}
	return assessment.status;
};

describe("domain spec §9 acceptance cases", () => {
	it("case A: single, employed, tight — SGB II likely", () => {
		const caseA: PartialBenefitCheckAnswers = {
			dateOfBirth: "1994-01-15", // 32
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
		expect(statusOf(caseA, BenefitId.SGB_II_BASIC_INCOME)).toBe(
			BenefitStatus.LIKELY_YES,
		);
	});

	it("case B: pensioner on a small pension — SGB XII likely, SGB II not applicable", () => {
		const caseB: PartialBenefitCheckAnswers = {
			dateOfBirth: "1955-03-20", // 71
			householdComposition: HouseholdComposition.SINGLE,
			children: [],
			isEmployed: false,
			monthlyGrossIncome: 0,
			monthlyNetHouseholdIncome: 950,
			monthlyWarmRent: 550,
			assetsBand: AssetsBand.FROM_5000_TO_15000, // 8000
			receivesBenefitsAlready: false,
			citizenship: Citizenship.DE_EU,
			livesInGermany: true,
		};
		expect(statusOf(caseB, BenefitId.SGB_XII_OLD_AGE_REDUCED_CAPACITY)).toBe(
			BenefitStatus.LIKELY_YES,
		);
		expect(statusOf(caseB, BenefitId.SGB_II_BASIC_INCOME)).toBe(
			BenefitStatus.NOT_APPLICABLE,
		);
	});

	it("case C: single parent, no maintenance — UVG likely, KiZ worth checking", () => {
		const caseC: PartialBenefitCheckAnswers = {
			dateOfBirth: "1997-05-02", // 29
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
		expect(statusOf(caseC, BenefitId.ADVANCE_MAINTENANCE)).toBe(
			BenefitStatus.LIKELY_YES,
		);
		expect(statusOf(caseC, BenefitId.CHILD_SUPPLEMENT)).toBe(
			BenefitStatus.CHECK_ADVISED,
		);
	});

	it("case D: temporarily unable to work — HLU likely, the other two not applicable", () => {
		const caseD: PartialBenefitCheckAnswers = {
			dateOfBirth: "1981-04-10", // 45
			workCapacity: WorkCapacity.TEMPORARILY_REDUCED,
			householdComposition: HouseholdComposition.SINGLE,
			children: [],
			isEmployed: false,
			monthlyGrossIncome: 0,
			monthlyNetHouseholdIncome: 300,
			monthlyWarmRent: 500, // not given by the domain spec; supplied for the needs test
			assetsBand: AssetsBand.UNDER_5000,
			receivesBenefitsAlready: false,
			citizenship: Citizenship.DE_EU,
			livesInGermany: true,
		};
		expect(statusOf(caseD, BenefitId.SGB_XII_SUBSISTENCE_AID)).toBe(
			BenefitStatus.LIKELY_YES,
		);
		expect(statusOf(caseD, BenefitId.SGB_II_BASIC_INCOME)).toBe(
			BenefitStatus.NOT_APPLICABLE,
		);
		expect(statusOf(caseD, BenefitId.SGB_XII_OLD_AGE_REDUCED_CAPACITY)).toBe(
			BenefitStatus.NOT_APPLICABLE,
		);
	});

	it("case E: asset band straddles the allowance — SGB II worth checking", () => {
		const caseE: PartialBenefitCheckAnswers = {
			dateOfBirth: "1988-01-15", // 38 -> allowance 10000
			workCapacity: WorkCapacity.FULL,
			householdComposition: HouseholdComposition.SINGLE,
			children: [],
			isEmployed: true,
			monthlyGrossIncome: 1200,
			monthlyNetHouseholdIncome: 1000,
			monthlyWarmRent: 600,
			assetsBand: AssetsBand.FROM_5000_TO_15000,
			receivesBenefitsAlready: false,
			citizenship: Citizenship.DE_EU,
			livesInGermany: true,
		};
		expect(statusOf(caseE, BenefitId.SGB_II_BASIC_INCOME)).toBe(
			BenefitStatus.CHECK_ADVISED,
		);
	});
});
