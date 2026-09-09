import { useCallback, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useBenefitCheckStore } from "../store/useBenefitCheckStore";
import {
	activeQuestions,
	getValidPath,
	questionById,
} from "../store/benefits/questionPath";
import { compositionImpliesChildren } from "../store/benefits/derive";
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
	 * The children question is the one skip that still has to write. Every rule's means
	 * test needs `children`, so a childless household that never sees the question would
	 * otherwise sit on INSUFFICIENT_DATA forever. Answering question 1 with a childless
	 * composition fully determines the answer to question 2, so it is recorded here.
	 */
	const recordSkippedChildren = useCallback(() => {
		if (
			answers.householdComposition !== undefined &&
			!compositionImpliesChildren(answers.householdComposition) &&
			answers.children === undefined
		) {
			setAnswer("children", []);
		}
	}, [answers.householdComposition, answers.children, setAnswer]);

	const navigateNext = useCallback(() => {
		recordSkippedChildren();
		const remaining = activeQuestions(answers, today);
		const currentIndex = remaining.findIndex((entry) => entry.id === questionId);
		const next = remaining[currentIndex + 1];
		if (!next) {
			navigate(AppRoutes.EligibilityResult);
			return;
		}
		useBenefitCheckStore.getState().recordStepReached(currentIndex + 2);
		navigate(getEligibilityRoute(next.id));
	}, [answers, questionId, today, navigate, recordSkippedChildren]);

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
