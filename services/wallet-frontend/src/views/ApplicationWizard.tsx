import React, { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
	keepPreviousData,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import {
	backendPatch,
	profileFromBackend,
	type AnswerValue,
	type FieldRef,
	type PersonAnswers,
	type Profile,
	type Question,
} from "@beyond-forms/eligibility-engine";
import { ProgressBar } from "../components/Eligibility/ProgressBar";
import { QuestionCard } from "../components/Eligibility/QuestionCard";
import { DateOfBirthCard } from "../components/Eligibility/DateOfBirthCard";
import { NumberCard } from "../components/Eligibility/NumberCard";
import { ChildrenCard } from "../components/Eligibility/ChildrenCard";
import { TextCard } from "../components/Eligibility/TextCard";
import { CountryCard } from "../components/Eligibility/CountryCard";
import { StepLayout } from "../components/Layout/StepLayout";
import { AppRoutes, getKnowledgeApplicationRoute } from "../constants/routes";
import { i18nKeys } from "../i18n/i18nKeys";
import { getDiscoveryEngine } from "../services/eligibility/discoveryEngine";
import {
	STORED_PROFILE_KEY,
	fetchStoredProfile,
	saveStoredProfile,
} from "../services/eligibility/storedProfile";
import { useDiscoveryStore } from "../store/useDiscoveryStore";
import { useDiscoveryLanguage } from "../hooks/useDiscovery";
import { localDateToday } from "../schemas/eligibility.schema";

const parseStep = (step: string | undefined): FieldRef | undefined => {
	const [individual, field] = step?.split(".") ?? [];
	return individual && field ? { individual, field } : undefined;
};

const answersOf = (profile: Profile, individual: string): PersonAnswers => {
	if (individual === "citizen") {
		return profile.answers;
	}
	if (individual === "partner") {
		return profile.partner ?? {};
	}
	return profile.children?.[Number(individual.slice(5))] ?? {};
};

const withAnswer = (
	profile: Profile,
	{ individual, field }: FieldRef,
	value: AnswerValue | undefined,
): Profile => {
	const update = (answers: PersonAnswers) => {
		const { [field]: _previous, ...rest } = answers;
		return value === undefined ? rest : { ...rest, [field]: value };
	};
	if (individual === "citizen") {
		return { ...profile, answers: update(profile.answers) };
	}
	if (individual === "partner") {
		return { ...profile, partner: update(profile.partner ?? {}) };
	}
	const index = Number(individual.slice(5));
	const children = [...(profile.children ?? [])];
	children[index] = update(children[index] ?? {});
	return { ...profile, children };
};

/** Answers from this session's eligibility check fill what the stored profile does not have yet */
const withSessionAnswers = (
	stored: Profile,
	session: { answers: PersonAnswers; children: PersonAnswers[] },
): Profile => ({
	...stored,
	answers: { ...session.answers, ...stored.answers },
	children:
		stored.children && stored.children.length > 0
			? stored.children
			: session.children,
});

export const ApplicationWizard: React.FC = () => {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const lang = useDiscoveryLanguage();
	const { applicationId = "", step } = useParams<{
		applicationId: string;
		step: string;
	}>();
	const sessionAnswers = useDiscoveryStore((s) => s.answers);
	const sessionChildren = useDiscoveryStore((s) => s.children);
	const engine = getDiscoveryEngine();
	const containerRef = useRef<HTMLDivElement>(null);
	const [draft, setDraft] = useState<Profile>();
	// Typing only changes this copy; the saved draft, and with it the engine, changes on "Weiter"
	const [pendingState, setPendingState] = useState<{
		step?: string;
		profile: Profile;
	}>();
	const pending =
		pendingState && pendingState.step === step
			? pendingState.profile
			: undefined;
	const setPending = (profile: Profile) => setPendingState({ step, profile });
	const [error, setError] = useState<string>();
	const [isSaving, setIsSaving] = useState(false);

	const { data: stored } = useQuery({
		queryKey: STORED_PROFILE_KEY,
		queryFn: fetchStoredProfile,
	});

	useEffect(() => {
		if (stored && !draft) {
			setDraft(
				withSessionAnswers(profileFromBackend(engine, stored), {
					answers: sessionAnswers,
					children: sessionChildren,
				}),
			);
		}
	}, [stored, draft, engine, sessionAnswers, sessionChildren]);

	const { data: progress } = useQuery({
		queryKey: ["applicationProgress", applicationId, draft, lang],
		queryFn: () =>
			draft
				? engine.progress(draft, applicationId, {
						today: localDateToday(),
						lang,
					})
				: null,
		enabled: draft !== undefined,
		placeholderData: keepPreviousData,
		staleTime: Infinity,
	});

	useEffect(() => {
		window.scrollTo(0, 0);
		containerRef.current?.focus();
	}, [step]);

	const current = parseStep(step);
	const question: Question | undefined = useMemo(() => {
		const ref = parseStep(step);
		try {
			return ref ? engine.question(ref.field, lang, ref.individual) : undefined;
		} catch {
			return undefined;
		}
	}, [engine, step, lang]);

	if (!stored || !draft || !progress) {
		return null;
	}
	if (!current || !question) {
		return progress.next ? (
			<Navigate
				to={getKnowledgeApplicationRoute(applicationId, progress.next)}
				replace
			/>
		) : (
			<Navigate to={AppRoutes.Dashboard} replace />
		);
	}

	const working = pending ?? draft;
	const value = answersOf(working, current.individual)[current.field];
	const invalid = progress.invalid.find(
		(ref) =>
			ref.field === current.field && ref.individual === current.individual,
	);
	const ratio =
		progress.steps.length > 0
			? progress.answeredCount / progress.steps.length
			: 1;
	const position = progress.steps.findIndex(
		(ref) =>
			ref.field === current.field && ref.individual === current.individual,
	);
	const previous = position > 0 ? progress.steps[position - 1] : undefined;

	const setValue = (next: AnswerValue | undefined) => {
		setError(undefined);
		setPending(withAnswer(working, current, next));
	};

	const navigateNext = async () => {
		setIsSaving(true);
		setError(undefined);
		try {
			await saveStoredProfile(backendPatch(engine, working, stored));
			const fresh = await fetchStoredProfile();
			queryClient.setQueryData(STORED_PROFILE_KEY, fresh);
			setDraft(working);
			const next = await engine.progress(working, applicationId, {
				today: localDateToday(),
				lang,
			});
			const stillInvalid = next.invalid.find(
				(ref) =>
					ref.field === current.field && ref.individual === current.individual,
			);
			if (stillInvalid) {
				setError(stillInvalid.message);
				return;
			}
			navigate(
				next.next
					? getKnowledgeApplicationRoute(applicationId, next.next)
					: AppRoutes.Dashboard,
			);
		} catch (saveError) {
			setError((saveError as Error).message);
		} finally {
			setIsSaving(false);
		}
	};

	const sharedProps = {
		id: `${current.individual}-${question.id}`,
		question: question.question,
		category: question.category,
		tip: question.tip,
		onNext: () => {
			if (!isSaving) {
				void navigateNext();
			}
		},
	};

	const renderQuestion = () => {
		switch (question.datatype) {
			case "country":
				return (
					<CountryCard
						key={sharedProps.id}
						{...sharedProps}
						value={value as string | undefined}
						onChange={setValue}
						onClear={() => setValue(undefined)}
					/>
				);
			case "text":
				return (
					<TextCard
						key={sharedProps.id}
						{...sharedProps}
						value={value as string | undefined}
						onChange={setValue}
						onClear={() => setValue(undefined)}
					/>
				);
			case "euroAmount":
				return (
					<NumberCard
						key={sharedProps.id}
						{...sharedProps}
						value={value as number | undefined}
						onChange={setValue}
						onClear={() => setValue(undefined)}
					/>
				);
			case "date":
				return (
					<DateOfBirthCard
						key={sharedProps.id}
						{...sharedProps}
						value={value as string | undefined}
						onChange={setValue}
						onClear={() => setValue(undefined)}
					/>
				);
			case "childList":
				return (
					<ChildrenCard
						key={sharedProps.id}
						{...sharedProps}
						value={
							working.children && working.children.length > 0
								? working.children.map((child) => ({
										dateOfBirth: String(child.birthDate ?? ""),
									}))
								: undefined
						}
						onChange={(children) =>
							setPending({
								...working,
								children: children.map((child, index) => ({
									...working.children?.[index],
									birthDate: child.dateOfBirth,
								})),
							})
						}
						onClear={() => setPending({ ...working, children: [] })}
					/>
				);
			default:
				return (
					<QuestionCard
						key={sharedProps.id}
						{...sharedProps}
						options={question.options.map((option) => option.code ?? option.id)}
						optionLabels={Object.fromEntries(
							question.options.map((option) => [
								option.code ?? option.id,
								option.label,
							]),
						)}
						value={
							question.options.find((option) => option.value === value)?.code
						}
						onChange={(code) =>
							setValue(
								question.options.find(
									(option) => (option.code ?? option.id) === code,
								)?.value,
							)
						}
					/>
				);
		}
	};

	const message = error ?? invalid?.message;

	return (
		<div
			ref={containerRef}
			tabIndex={-1}
			className="outline-none w-full flex flex-col items-center min-h-full bg-white flex-grow"
		>
			<StepLayout
				onBack={() =>
					navigate(
						previous
							? getKnowledgeApplicationRoute(applicationId, previous)
							: AppRoutes.Dashboard,
					)
				}
				backAriaLabel={t(i18nKeys.common.back)}
				backTestId="back-button"
				colorVariant="blue"
				width="wide"
			>
				<ProgressBar progress={ratio} />
				{message && (
					<div
						className="mb-4 w-full rounded-lg border border-red-200 bg-red-100 p-4 text-sm text-red-700 shadow-sm"
						role="alert"
						data-testid="wizard-error"
					>
						{message}
					</div>
				)}
				{renderQuestion()}
			</StepLayout>
		</div>
	);
};
