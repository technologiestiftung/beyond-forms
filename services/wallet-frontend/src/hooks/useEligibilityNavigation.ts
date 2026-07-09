import { useMemo, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
	ELIGIBILITY_TOTAL_STEPS,
	useEligibilityStore,
} from "../store/useEligibilityStore";
import { EligibilityEngine, type NodeId } from "../store/EligibilityEngine";
import { AppRoutes, getEligibilityRoute } from "../constants/routes";

/**
 * useEligibilityNavigation manages navigation logic within the Eligibility Flow.
 */
export const useEligibilityNavigation = () => {
	const navigate = useNavigate();
	const { questionId } = useParams<{ questionId: string }>();
	const answers = useEligibilityStore((s) => s.answers);

	const validPath = useMemo(
		() => EligibilityEngine.getValidPath(answers),
		[answers],
	);
	const currentQuestionNode = useMemo(
		() => EligibilityEngine.getNode(questionId as NodeId),
		[questionId],
	);
	const currentIndexInPath = useMemo(
		() => validPath.indexOf(questionId as NodeId),
		[validPath, questionId],
	);

	const navigateNext = useCallback(() => {
		const nextNodeId = currentQuestionNode?.next?.(answers);
		if (nextNodeId) {
			const arrivingStep = Math.min(
				currentIndexInPath + 2,
				ELIGIBILITY_TOTAL_STEPS,
			);
			useEligibilityStore.getState().recordStepReached(arrivingStep);

			const node = EligibilityEngine.getNode(nextNodeId);
			const target =
				node.type === "result"
					? AppRoutes.EligibilityResult
					: getEligibilityRoute(nextNodeId);
			navigate(target);
		}
	}, [currentQuestionNode, currentIndexInPath, answers, navigate]);

	const navigateBack = useCallback(() => {
		if (currentIndexInPath > 0) {
			navigate(getEligibilityRoute(validPath[currentIndexInPath - 1]));
		} else {
			navigate(AppRoutes.Home);
		}
	}, [currentIndexInPath, validPath, navigate]);

	const navigateToStart = useCallback(() => {
		navigate(AppRoutes.Home);
	}, [navigate]);

	const isTerminal = useMemo(
		() => currentQuestionNode?.type === "result",
		[currentQuestionNode],
	);

	return {
		currentQuestionNode,
		currentIndexInPath,
		validPath,
		isTerminal,
		navigateNext,
		navigateBack,
		navigateToStart,
	};
};
