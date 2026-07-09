import React from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import * as Icons from "../ui/Icons";
import { PrimaryButton } from "../ui/PrimaryButton";
import { useAuthStore } from "../../store/useAuthStore";

interface RegistrationSuccessProps {
	onComplete: () => void;
}

export const RegistrationSuccess: React.FC<RegistrationSuccessProps> = ({
	onComplete,
}) => {
	const { t } = useTranslation("auth");
	const phoneNumber = useAuthStore((s) => s.phoneNumber);

	return (
		<div
			className="w-full max-w-sm flex flex-col items-center relative"
			data-testid="registration-success"
		>
			<div className="size-24 bg-white rounded-full flex items-center justify-center mb-10 shadow-sm border border-brand-border/10">
				<div className="size-14 text-brand-primary">
					<Icons.CheckCircleIcon className="size-full" />
				</div>
			</div>

			<div className="mb-10 text-center flex flex-col gap-4">
				<h1
					className="text-brand-black text-h1 font-bold leading-tight m-0 p-0"
					data-testid="success-title"
				>
					{t("success_title")}
				</h1>
				<p className="text-brand-black text-body-lg leading-relaxed m-0 p-0">
					{t("success_desc")}
				</p>
			</div>

			<div className="w-full bg-white border-brand-border/40 border rounded-2xl p-6 mb-10">
				<div className="flex flex-col gap-5">
					<BenefitItem
						title={t("benefit_verified")}
						subtitle={t("benefit_verified_sub", {
							phone: phoneNumber || "+49 176 12345678",
						})}
					/>
					<BenefitItem
						title={t("benefit_secure")}
						subtitle={t("benefit_secure_sub")}
					/>
					<BenefitItem
						title={t("benefit_ready")}
						subtitle={t("benefit_ready_sub")}
					/>
				</div>
			</div>

			<div className="w-full flex flex-col items-center gap-6">
				<PrimaryButton
					data-testid="registration-success-next-button"
					onClick={onComplete}
				>
					{t("next")}
				</PrimaryButton>
			</div>
		</div>
	);
};

const BenefitItem: React.FC<{ title: string; subtitle?: string }> = ({
	title,
	subtitle,
}) => (
	<div className="flex items-start gap-4 w-full">
		<div className="shrink-0 size-5 bg-green-500/10 rounded-full flex items-center justify-center mt-0.5">
			<Check className="size-3.5 text-green-600" strokeWidth={3} />
		</div>
		<div className="flex flex-col gap-0.5">
			<span className="text-base font-bold text-brand-black leading-tight">
				{title}
			</span>
			{subtitle && (
				<span className="text-sm text-brand-black leading-tight font-medium">
					{subtitle}
				</span>
			)}
		</div>
	</div>
);
