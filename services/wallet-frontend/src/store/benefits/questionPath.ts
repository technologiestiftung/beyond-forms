import type { PartialBenefitCheckAnswers } from "../../schemas/benefitCheck.schema";
import { QUESTION_CATALOGUE } from "./questionCatalogue";
import type { BenefitQuestion } from "./questionCatalogue";

/** Every question the current answers do not skip, in catalogue order. */
export const activeQuestions = (
	answers: PartialBenefitCheckAnswers,
	today: string,
): BenefitQuestion[] =>
	QUESTION_CATALOGUE.filter(
		(question) => !(question.skipIf?.(answers, today) ?? false),
	);

/** The active questions up to and including the first unanswered one. */
export const getValidPath = (
	answers: PartialBenefitCheckAnswers,
	today: string,
): BenefitQuestion[] => {
	const active = activeQuestions(answers, today);
	const firstUnanswered = active.findIndex(
		(question) => answers[question.field] === undefined,
	);
	return firstUnanswered === -1 ? active : active.slice(0, firstUnanswered + 1);
};

/**
 * Whether every question this visitor is actually shown has an answer. Guards both the
 * result view, which would otherwise present verdicts built from missing data, and the
 * profile sync, which must not persist a half-finished assessment.
 */
export const isCheckComplete = (
	answers: PartialBenefitCheckAnswers,
	today: string,
): boolean =>
	activeQuestions(answers, today).every(
		(question) => answers[question.field] !== undefined,
	);

/** The first question still waiting for an answer, or undefined once none are. */
export const firstOpenQuestion = (
	answers: PartialBenefitCheckAnswers,
	today: string,
): BenefitQuestion | undefined =>
	activeQuestions(answers, today).find(
		(question) => answers[question.field] === undefined,
	);

export const questionById = (id: string): BenefitQuestion | undefined =>
	QUESTION_CATALOGUE.find((question) => question.id === id);
