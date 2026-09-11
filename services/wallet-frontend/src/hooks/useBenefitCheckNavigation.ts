import { useCallback, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useBenefitCheckStore } from "../store/useBenefitCheckStore";
import {
	activeQuestions,
	getValidPath,
	questionById,
} from "../store/benefits/questionPath";
import { compositionImpliesChildren } from "../store/benefits/derive";
import { WORK_CAPACITY_SKIP_GROSS_INCOME } from "../config/benefitRules.config";
import { WorkCapacity } from "../schemas/benefitCheck.schema";
import { AppRoutes, getEligibilityRoute } from "../constants/routes";
import { todayIsoDate } from "../utils/date";

export const useBenefitCheckNavigation = () => {
	const navigate = useNavigate();
	const { questionId } = useParams<{ questionId: string }>();
	const answers = useBenefitCheckStore((s) => s.answers);
	const setAnswer = useBenefitCheckStore((s) => s.setAnswer);
	const today = todayIsoDate();

	const question = useMemo(
		() => (questionId ? questionById(questionId) : undefined),
		[questionId],
	);
	const path = useMemo(() => getValidPath(answers, today), [answers, today]);
	const totalActive = useMemo(
		() => activeQuestions(answers, today).length,
		[answers, today],
	);
	const indexInPath = useMemo(
		() => path.findIndex((entry) => entry.id === questionId),
		[path, questionId],
	);

	/**
	 * Brings the answers back in line with the questions that are actually asked. Matters
	 * twice: a skipped question whose field the rules read would strand them on
	 * INSUFFICIENT_DATA, and an answer given before a skip took effect would otherwise keep
	 * counting after the visitor went back and changed their mind.
	 *
	 *  - `children: []` whenever the composition is childless. Not only when the list is
	 *    unanswered: switching from "single parent" back to "I live alone" must drop the
	 *    children too, or the needs calculation keeps paying for a child the visitor has
	 *    just said does not exist — and the guest sync would write it into the profile.
	 *  - `workCapacity: FULL` above the income threshold, which is one of the two cases the
	 *    work-capacity question is skipped for. Deliberately NOT written for the other one,
	 *    the retirement age: there the answer is genuinely unknown and the SGB XII rule keys
	 *    off the age instead. The condition must stay in step with the catalogue's `skipIf`.
	 */
	const recordDerivedAnswers = useCallback(() => {
		if (
			answers.householdComposition !== undefined &&
			!compositionImpliesChildren(answers.householdComposition) &&
			(answers.children === undefined || answers.children.length > 0)
		) {
			setAnswer("children", []);
		}
		if (
			answers.monthlyGrossIncome !== undefined &&
			answers.monthlyGrossIncome > WORK_CAPACITY_SKIP_GROSS_INCOME &&
			answers.workCapacity === undefined
		) {
			setAnswer("workCapacity", WorkCapacity.FULL);
		}
	}, [
		answers.householdComposition,
		answers.children,
		answers.monthlyGrossIncome,
		answers.workCapacity,
		setAnswer,
	]);

	const navigateNext = useCallback(() => {
		recordDerivedAnswers();
		const remaining = activeQuestions(answers, today);
		const currentIndex = remaining.findIndex(
			(entry) => entry.id === questionId,
		);
		const next = remaining[currentIndex + 1];
		if (!next) {
			navigate(AppRoutes.EligibilityResult);
			return;
		}
		useBenefitCheckStore.getState().recordStepReached(currentIndex + 2);
		navigate(getEligibilityRoute(next.id));
	}, [answers, questionId, today, navigate, recordDerivedAnswers]);

	const navigateBack = useCallback(() => {
		if (indexInPath > 0) {
			navigate(getEligibilityRoute(path[indexInPath - 1].id));
			return;
		}
		navigate(AppRoutes.Home);
	}, [indexInPath, path, navigate]);

	return {
		question,
		indexInPath,
		path,
		totalActive,
		navigateNext,
		navigateBack,
	};
};
