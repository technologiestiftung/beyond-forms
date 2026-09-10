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

/** Input-side clock only; the engine always receives `today` explicitly. */
const todayIsoDate = (): string => new Date().toLocaleDateString("sv-SE");

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
	 * Two skips have to write their own answer, because the rules read the field and
	 * `undefined` would strand them on INSUFFICIENT_DATA.
	 *
	 *  - `children: []` when the household composition is childless. Answering question
	 *    one with "I live alone" fully determines the children question.
	 *  - `workCapacity: FULL` when someone earns above the threshold, which is the case
	 *    the work-capacity question is skipped for. Deliberately NOT written when the
	 *    question is skipped for having reached the retirement age: there the answer is
	 *    genuinely unknown, and the SGB XII rule keys off the age instead.
	 */
	const recordDerivedAnswers = useCallback(() => {
		if (
			answers.householdComposition !== undefined &&
			!compositionImpliesChildren(answers.householdComposition) &&
			answers.children === undefined
		) {
			setAnswer("children", []);
		}
		if (
			answers.isEmployed === true &&
			answers.monthlyGrossIncome !== undefined &&
			answers.monthlyGrossIncome > WORK_CAPACITY_SKIP_GROSS_INCOME &&
			answers.workCapacity === undefined
		) {
			setAnswer("workCapacity", WorkCapacity.FULL);
		}
	}, [
		answers.householdComposition,
		answers.children,
		answers.isEmployed,
		answers.monthlyGrossIncome,
		answers.workCapacity,
		setAnswer,
	]);

	const navigateNext = useCallback(() => {
		recordDerivedAnswers();
		const remaining = activeQuestions(answers, today);
		const currentIndex = remaining.findIndex((entry) => entry.id === questionId);
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
