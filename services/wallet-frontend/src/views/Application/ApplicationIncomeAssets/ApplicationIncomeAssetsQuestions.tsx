import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useProfile } from "../../../hooks/useProfile";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { AppRoutes } from "../../../constants/routes";
import type {
	FinancialData,
	IncomeEntry,
	PersonalData,
} from "../../../schemas/profile.schema";
import { PageContainer } from "../../../components/Layout/PageContainer";
import { useScrollToTop, scrollToTop } from "../../../utils/scroll";
import {
	END_PAGE,
	OTHER_INCOME_TYPES,
	PENSION_INCOME_TYPES,
	employmentRows,
	getNextPage,
	hasInvalidAmount,
	incomeRows,
	isInvalidAmount,
	isWithoutEmployment,
	parseAmount,
	storedEmploymentIncome,
	storedIncomeAmounts,
	storedIncomeOptions,
	totalIncome,
	type IncomeAmounts,
	type WizardSaveResult,
} from "./incomeAssetsHelpers";
import { AwaitingBenefitsStep } from "./AwaitingBenefitsStep";
import { PreviousBenefitsStep } from "./PreviousBenefitsStep";
import { PensionStep } from "./PensionStep";
import { EmploymentStep } from "./EmploymentStep";
import { OtherIncomeStep } from "./OtherIncomeStep";
import { OneTimePaymentsStep } from "./OneTimePaymentsStep";
import { BankDetailsStep } from "./BankDetailsStep";

export const ApplicationIncomeAssetsQuestions: React.FC = () => {
	const { t } = useTranslation(["application", "profile", "common"]);
	const navigate = useNavigate();
	const location = useLocation();
	const state = location.state as {
		extractedData?: Record<string, string | number | null>;
	} | null;
	const extracted = state?.extractedData;
	const { profileData, updateSection, isUpdating, refetch, isLoading } =
		useProfile();
	const isInitializedRef = useRef(false);

	const [currentPage, setCurrentPage] = useState<number>(1);
	const [saveSuccess, setSaveSuccess] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);
	const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

	// Q1: Awaiting benefits
	const [
		hasAppliedForBenefitsAwaitingDecision,
		setHasAppliedForBenefitsAwaitingDecision,
	] = useState<boolean | null>(null);
	const [benefitsAwaitingDecisionType, setBenefitsAwaitingDecisionType] =
		useState<string>("");
	const [
		benefitsAwaitingDecisionApplicationDate,
		setBenefitsAwaitingDecisionApplicationDate,
	] = useState<string>("");
	const [benefitsAwaitingDecisionOffice, setBenefitsAwaitingDecisionOffice] =
		useState<string>("");
	const [
		benefitsAwaitingDecisionReference,
		setBenefitsAwaitingDecisionReference,
	] = useState<string>("");

	// Q2: Previous benefits
	const [hasReceivedPreviousBenefits, setHasReceivedPreviousBenefits] =
		useState<boolean | null>(null);
	const [previousBenefitsPeriod, setPreviousBenefitsPeriod] =
		useState<string>("");
	const [previousBenefitsAuthority, setPreviousBenefitsAuthority] =
		useState<string>("");
	const [previousBenefitsRefNo, setPreviousBenefitsRefNo] =
		useState<string>("");

	// Q3: Pension
	const [pensionTypes, setPensionTypes] = useState<string[]>([]);
	const [pensionAmounts, setPensionAmounts] = useState<IncomeAmounts>({});

	// Q4: Employment
	const [employmentType, setEmploymentType] = useState<string>("");
	const [jobTitle, setJobTitle] = useState("");
	const [employerName, setEmployerName] = useState("");
	const [employmentAmount, setEmploymentAmount] = useState<string>("");

	// Q5: Other income
	const [otherIncomeTypes, setOtherIncomeTypes] = useState<string[]>([]);
	const [otherIncomeAmounts, setOtherIncomeAmounts] = useState<IncomeAmounts>(
		{},
	);

	// Q6: One-time payments
	const [areOneTimePaymentsExpected, setAreOneTimePaymentsExpected] = useState<
		boolean | null
	>(null);
	const [oneTimePaymentsExpectedType, setOneTimePaymentsExpectedType] =
		useState<string>("");
	const [oneTimePaymentsExpectedAmount, setOneTimePaymentsExpectedAmount] =
		useState<string>("");
	const [oneTimePaymentsExpectedDate, setOneTimePaymentsExpectedDate] =
		useState<string>("");

	// Q7: Bank details
	const [bankName, setBankName] = useState("");
	const [accountHolder, setAccountHolder] = useState("");
	const [iban, setIban] = useState("");
	const [bic, setBic] = useState("");

	useScrollToTop(currentPage);

	const initPension = React.useCallback(
		(entries: IncomeEntry[]) => {
			const stored = storedIncomeOptions(PENSION_INCOME_TYPES, entries);
			const extractedAmount =
				extracted?.monthly_income ||
				extracted?.monthly_amount ||
				extracted?.amount_pension;
			// a pension notice the user just uploaded fills an unanswered page
			if (stored.length === 0 && extractedAmount) {
				setPensionTypes(["retirement"]);
				setPensionAmounts({ retirement: String(extractedAmount) });
				return;
			}
			setPensionTypes(stored);
			setPensionAmounts(storedIncomeAmounts(PENSION_INCOME_TYPES, entries));
		},
		[extracted],
	);

	const initEmployment = React.useCallback(
		(entries: IncomeEntry[], personal: Partial<PersonalData>) => {
			const { isSelfEmployed, amount } = storedEmploymentIncome(entries);
			if (isSelfEmployed) {
				setEmploymentType("self_employed");
			} else if (
				personal.isCurrentlyEmployed !== null &&
				personal.isCurrentlyEmployed !== undefined
			) {
				setEmploymentType(
					personal.isCurrentlyEmployed ? "employed" : "unemployed",
				);
			}
			setJobTitle(personal.workScopeAndType || "");
			setEmployerName(personal.employerName || "");
			setEmploymentAmount(amount);
		},
		[],
	);

	const initOther = React.useCallback((entries: IncomeEntry[]) => {
		setOtherIncomeTypes(storedIncomeOptions(OTHER_INCOME_TYPES, entries));
		setOtherIncomeAmounts(storedIncomeAmounts(OTHER_INCOME_TYPES, entries));
	}, []);

	const initIncomeAssets = React.useCallback(() => {
		const financial: Partial<FinancialData> = profileData?.financial ?? {};
		const personal: Partial<PersonalData> = profileData?.personalData ?? {};
		const incomeEntries = financial.incomeEntries ?? [];

		const setAwaiting = () => {
			setHasAppliedForBenefitsAwaitingDecision(
				financial.hasAppliedForBenefitsAwaitingDecision ?? null,
			);
			setBenefitsAwaitingDecisionType(
				financial.benefitsAwaitingDecisionType || "",
			);
			setBenefitsAwaitingDecisionApplicationDate(
				financial.benefitsAwaitingDecisionApplicationDate || "",
			);
			setBenefitsAwaitingDecisionOffice(
				financial.benefitsAwaitingDecisionOffice || "",
			);
			setBenefitsAwaitingDecisionReference(
				financial.benefitsAwaitingDecisionReference || "",
			);
		};

		const setPrevious = () => {
			setHasReceivedPreviousBenefits(
				personal.hasReceivedPreviousBenefits ?? null,
			);
			setPreviousBenefitsPeriod(personal.previousBenefitsPeriod || "");
			setPreviousBenefitsAuthority(personal.previousBenefitsAuthority || "");
			setPreviousBenefitsRefNo(personal.previousBenefitsRefNo || "");
		};

		const setOneTime = () => {
			setAreOneTimePaymentsExpected(
				financial.areOneTimePaymentsExpected ?? null,
			);
			setOneTimePaymentsExpectedType(
				financial.oneTimePaymentsExpectedType || "",
			);
			setOneTimePaymentsExpectedAmount(
				financial.oneTimePaymentsExpectedAmount !== undefined &&
					financial.oneTimePaymentsExpectedAmount !== null
					? String(financial.oneTimePaymentsExpectedAmount)
					: "",
			);
			setOneTimePaymentsExpectedDate(
				financial.oneTimePaymentsExpectedDate || "",
			);
		};

		// eslint-disable-next-line complexity
		const setBank = () => {
			if (
				extracted &&
				(extracted.iban || extracted.account_holder || extracted.bank_name)
			) {
				setBankName(
					String(extracted.bank_name || financial.bankDetails?.bankName || ""),
				);
				setAccountHolder(
					String(
						extracted.account_holder ||
							financial.bankDetails?.accountHolder ||
							"",
					),
				);
				setIban(String(extracted.iban || financial.bankDetails?.iban || ""));
				setBic(String(extracted.bic || financial.bankDetails?.bic || ""));
			} else if (financial.bankDetails) {
				setBankName(financial.bankDetails.bankName || "");
				setAccountHolder(financial.bankDetails.accountHolder || "");
				setIban(financial.bankDetails.iban || "");
				setBic(financial.bankDetails.bic || "");
			} else {
				const banking =
					(profileData as unknown as { banking?: Record<string, string> })
						?.banking ?? {};
				setBankName(banking.bankName || "");
				setAccountHolder(banking.accountHolder || "");
				setIban(banking.iban || "");
				setBic(banking.bic || "");
			}
		};

		setAwaiting();
		setPrevious();
		initPension(incomeEntries);
		initEmployment(incomeEntries, personal);
		initOther(incomeEntries);
		setOneTime();
		setBank();

		isInitializedRef.current = true;
	}, [profileData, initPension, initEmployment, initOther, extracted]);

	useEffect(() => {
		if (profileData && !isInitializedRef.current) {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			initIncomeAssets();
		}
	}, [profileData, initIncomeAssets]);

	useEffect(() => {
		if (saveError || Object.keys(fieldErrors).length > 0) {
			scrollToTop("smooth");
		}
	}, [saveError, fieldErrors]);

	useEffect(() => {
		void refetch();
	}, [refetch]);

	const handleValidationErrors = (
		errors?: Array<{ field_path: string; message: string }>,
	) => {
		if (!errors) {
			setFieldErrors({});
			return;
		}
		const errs: Record<string, string> = {};
		errors.forEach((err) => {
			errs[err.field_path] = err.message;
		});
		setFieldErrors(errs);
	};

	const clearErrors = () => {
		setSaveError(null);
		setFieldErrors({});
	};

	const goToNextPage = (result: WizardSaveResult, fallbackPage: number) => {
		setSaveSuccess(true);
		setTimeout(() => setSaveSuccess(false), 800);
		const next = getNextPage(result, fallbackPage);
		if (next === END_PAGE) {
			navigate(AppRoutes.ApplicationOverview);
		} else {
			setCurrentPage(next);
		}
	};

	const saveAndContinue = async (
		section: "financial" | "personalData",
		data: Partial<FinancialData> | Partial<PersonalData>,
		fallbackPage: number,
	): Promise<boolean> => {
		try {
			const result = await updateSection({
				section,
				data: { ...data, validateEntireForm: false },
			});
			if (result.success) {
				goToNextPage(result as WizardSaveResult, fallbackPage);
			} else {
				handleValidationErrors(result.validationErrors);
				setSaveError(result.message || t("profile:errors.save_failed"));
			}
			return result.success;
		} catch (_error) {
			setSaveError(t("profile:errors.save_failed"));
			return false;
		}
	};

	const saveAwaitingBenefits = () => {
		clearErrors();
		const awaiting = hasAppliedForBenefitsAwaitingDecision;
		void saveAndContinue(
			"financial",
			{
				hasAppliedForBenefitsAwaitingDecision: awaiting,
				benefitsAwaitingDecisionType: awaiting
					? benefitsAwaitingDecisionType
					: null,
				benefitsAwaitingDecisionApplicationDate:
					awaiting && benefitsAwaitingDecisionApplicationDate
						? benefitsAwaitingDecisionApplicationDate
						: null,
				benefitsAwaitingDecisionOffice: awaiting
					? benefitsAwaitingDecisionOffice
					: null,
				benefitsAwaitingDecisionReference: awaiting
					? benefitsAwaitingDecisionReference
					: null,
			},
			2,
		);
	};

	const savePreviousBenefits = () => {
		clearErrors();
		const received = hasReceivedPreviousBenefits;
		void saveAndContinue(
			"personalData",
			{
				hasReceivedPreviousBenefits: received,
				previousBenefitsPeriod: received ? previousBenefitsPeriod : null,
				previousBenefitsAuthority: received ? previousBenefitsAuthority : null,
				previousBenefitsRefNo: received ? previousBenefitsRefNo : null,
			},
			3,
		);
	};

	const savePension = () => {
		clearErrors();
		if (hasInvalidAmount(pensionTypes, pensionAmounts)) {
			setSaveError(t("financial.errors.pension_amount_invalid"));
			return;
		}
		void saveAndContinue(
			"financial",
			{
				incomeEntries: incomeRows(
					PENSION_INCOME_TYPES,
					pensionTypes,
					pensionAmounts,
				),
			},
			4,
		);
	};

	const saveEmployment = async () => {
		clearErrors();
		if (isInvalidAmount(employmentAmount)) {
			setSaveError(t("financial.errors.employment_amount_invalid"));
			return;
		}

		const isEmployed = employmentType
			? !isWithoutEmployment(employmentType)
			: null;

		try {
			const result = await updateSection({
				section: "personalData",
				data: {
					isCurrentlyEmployed: isEmployed,
					workScopeAndType: isEmployed ? jobTitle.trim() || null : null,
					employerName: isEmployed ? employerName.trim() || null : null,
					validateEntireForm: false,
				},
			});
			if (!result.success) {
				handleValidationErrors(result.validationErrors);
				setSaveError(result.message || t("profile:errors.save_failed"));
				return;
			}
		} catch (_error) {
			setSaveError(t("profile:errors.save_failed"));
			return;
		}

		await saveAndContinue(
			"financial",
			{ incomeEntries: employmentRows(employmentType, employmentAmount) },
			5,
		);
	};

	const saveOtherIncome = () => {
		clearErrors();
		if (hasInvalidAmount(otherIncomeTypes, otherIncomeAmounts)) {
			setSaveError(t("financial.errors.other_income_amount_invalid"));
			return;
		}
		void saveAndContinue(
			"financial",
			{
				incomeEntries: incomeRows(
					OTHER_INCOME_TYPES,
					otherIncomeTypes,
					otherIncomeAmounts,
				),
			},
			6,
		);
	};

	const saveOneTimePayments = () => {
		clearErrors();
		const expected = areOneTimePaymentsExpected;
		const amountInput = expected ? oneTimePaymentsExpectedAmount : "";
		if (isInvalidAmount(amountInput)) {
			setSaveError(t("financial.errors.one_time_amount_invalid"));
			return;
		}
		void saveAndContinue(
			"financial",
			{
				areOneTimePaymentsExpected: expected,
				oneTimePaymentsExpectedType: expected
					? oneTimePaymentsExpectedType
					: null,
				oneTimePaymentsExpectedAmount: amountInput.trim()
					? parseAmount(amountInput)
					: null,
				oneTimePaymentsExpectedDate: expected
					? oneTimePaymentsExpectedDate
					: null,
			},
			7,
		);
	};

	const saveBankDetails = async () => {
		clearErrors();
		const normalizedIban = iban.replace(/\s+/g, "").toUpperCase();
		if (
			normalizedIban &&
			!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{12,30}$/i.test(normalizedIban)
		) {
			setFieldErrors({
				iban: t("financial.errors.bank_iban_invalid"),
			});
			setSaveError(t("financial.errors.bank_iban_invalid"));
			return;
		}

		const monthlyIncome = totalIncome([
			...incomeRows(PENSION_INCOME_TYPES, pensionTypes, pensionAmounts),
			...employmentRows(employmentType, employmentAmount),
			...incomeRows(OTHER_INCOME_TYPES, otherIncomeTypes, otherIncomeAmounts),
		]);

		try {
			const result = await updateSection({
				section: "financial",
				data: {
					bankDetails: {
						bankName: bankName.trim() || null,
						accountHolder: accountHolder.trim() || null,
						iban: normalizedIban || null,
						bic: bic.replace(/\s+/g, "").toUpperCase() || null,
					},
					...(monthlyIncome !== null && { monthlyIncome }),
					validateEntireForm: false,
				},
			});
			if (result.success) {
				navigate(AppRoutes.ApplicationOverview);
			} else {
				handleValidationErrors(result.validationErrors);
				setSaveError(result.message || t("profile:errors.save_failed"));
			}
		} catch (_error) {
			setSaveError(t("profile:errors.save_failed"));
		}
	};

	const handleBack = () => {
		if (currentPage > 1) {
			setCurrentPage(currentPage - 1);
			clearErrors();
		} else {
			navigate(AppRoutes.ApplicationIncomeAssetsIntro);
		}
	};

	if (isLoading && !profileData) {
		return (
			<PageContainer topBarProps={{ showLanguageSwitcher: true }}>
				<div className="flex items-center justify-center min-h-[50vh]">
					<Loader2 className="w-8 h-8 animate-spin text-slate-500" />
				</div>
			</PageContainer>
		);
	}

	return (
		<PageContainer
			topBarProps={{
				onBack: handleBack,
				showLanguageSwitcher: true,
				className: "lg:max-w-[1152px] lg:px-8 xl:px-16 lg:pt-4",
			}}
			contentClassName="lg:max-w-[1152px] lg:px-8 xl:px-16 lg:pb-16"
		>
			{(isUpdating || saveSuccess) && (
				<div
					role="status"
					className="fixed top-6 z-50 flex items-center gap-2.5 bg-white px-5 py-2.5 rounded-full shadow-xl border border-slate-100 lg:left-[calc(50%+var(--spacing)*36)] lg:-translate-x-1/2"
				>
					{isUpdating ? (
						<>
							<Loader2 className="w-4 h-4 animate-spin text-slate-800" />
							<span className="text-xs font-bold text-slate-800">
								{t("profile:personal.actions.saving")}
							</span>
						</>
					) : (
						<>
							<CheckCircle2 className="w-4 h-4 text-green-600" />
							<span className="text-xs font-bold text-slate-800">
								{t("profile:personal.actions.saved")}
							</span>
						</>
					)}
				</div>
			)}

			{saveError && (
				<div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-900 font-medium w-full max-w-md mb-4 text-sm animate-fadeIn lg:max-w-180 lg:mx-auto">
					<AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />
					<p>{saveError}</p>
				</div>
			)}

			<div className="w-full max-w-md flex flex-col gap-6 text-left lg:max-w-180 lg:mx-auto lg:bg-white lg:rounded-3xl lg:border lg:border-brand-border-subtle lg:shadow-cards lg:px-10 lg:py-8">
				{/* STEP 1: Awaiting benefits decision */}
				{currentPage === 1 && (
					<AwaitingBenefitsStep
						hasAppliedForBenefitsAwaitingDecision={
							hasAppliedForBenefitsAwaitingDecision
						}
						setHasAppliedForBenefitsAwaitingDecision={
							setHasAppliedForBenefitsAwaitingDecision
						}
						benefitsAwaitingDecisionType={benefitsAwaitingDecisionType}
						setBenefitsAwaitingDecisionType={setBenefitsAwaitingDecisionType}
						benefitsAwaitingDecisionApplicationDate={
							benefitsAwaitingDecisionApplicationDate
						}
						setBenefitsAwaitingDecisionApplicationDate={
							setBenefitsAwaitingDecisionApplicationDate
						}
						benefitsAwaitingDecisionOffice={benefitsAwaitingDecisionOffice}
						setBenefitsAwaitingDecisionOffice={
							setBenefitsAwaitingDecisionOffice
						}
						benefitsAwaitingDecisionReference={
							benefitsAwaitingDecisionReference
						}
						setBenefitsAwaitingDecisionReference={
							setBenefitsAwaitingDecisionReference
						}
						onContinue={saveAwaitingBenefits}
					/>
				)}

				{/* STEP 2: Previous benefits received */}
				{currentPage === 2 && (
					<PreviousBenefitsStep
						hasReceivedPreviousBenefits={hasReceivedPreviousBenefits}
						setHasReceivedPreviousBenefits={setHasReceivedPreviousBenefits}
						previousBenefitsPeriod={previousBenefitsPeriod}
						setPreviousBenefitsPeriod={setPreviousBenefitsPeriod}
						previousBenefitsAuthority={previousBenefitsAuthority}
						setPreviousBenefitsAuthority={setPreviousBenefitsAuthority}
						previousBenefitsRefNo={previousBenefitsRefNo}
						setPreviousBenefitsRefNo={setPreviousBenefitsRefNo}
						onContinue={savePreviousBenefits}
					/>
				)}

				{/* STEP 3: Pension Status */}
				{currentPage === 3 && (
					<PensionStep
						pensionTypes={pensionTypes}
						setPensionTypes={setPensionTypes}
						pensionAmounts={pensionAmounts}
						setPensionAmount={(pensionType, amount) =>
							setPensionAmounts({ ...pensionAmounts, [pensionType]: amount })
						}
						onContinue={savePension}
					/>
				)}

				{/* STEP 4: Employment Status */}
				{currentPage === 4 && (
					<EmploymentStep
						employmentStatus={employmentType}
						setEmploymentStatus={setEmploymentType}
						jobTitle={jobTitle}
						setJobTitle={setJobTitle}
						employerName={employerName}
						setEmployerName={setEmployerName}
						incomeAmount={employmentAmount}
						setIncomeAmount={setEmploymentAmount}
						onContinue={saveEmployment}
					/>
				)}

				{/* STEP 5: Other regular monthly income */}
				{currentPage === 5 && (
					<OtherIncomeStep
						otherIncomeTypes={otherIncomeTypes}
						setOtherIncomeTypes={setOtherIncomeTypes}
						otherIncomeAmounts={otherIncomeAmounts}
						setOtherIncomeAmount={(incomeType, amount) =>
							setOtherIncomeAmounts({
								...otherIncomeAmounts,
								[incomeType]: amount,
							})
						}
						onContinue={saveOtherIncome}
					/>
				)}

				{/* STEP 6: Expected one-time payments */}
				{currentPage === 6 && (
					<OneTimePaymentsStep
						areOneTimePaymentsExpected={areOneTimePaymentsExpected}
						setAreOneTimePaymentsExpected={setAreOneTimePaymentsExpected}
						oneTimePaymentsExpectedType={oneTimePaymentsExpectedType}
						setOneTimePaymentsExpectedType={setOneTimePaymentsExpectedType}
						oneTimePaymentsExpectedAmount={oneTimePaymentsExpectedAmount}
						setOneTimePaymentsExpectedAmount={setOneTimePaymentsExpectedAmount}
						oneTimePaymentsExpectedDate={oneTimePaymentsExpectedDate}
						setOneTimePaymentsExpectedDate={setOneTimePaymentsExpectedDate}
						onContinue={saveOneTimePayments}
					/>
				)}

				{/* STEP 7: Bank Details */}
				{currentPage === 7 && (
					<BankDetailsStep
						accountHolder={accountHolder}
						setAccountHolder={setAccountHolder}
						bankName={bankName}
						setBankName={setBankName}
						iban={iban}
						setIban={setIban}
						bic={bic}
						setBic={setBic}
						fieldErrors={fieldErrors}
						setFieldErrors={setFieldErrors}
						onContinue={saveBankDetails}
					/>
				)}
			</div>
		</PageContainer>
	);
};
