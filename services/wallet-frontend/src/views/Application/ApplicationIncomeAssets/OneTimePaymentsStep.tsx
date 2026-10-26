import React from "react";
import { useTranslation } from "react-i18next";
import { OptionCard } from "../../../components/ui/OptionCard";
import { PrimaryButton } from "../../../components/ui/PrimaryButton";

interface OneTimePaymentsStepProps {
	areOneTimePaymentsExpected: boolean | null;
	setAreOneTimePaymentsExpected: (val: boolean | null) => void;
	oneTimePaymentsExpectedType: string;
	setOneTimePaymentsExpectedType: (val: string) => void;
	oneTimePaymentsExpectedAmount: string;
	setOneTimePaymentsExpectedAmount: (val: string) => void;
	oneTimePaymentsExpectedDate: string;
	setOneTimePaymentsExpectedDate: (val: string) => void;
	onContinue: () => void;
}

export const OneTimePaymentsStep: React.FC<OneTimePaymentsStepProps> = ({
	areOneTimePaymentsExpected,
	setAreOneTimePaymentsExpected,
	oneTimePaymentsExpectedType,
	setOneTimePaymentsExpectedType,
	oneTimePaymentsExpectedAmount,
	setOneTimePaymentsExpectedAmount,
	oneTimePaymentsExpectedDate,
	setOneTimePaymentsExpectedDate,
	onContinue,
}) => {
	const { t } = useTranslation("application");

	return (
		<div className="flex flex-col gap-5">
			<h1 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight lg:text-[2rem] lg:leading-10">
				{t("financial.questions.one_time_payment_title")}
			</h1>
			<div className="flex flex-col gap-3">
				<OptionCard
					id="yes"
					title={t("financial.options.yes")}
					selected={areOneTimePaymentsExpected === true}
					onClick={() => setAreOneTimePaymentsExpected(true)}
				/>
				<OptionCard
					id="no"
					title={t("financial.options.no")}
					selected={areOneTimePaymentsExpected === false}
					onClick={() => setAreOneTimePaymentsExpected(false)}
				/>
			</div>

			{areOneTimePaymentsExpected && (
				<div className="flex flex-col gap-4 mt-2 p-5 bg-slate-50 rounded-2xl border border-slate-100 animate-fadeIn">
					<div className="flex flex-col gap-1.5">
						<label
							htmlFor="one-time-payment-type"
							className="text-xs font-extrabold text-slate-800"
						>
							{t("financial.questions.one_time_payment_type_label")}
						</label>
						<input
							id="one-time-payment-type"
							type="text"
							value={oneTimePaymentsExpectedType}
							onChange={(e) => setOneTimePaymentsExpectedType(e.target.value)}
							placeholder={t(
								"financial.questions.one_time_payment_type_placeholder",
							)}
							className="p-3.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary-blue-500 focus:outline-none"
						/>
					</div>
					<div className="flex flex-col gap-1.5">
						<label
							htmlFor="one-time-payment-amount"
							className="text-xs font-extrabold text-slate-800"
						>
							{t("financial.questions.one_time_payment_amount_label")}
						</label>
						<div className="relative">
							<span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-brand-grey">
								€
							</span>
							<input
								id="one-time-payment-amount"
								type="text"
								value={oneTimePaymentsExpectedAmount}
								onChange={(e) =>
									setOneTimePaymentsExpectedAmount(e.target.value)
								}
								placeholder={t(
									"financial.questions.one_time_payment_amount_placeholder",
								)}
								className="w-full pl-8 pr-4 py-3.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-primary-blue-500 focus:outline-none"
							/>
						</div>
					</div>
					<div className="flex flex-col gap-1.5">
						<label
							htmlFor="one-time-payment-date"
							className="text-xs font-extrabold text-slate-800"
						>
							{t("financial.questions.one_time_payment_date_label")}
						</label>
						<input
							id="one-time-payment-date"
							type="date"
							value={oneTimePaymentsExpectedDate}
							onChange={(e) => setOneTimePaymentsExpectedDate(e.target.value)}
							className="p-3.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary-blue-500 focus:outline-none"
						/>
					</div>
				</div>
			)}
			<PrimaryButton
				className="lg:flex lg:w-fit lg:min-w-44 lg:ml-auto"
				onClick={onContinue}
			>
				{t("financial.intro.continue")}
			</PrimaryButton>
		</div>
	);
};
