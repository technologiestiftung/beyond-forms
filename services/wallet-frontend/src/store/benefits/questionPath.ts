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

/**
 * The active questions up to and including the first unanswered one. Replaces the graph
 * walk of the old EligibilityEngine: the catalogue plus its skip conditions already
 * describes the order, so this only has to cut it off.
 */
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

export const questionById = (id: string): BenefitQuestion | undefined =>
	QUESTION_CATALOGUE.find((question) => question.id === id);
