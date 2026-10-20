import React from "react";
import { useTranslation } from "react-i18next";
import { PrimaryButton } from "../../../components/ui/PrimaryButton";

interface BankDetailsStepProps {
	bankName: string;
	setBankName: (val: string) => void;
	accountHolder: string;
	setAccountHolder: (val: string) => void;
	iban: string;
	setIban: (val: string) => void;
	bic: string;
	setBic: (val: string) => void;
	fieldErrors: Record<string, string>;
	setFieldErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
	onContinue: () => void;
}

export const BankDetailsStep: React.FC<BankDetailsStepProps> = ({
	bankName,
	setBankName,
	accountHolder,
	setAccountHolder,
	iban,
	setIban,
	bic,
	setBic,
	fieldErrors,
	setFieldErrors,
	onContinue,
}) => {
	const { t } = useTranslation("application");

	return (
		<div className="flex flex-col gap-5">
			<h1 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight lg:text-[2rem] lg:leading-10">
				{t("financial.questions.bank_title")}
			</h1>

			<div className="flex flex-col gap-4 mt-2 p-5 bg-slate-50 rounded-2xl border border-slate-100">
				<div className="flex flex-col gap-1.5">
					<label
						htmlFor="account-holder"
						className="text-xs font-extrabold text-slate-800"
					>
						{t("financial.questions.account_holder_label")}
					</label>
					<input
						id="account-holder"
						type="text"
						value={accountHolder}
						onChange={(e) => setAccountHolder(e.target.value)}
						placeholder={t("financial.questions.account_holder_placeholder")}
						className="p-3.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary-blue-500 focus:outline-none"
					/>
				</div>

				<div className="flex flex-col gap-1.5">
					<label
						htmlFor="bank-name"
						className="text-xs font-extrabold text-slate-800"
					>
						{t("financial.questions.bank_name_label")}
					</label>
					<input
						id="bank-name"
						type="text"
						value={bankName}
						onChange={(e) => setBankName(e.target.value)}
						placeholder={t("financial.questions.bank_name_placeholder")}
						className="p-3.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary-blue-500 focus:outline-none"
					/>
				</div>

				<div className="flex flex-col gap-1.5">
					<label
						htmlFor="iban"
						className="text-xs font-extrabold text-slate-800"
					>
						{t("financial.questions.iban_label")}
					</label>
					<input
						id="iban"
						type="text"
						value={iban}
						onChange={(e) => {
							setIban(e.target.value.toUpperCase());
							if (fieldErrors.iban) {
								setFieldErrors((prev) => {
									const copy = { ...prev };
									delete copy.iban;
									return copy;
								});
							}
						}}
						placeholder={t("financial.questions.iban_placeholder")}
						className={`p-3.5 bg-white border rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary-blue-500 focus:outline-none ${fieldErrors.iban ? "border-rose-500" : "border-slate-200"}`}
					/>
					{fieldErrors.iban && (
						<span className="text-xs text-rose-500 font-semibold px-1 mt-0.5">
							{fieldErrors.iban}
						</span>
					)}
				</div>

				<div className="flex flex-col gap-1.5">
					<label
						htmlFor="bic"
						className="text-xs font-extrabold text-slate-800"
					>
						{t("financial.questions.bic_label")}
					</label>
					<input
						id="bic"
						type="text"
						value={bic}
						onChange={(e) => setBic(e.target.value.toUpperCase())}
						placeholder={t("financial.questions.bic_placeholder")}
						className="p-3.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary-blue-500 focus:outline-none"
					/>
				</div>
			</div>

			<PrimaryButton
				className="lg:flex lg:w-fit lg:min-w-44 lg:ml-auto"
				onClick={onContinue}
				disabled={!accountHolder || !bankName || !iban}
			>
				{t("financial.questions.submit_cta")}
			</PrimaryButton>
		</div>
	);
};
