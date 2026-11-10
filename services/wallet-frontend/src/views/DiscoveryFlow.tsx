import React, { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type {
	AnswerValue,
	PersonAnswers,
	Question,
} from "@beyond-forms/eligibility-engine";
import { ProgressBar } from "../components/Eligibility/ProgressBar";
import { QuestionCard } from "../components/Eligibility/QuestionCard";
import { DateOfBirthCard } from "../components/Eligibility/DateOfBirthCard";
import { NumberCard } from "../components/Eligibility/NumberCard";
import { ChildrenCard } from "../components/Eligibility/ChildrenCard";
import { StepLayout } from "../components/Layout/StepLayout";
import { AppRoutes, getEligibilityRoute } from "../constants/routes";
import { i18nKeys } from "../i18n/i18nKeys";
import { getDiscoveryEngine } from "../services/eligibility/discoveryEngine";
import { useDiscoveryStore } from "../store/useDiscoveryStore";
import {
	useDiscoveryLanguage,
	useDiscoveryMatch,
	useMatchNow,
} from "../hooks/useDiscovery";

/** What the current card holds until "Weiter": a value, no value, or the children */
type Pending =
	| { kind: "value"; value: AnswerValue | undefined }
	| { kind: "children"; children: PersonAnswers[] };

/** The option code a stored answer corresponds to, so cards keep their legacy test ids */
const codeOf = (question: Question, value: AnswerValue | undefined) =>
	question.options.find((option) => option.value === value)?.code;

export const DiscoveryFlow: React.FC = () => {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { questionId } = useParams<{ questionId: string }>();
	const lang = useDiscoveryLanguage();
	const answers = useDiscoveryStore((s) => s.answers);
	const children = useDiscoveryStore((s) => s.children);
	const history = useDiscoveryStore((s) => s.history);
	const setAnswer = useDiscoveryStore((s) => s.setAnswer);
	const setChildren = useDiscoveryStore((s) => s.setChildren);
	const clearAnswer = useDiscoveryStore((s) => s.clearAnswer);
	const { data: match } = useDiscoveryMatch();
	const matchNow = useMatchNow();
	const containerRef = useRef<HTMLDivElement>(null);
	// Typing only changes this; the store, and with it the engine, sees the answer on "Weiter"
	const [pendingState, setPendingState] = useState<{
		step?: string;
		pending: Pending;
	}>();
	const pending =
		pendingState && pendingState.step === questionId
			? pendingState.pending
			: undefined;
	const setPending = (next: Pending) =>
		setPendingState({ step: questionId, pending: next });

	useEffect(() => {
		window.scrollTo(0, 0);
		containerRef.current?.focus();
	}, [questionId]);

	if (!match) {
		return null;
	}
	const isKnownStep =
		questionId !== undefined &&
		(history.includes(questionId) || questionId === match.nextQuestion);
	if (!isKnownStep) {
		return (
			<Navigate
				to={
					match.nextQuestion
						? getEligibilityRoute(match.nextQuestion)
						: AppRoutes.EligibilityResult
				}
				replace
			/>
		);
	}

	const question = getDiscoveryEngine().question(questionId, lang);
	const position = history.indexOf(questionId);
	const answeredBefore = position === -1 ? history.length : position;
	const progress =
		answeredBefore / (answeredBefore + Math.max(match.missingCount, 1));

	const value =
		pending?.kind === "value" ? pending.value : answers[question.id];
	const currentChildren =
		pending?.kind === "children" ? pending.children : children;

	const commit = () => {
		if (pending?.kind === "children") {
			setChildren(pending.children);
		} else if (pending?.kind === "value") {
			if (pending.value === undefined) {
				clearAnswer(question.id);
			} else {
				setAnswer(question.id, pending.value);
			}
		}
	};

	const navigateNext = async () => {
		commit();
		const next = await matchNow();
		navigate(
			next.nextQuestion
				? getEligibilityRoute(next.nextQuestion)
				: AppRoutes.EligibilityResult,
		);
	};

	const navigateBack = () => {
		const previous = history[answeredBefore - 1];
		navigate(previous ? getEligibilityRoute(previous) : AppRoutes.Home);
	};

	const sharedProps = {
		id: question.id,
		question: question.question,
		category: question.category,
		tip: question.tip,
		onNext: () => void navigateNext(),
	};

	const renderQuestion = () => {
		switch (question.datatype) {
			case "euroAmount":
				return (
					<NumberCard
						key={question.id}
						{...sharedProps}
						value={value as number | undefined}
						onChange={(next) => setPending({ kind: "value", value: next })}
						onClear={() => setPending({ kind: "value", value: undefined })}
					/>
				);
			case "childList":
				return (
					<ChildrenCard
						key={question.id}
						{...sharedProps}
						value={
							currentChildren.length > 0
								? currentChildren.map((child) => ({
										dateOfBirth: String(child.birthDate),
									}))
								: undefined
						}
						onChange={(next) =>
							setPending({
								kind: "children",
								children: next.map((child) => ({
									birthDate: child.dateOfBirth,
								})),
							})
						}
						onClear={() => setPending({ kind: "children", children: [] })}
					/>
				);
			case "date":
				return (
					<DateOfBirthCard
						key={question.id}
						{...sharedProps}
						value={value as string | undefined}
						onChange={(next) => setPending({ kind: "value", value: next })}
						onClear={() => setPending({ kind: "value", value: undefined })}
					/>
				);
			default:
				return (
					<QuestionCard
						key={question.id}
						{...sharedProps}
						options={question.options.map((option) => option.code ?? option.id)}
						optionLabels={Object.fromEntries(
							question.options.map((option) => [
								option.code ?? option.id,
								option.label,
							]),
						)}
						value={codeOf(question, value)}
						onChange={(code) => {
							const option = question.options.find(
								(candidate) => (candidate.code ?? candidate.id) === code,
							);
							if (option) {
								setPending({ kind: "value", value: option.value });
							}
						}}
					/>
				);
		}
	};

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
				width="wide"
			>
				<ProgressBar progress={progress} />
				{renderQuestion()}
			</StepLayout>
		</div>
	);
};
