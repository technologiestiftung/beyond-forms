import { describe, expect, it } from "vitest";
import { profileToBenefitAnswers } from "./fromProfile";
import { evaluateBenefitCheck } from "./evaluate";
import {
	BenefitId,
	BenefitStatus,
	Citizenship,
	HouseholdComposition,
	WorkCapacity,
} from "../../schemas/benefitCheck.schema";
import type { Profile } from "../../schemas/profile.schema";

const TODAY = "2026-09-11";

const profile = (parts: Record<string, unknown>) => parts as unknown as Profile;

const statusOf = (
	answers: ReturnType<typeof profileToBenefitAnswers>,
	benefit: BenefitId,
) =>
	evaluateBenefitCheck(answers, TODAY).assessments.find(
		(assessment) => assessment.benefit === benefit,
	)?.status;

describe("profileToBenefitAnswers", () => {
	it("returns nothing usable for an empty profile", () => {
		expect(profileToBenefitAnswers(profile({}))).toEqual({});
	});

	it("reads the date of birth, work capacity and citizenship", () => {
		const answers = profileToBenefitAnswers(
			profile({
				personalData: { dateOfBirth: "1994-01-15", isGermanCitizen: true },
				health: { abilityToWork: "Permanently disabled" },
			}),
		);
		expect(answers.dateOfBirth).toBe("1994-01-15");
		expect(answers.workCapacity).toBe(WorkCapacity.PERMANENTLY_REDUCED);
		expect(answers.citizenship).toBe(Citizenship.DE_EU);
	});

	it("treats a settled residence status as secure and anything else as not", () => {
		const secure = profileToBenefitAnswers(
			profile({
				personalData: {
					isGermanCitizen: false,
					residenceStatus: "PermanentResident",
				},
			}),
		);
		expect(secure.citizenship).toBe(Citizenship.NON_EU);
		expect(secure.hasSecureResidenceStatus).toBe(true);

		const unsettled = profileToBenefitAnswers(
			profile({
				personalData: { isGermanCitizen: false, residenceStatus: "Other" },
			}),
		);
		expect(unsettled.hasSecureResidenceStatus).toBe(false);
	});

	it("leaves citizenship unanswered when the profile says nothing", () => {
		const answers = profileToBenefitAnswers(
			profile({ personalData: { dateOfBirth: "1994-01-15" } }),
		);
		expect(answers.citizenship).toBeUndefined();
	});

	it("derives the household from the marital status and the head count", () => {
		expect(
			profileToBenefitAnswers(
				profile({
					household: { maritalStatus: "Single", personsInHouseholdCount: 1 },
				}),
			).householdComposition,
		).toBe(HouseholdComposition.SINGLE);

		expect(
			profileToBenefitAnswers(
				profile({
					household: { maritalStatus: "Single", personsInHouseholdCount: 2 },
				}),
			).householdComposition,
		).toBe(HouseholdComposition.SINGLE_PARENT);

		expect(
			profileToBenefitAnswers(
				profile({
					household: {
						maritalStatus: "Cohabiting",
						personsInHouseholdCount: 2,
					},
				}),
			).householdComposition,
		).toBe(HouseholdComposition.COUPLE_NO_CHILDREN);

		expect(
			profileToBenefitAnswers(
				profile({
					household: { maritalStatus: "Married", personsInHouseholdCount: 3 },
				}),
			).householdComposition,
		).toBe(HouseholdComposition.COUPLE_WITH_CHILDREN);
	});

	it("asserts an empty children list only when there are none", () => {
		expect(
			profileToBenefitAnswers(
				profile({
					household: { maritalStatus: "Single", personsInHouseholdCount: 1 },
				}),
			).children,
		).toEqual([]);

		// Their ages are not on the profile, so a household WITH children stays unanswered
		// rather than inventing one.
		expect(
			profileToBenefitAnswers(
				profile({
					household: { maritalStatus: "Single", personsInHouseholdCount: 2 },
				}),
			).children,
		).toBeUndefined();
	});

	/**
	 * The safety property this whole mapping rests on: the profile has no gross income, no
	 * savings band and no warm rent, so a means test must come back undecided rather than
	 * negative. A LIKELY_NO here would hide a form from someone who may be entitled to it.
	 */
	it("never produces a rejection from money the profile does not hold", () => {
		const answers = profileToBenefitAnswers(
			profile({
				personalData: { dateOfBirth: "1994-01-15", isGermanCitizen: true },
				health: { abilityToWork: "Fully able" },
				household: { maritalStatus: "Single", personsInHouseholdCount: 1 },
				financial: { monthlyIncome: 4000 },
			}),
		);
		expect(answers.monthlyGrossIncome).toBeUndefined();
		expect(answers.assetsBand).toBeUndefined();
		expect(answers.monthlyWarmRent).toBeUndefined();
		expect(statusOf(answers, BenefitId.SGB_II_BASIC_INCOME)).toBe(
			BenefitStatus.CHECK_ADVISED,
		);
		expect(statusOf(answers, BenefitId.HOUSING_BENEFIT)).toBe(
			BenefitStatus.CHECK_ADVISED,
		);
	});

	it("rules out basic income once the retirement age is reached", () => {
		const answers = profileToBenefitAnswers(
			profile({
				personalData: { dateOfBirth: "1950-01-01", isGermanCitizen: true },
				household: { maritalStatus: "Single", personsInHouseholdCount: 1 },
			}),
		);
		expect(statusOf(answers, BenefitId.SGB_II_BASIC_INCOME)).toBe(
			BenefitStatus.NOT_APPLICABLE,
		);
	});

	it("rules out the child supplement for a household with no children", () => {
		const answers = profileToBenefitAnswers(
			profile({
				household: { maritalStatus: "Single", personsInHouseholdCount: 1 },
			}),
		);
		expect(statusOf(answers, BenefitId.CHILD_SUPPLEMENT)).toBe(
			BenefitStatus.NOT_APPLICABLE,
		);
	});

	it("rules out old-age support for someone of working age who can work", () => {
		const answers = profileToBenefitAnswers(
			profile({
				personalData: { dateOfBirth: "1994-01-15", isGermanCitizen: true },
				health: { abilityToWork: "Fully able" },
			}),
		);
		expect(statusOf(answers, BenefitId.SGB_XII_OLD_AGE_REDUCED_CAPACITY)).toBe(
			BenefitStatus.NOT_APPLICABLE,
		);
	});
});
