import { describe, it, expect } from "vitest";
import {
	Benefit,
	BenefitStatus,
	assessBenefits,
	hasReachedRetirementAge,
} from "./benefitRules";
import {
	AssetsBand,
	Binary,
	Citizenship,
	HouseholdComposition,
	WorkCapacity,
} from "../schemas/eligibility.schema";
import type { EligibilityCheck } from "../schemas/eligibility.schema";

const TODAY = "2026-10-07";

const statusOf = (answers: Partial<EligibilityCheck>, benefit: Benefit) =>
	assessBenefits(answers, TODAY).find((a) => a.benefit === benefit);

const base: Partial<EligibilityCheck> = {
	householdComposition: HouseholdComposition.SINGLE,
	dateOfBirth: "1990-05-01",
	livesInGermany: Binary.YES,
	isEmployed: Binary.NO,
	workCapacity: WorkCapacity.FULL,
	monthlyNetHouseholdIncome: 300,
	monthlyWarmRent: 600,
	assetsBand: AssetsBand.UNDER_5000,
	receivesBenefits: Binary.NO,
	citizenship: Citizenship.DE_EU,
};

const pensioner: Partial<EligibilityCheck> = {
	...base,
	dateOfBirth: "1955-01-01",
	workCapacity: undefined,
	monthlyNetHouseholdIncome: 800,
};

describe("hasReachedRetirementAge", () => {
	it("uses the age limit of the birth year", () => {
		// Born 1960: 66 years and 4 months.
		expect(hasReachedRetirementAge("1960-06-15", "2026-10-14")).toBe(false);
		expect(hasReachedRetirementAge("1960-06-15", "2026-10-15")).toBe(true);
		expect(hasReachedRetirementAge("1964-01-01", "2030-12-31")).toBe(false);
		expect(hasReachedRetirementAge("1964-01-01", "2031-01-01")).toBe(true);
	});
});

describe("Grundsicherungsgeld", () => {
	it("is likely for someone able to work whose income is below needs", () => {
		expect(statusOf(base, Benefit.GRUNDSICHERUNGSGELD)?.status).toBe(
			BenefitStatus.LIKELY,
		);
	});

	it("does not apply past the retirement age", () => {
		expect(statusOf(pensioner, Benefit.GRUNDSICHERUNGSGELD)).toMatchObject({
			status: BenefitStatus.NO,
			reason: "retirement_age_reached",
		});
	});

	it("does not apply when income covers needs", () => {
		expect(
			statusOf(
				{ ...base, monthlyNetHouseholdIncome: 2000 },
				Benefit.GRUNDSICHERUNGSGELD,
			)?.status,
		).toBe(BenefitStatus.NO);
	});

	it("uses the age-tiered savings allowance", () => {
		const savings = { ...base, assetsBand: AssetsBand.FROM_10000_TO_12500 };
		// Age 36: 10,000 allowance, so the band lies entirely above it.
		expect(statusOf(savings, Benefit.GRUNDSICHERUNGSGELD)?.status).toBe(
			BenefitStatus.NO,
		);
		// Age 45: 12,500 allowance, so the band lies within it.
		expect(
			statusOf(
				{ ...savings, dateOfBirth: "1981-01-01" },
				Benefit.GRUNDSICHERUNGSGELD,
			)?.status,
		).toBe(BenefitStatus.LIKELY);
	});

	it("is only possible when savings straddle a couple's allowance", () => {
		// Age 45, couple: 2 × 12,500, which the open-ended top band straddles.
		expect(
			statusOf(
				{
					...base,
					householdComposition: HouseholdComposition.COUPLE_NO_CHILDREN,
					dateOfBirth: "1981-01-01",
					assetsBand: AssetsBand.OVER_20000,
				},
				Benefit.GRUNDSICHERUNGSGELD,
			)?.status,
		).toBe(BenefitStatus.POSSIBLE);
	});

	it("is only possible when unable to work for now", () => {
		expect(
			statusOf(
				{ ...base, workCapacity: WorkCapacity.TEMPORARILY_REDUCED },
				Benefit.GRUNDSICHERUNGSGELD,
			)?.status,
		).toBe(BenefitStatus.POSSIBLE);
	});
});

describe("Grundsicherung im Alter und bei Erwerbsminderung", () => {
	it("is likely for a pensioner with low income and savings", () => {
		expect(statusOf(pensioner, Benefit.GRUNDSICHERUNG_ALTER)?.status).toBe(
			BenefitStatus.LIKELY,
		);
	});

	it("applies to adults permanently unable to work", () => {
		expect(
			statusOf(
				{ ...base, workCapacity: WorkCapacity.PERMANENTLY_REDUCED },
				Benefit.GRUNDSICHERUNG_ALTER,
			)?.status,
		).toBe(BenefitStatus.LIKELY);
	});

	it("does not apply below the retirement age to someone able to work", () => {
		expect(statusOf(base, Benefit.GRUNDSICHERUNG_ALTER)?.status).toBe(
			BenefitStatus.NO,
		);
	});

	it("uses the flat 10,000 savings allowance", () => {
		expect(
			statusOf(
				{ ...pensioner, assetsBand: AssetsBand.FROM_10000_TO_12500 },
				Benefit.GRUNDSICHERUNG_ALTER,
			)?.status,
		).toBe(BenefitStatus.NO);
	});
});

describe("Wohngeld", () => {
	it("is worth checking when income covers the Regelbedarf and rent is high", () => {
		expect(
			statusOf({ ...base, monthlyNetHouseholdIncome: 1200 }, Benefit.WOHNGELD)
				?.status,
		).toBe(BenefitStatus.POSSIBLE);
	});

	it("does not apply when income is below the Regelbedarf", () => {
		expect(statusOf(base, Benefit.WOHNGELD)?.status).toBe(BenefitStatus.NO);
	});
});

describe("Kinderzuschlag", () => {
	const family: Partial<EligibilityCheck> = {
		...base,
		householdComposition: HouseholdComposition.COUPLE_WITH_CHILDREN,
		children: [{ dateOfBirth: "2018-03-01" }],
		isEmployed: Binary.YES,
		monthlyGrossIncome: 2500,
		monthlyNetHouseholdIncome: 2000,
	};

	it("is worth checking for a family above the minimum income", () => {
		expect(statusOf(family, Benefit.KINDERZUSCHLAG)?.status).toBe(
			BenefitStatus.POSSIBLE,
		);
	});

	it("does not apply below the minimum income", () => {
		expect(
			statusOf({ ...family, monthlyGrossIncome: 800 }, Benefit.KINDERZUSCHLAG)
				?.status,
		).toBe(BenefitStatus.NO);
	});

	it("does not apply without children", () => {
		expect(statusOf(base, Benefit.KINDERZUSCHLAG)?.status).toBe(
			BenefitStatus.NO,
		);
	});
});

describe("caps on likely results", () => {
	it("an existing benefit turns likely into possible", () => {
		expect(
			statusOf(
				{ ...base, receivesBenefits: Binary.YES },
				Benefit.GRUNDSICHERUNGSGELD,
			),
		).toMatchObject({
			status: BenefitStatus.POSSIBLE,
			reason: "already_receives_benefits",
		});
	});

	it("an unclear residence status turns likely into possible", () => {
		expect(
			statusOf(
				{
					...base,
					citizenship: Citizenship.NON_EU,
					hasSecureResidenceStatus: Binary.NO,
				},
				Benefit.GRUNDSICHERUNGSGELD,
			),
		).toMatchObject({
			status: BenefitStatus.POSSIBLE,
			reason: "residence_status_unclear",
		});
	});
});
