import React, { useEffect, useRef } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useBenefitCheckStore } from "../store/useBenefitCheckStore";
import { ProgressBar } from "../components/Eligibility/ProgressBar";
import { QuestionCard } from "../components/Eligibility/QuestionCard";
import { DateOfBirthCard } from "../components/Eligibility/DateOfBirthCard";
import { NumberCard } from "../components/Eligibility/NumberCard";
import { ChildrenCard } from "../components/Eligibility/ChildrenCard";
import { StepLayout } from "../components/Layout/StepLayout";
import { getEligibilityRoute } from "../constants/routes";
import { useBenefitCheckNavigation } from "../hooks/useBenefitCheckNavigation";
import { BINARY_OPTIONS } from "../store/benefits/questionCatalogue";
import { i18nKeys } from "../i18n/i18nKeys";
import type { BenefitCheckAnswers } from "../schemas/benefitCheck.schema";

export const EligibilityFlow: React.FC = () => {
	const { t } = useTranslation();
	const answers = useBenefitCheckStore((s) => s.answers);
	const setAnswer = useBenefitCheckStore((s) => s.setAnswer);
	const clearAnswer = useBenefitCheckStore((s) => s.clearAnswer);
	const validationError = useBenefitCheckStore((s) => s.validationError);
	const maxDepthReached = useBenefitCheckStore((s) => s.maxDepthReached);
	const {
		question,
		indexInPath,
		path,
		totalActive,
		navigateNext,
		navigateBack,
	} = useBenefitCheckNavigation();

	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		window.scrollTo(0, 0);
		containerRef.current?.focus();
	}, [question?.id]);

	// Unknown id, or a question the current answers skip. The path always ends on the
	// first unanswered question, so that is where someone belongs — the old flow sent
	// them back to question one, which threw away their place.
	if (!question || indexInPath === -1) {
		const open = path[path.length - 1];
		return <Navigate to={getEligibilityRoute(open.id)} replace />;
	}

	const copy = (part: string) => t(`questions.${question.id}.${part}`);
	const tipText = t(`questions.${question.id}.tip`, { defaultValue: "" });

	const header = {
		id: question.id,
		question: copy("title"),
		category: copy("category"),
		tip: tipText || undefined,
	};

	const write = <K extends keyof BenefitCheckAnswers>(
		value: BenefitCheckAnswers[K],
	) => setAnswer(question.field as K, value);

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
					current={indexInPath + 1}
					total={totalActive}
					maxDepthReached={maxDepthReached}
				/>

				{validationError && (
					<div
						className="mb-4 w-full rounded-lg border border-red-200 bg-red-100 p-4 text-sm text-red-700 shadow-sm"
						role="alert"
					>
						{validationError}
					</div>
				)}

				{question.input === "choice" && (
					<QuestionCard
						key={question.id}
						{...header}
						options={question.options ?? []}
						value={answers[question.field] as string | undefined}
						onChange={(raw) => write(raw as never)}
						onNext={navigateNext}
					/>
				)}

				{question.input === "boolean" && (
					<QuestionCard
						key={question.id}
						{...header}
						options={BINARY_OPTIONS}
						value={
							answers[question.field] === undefined
								? undefined
								: answers[question.field]
									? "YES"
									: "NO"
						}
						onChange={(raw) => write((raw === "YES") as never)}
						onNext={navigateNext}
					/>
				)}

				{question.input === "date" && (
					<DateOfBirthCard
						key={question.id}
						{...header}
						value={answers[question.field] as string | undefined}
						onChange={(raw) => write(raw as never)}
						onClear={() => clearAnswer(question.field)}
						onNext={navigateNext}
					/>
				)}

				{question.input === "number" && (
					<NumberCard
						key={question.id}
						{...header}
						unitLabel={copy("unit")}
						value={answers[question.field] as number | undefined}
						onChange={(raw) => write(raw as never)}
						onClear={() => clearAnswer(question.field)}
						onNext={navigateNext}
					/>
				)}

				{question.input === "children" && (
					<ChildrenCard
						key={question.id}
						{...header}
						addLabel={copy("add")}
						removeLabel={copy("remove")}
						childLabel={copy("child_label")}
						value={answers.children}
						onChange={(raw) => write(raw as never)}
						onNext={navigateNext}
					/>
				)}
			</StepLayout>
		</div>
	);
};
