import React, { useEffect, useRef } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
	ELIGIBILITY_TOTAL_STEPS,
	useEligibilityStore,
} from "../store/useEligibilityStore";
import { ProgressBar } from "../components/Eligibility/ProgressBar";
import { QuestionCard } from "../components/Eligibility/QuestionCard";
import { DateOfBirthCard } from "../components/Eligibility/DateOfBirthCard";
import { StepLayout } from "../components/Layout/StepLayout";
import { AppRoutes, getEligibilityRoute } from "../constants/routes";
import { useEligibilityNavigation } from "../hooks/useEligibilityNavigation";
import { i18nKeys } from "../i18n/i18nKeys";
import type { EligibilityCheck } from "../schemas/eligibility.schema";

export const EligibilityFlow: React.FC = () => {
	const { t } = useTranslation();
	const answers = useEligibilityStore((s) => s.answers);
	const setAnswer = useEligibilityStore((s) => s.setAnswer);
	const clearAnswer = useEligibilityStore((s) => s.clearAnswer);
	const validationError = useEligibilityStore((s) => s.validationError);
	const {
		currentQuestionNode,
		currentIndexInPath,
		validPath,
		isTerminal,
		navigateNext,
		navigateBack,
	} = useEligibilityNavigation();

	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		window.scrollTo(0, 0);
		containerRef.current?.focus();
	}, [currentQuestionNode?.id]);

	if (
		!currentQuestionNode ||
		currentIndexInPath === -1 ||
		currentQuestionNode.type === "result"
	) {
		if (isTerminal) {
			return <Navigate to={AppRoutes.EligibilityResult} replace />;
		}
		return <Navigate to={getEligibilityRoute(validPath[0])} replace />;
	}

	const handleAnswerChange = <K extends keyof EligibilityCheck>(
		key: K,
		val: EligibilityCheck[K],
	) => {
		setAnswer(key, val);
	};

	const questionKey = currentQuestionNode.key;
	if (!questionKey) {
		return <Navigate to={getEligibilityRoute(validPath[0])} replace />;
	}

	return (
		<div
			ref={containerRef}
			tabIndex={-1}
			className="outline-none w-full flex flex-col items-center min-h-full bg-white flex-grow"
		>
			<StepLayout
				onBack={navigateBack}
				backAriaLabel={t(i18nKeys.common.back)}
				backTestId="back-button"
				colorVariant="blue"
			>
				<ProgressBar
					current={currentIndexInPath + 1}
					total={ELIGIBILITY_TOTAL_STEPS}
				/>

				{validationError && (
					<div
						className="mb-4 w-full rounded-lg border border-red-200 bg-red-100 p-4 text-sm text-red-700 shadow-sm"
						role="alert"
					>
						{validationError}
					</div>
				)}

				{currentQuestionNode.type === "date" ? (
					<DateOfBirthCard
						key={currentQuestionNode.id}
						id={questionKey}
						question={t(i18nKeys.eligibility.questionTitle(questionKey))}
						category={t(i18nKeys.eligibility.questionCategory(questionKey))}
						tip={t(i18nKeys.eligibility.questionTip(questionKey))}
						value={answers[questionKey] as string | undefined}
						onChange={(val) =>
							handleAnswerChange(
								questionKey,
								val as EligibilityCheck[typeof questionKey],
							)
						}
						onClear={() => clearAnswer(questionKey)}
						onNext={navigateNext}
					/>
				) : (
					<QuestionCard
						key={currentQuestionNode.id}
						id={questionKey}
						question={t(i18nKeys.eligibility.questionTitle(questionKey))}
						category={t(i18nKeys.eligibility.questionCategory(questionKey))}
						tip={t(i18nKeys.eligibility.questionTip(questionKey))}
						options={currentQuestionNode.options ?? []}
						value={answers[questionKey] as string | undefined}
						onChange={(val) =>
							handleAnswerChange(
								questionKey,
								val as EligibilityCheck[typeof questionKey],
							)
						}
						onNext={navigateNext}
					/>
				)}
			</StepLayout>
		</div>
	);
};
