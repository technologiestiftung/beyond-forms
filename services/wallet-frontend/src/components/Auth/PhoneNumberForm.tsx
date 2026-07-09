import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { PhoneNumberSchema } from "../../schemas/auth.schema";
import type { PhoneNumber } from "../../schemas/auth.schema";
import { useAuthStore, type AuthStatus } from "../../store/useAuthStore";
import * as Icons from "../ui/Icons";
import { COUNTRY_CODES } from "../../constants/countries";
import { motion } from "framer-motion";
import { PrimaryButton } from "../ui/PrimaryButton";
import { Info } from "lucide-react";

export const PhoneNumberForm: React.FC = () => {
	const { t } = useTranslation("auth");
	const login = useAuthStore((s) => s.login);
	const status: AuthStatus = useAuthStore((s) => s.status);
	const error = useAuthStore((s) => s.error);

	const [countryCode, setCountryCode] = useState("+49");
	const [localNumber, setLocalNumber] = useState("");
	const [localError, setLocalError] = useState<string | null>(null);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLocalError(null);

		const fullNumber = `${countryCode}${localNumber.replace(/^0+/, "").replace(/\s+/g, "")}`;
		const result = PhoneNumberSchema.safeParse(fullNumber);

		if (!result.success) {
			const messageKey = result.error.issues[0].message;
			setLocalError(t(messageKey as string));
			return;
		}

		void login(result.data as PhoneNumber);
	};

	const isVerifying = status === "VERIFYING_USERNAME";

	return (
		<div
			className="w-full max-w-sm flex flex-col items-center relative"
			data-testid="phone-number-form"
		>
			<div className="size-24 bg-white rounded-full flex items-center justify-center mb-10 shadow-sm border border-brand-border/10">
				<div className="size-14 text-brand-primary">
					<Icons.PhoneIcon className="size-full" />
				</div>
			</div>

			<div className="mb-10 text-center flex flex-col gap-4">
				<h1 className="text-brand-black text-h1 font-bold leading-tight m-0 p-0">
					{t("phone_title")}
				</h1>
				<p className="text-brand-black text-body-lg leading-relaxed m-0 p-0">
					{t("phone_desc")}
				</p>
			</div>

			<form
				onSubmit={(e) => {
					void handleSubmit(e);
				}}
				className="w-full flex flex-col gap-2"
			>
				<label
					htmlFor="phone"
					className="text-brand-black text-sm font-bold uppercase tracking-wider mb-1"
				>
					{t("phone_label")}
				</label>

				<div className="flex gap-2 w-full mb-6">
					<div className="relative shrink-0">
						<select
							data-testid="country-code-select"
							aria-label={t("country_code")}
							value={countryCode}
							onChange={(e) => {
								setCountryCode(e.target.value);
							}}
							disabled={isVerifying}
							className="appearance-none h-14 pl-5 pr-12 bg-white border-brand-border/30 border-2 rounded-2xl text-lg font-bold text-brand-black focus:border-brand-primary outline-none transition-all disabled:opacity-50"
						>
							{COUNTRY_CODES.map((c) => (
								<option key={c.code} value={c.code}>
									{c.flag} {c.code}
								</option>
							))}
						</select>
						<div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-brand-primary">
							<svg
								width="12"
								height="8"
								viewBox="0 0 12 8"
								fill="none"
								xmlns="http://www.w3.org/2000/svg"
							>
								<path
									d="M1 1L6 6L11 1"
									stroke="currentColor"
									strokeWidth="2.5"
									strokeLinecap="round"
								/>
							</svg>
						</div>
					</div>

					<input
						id="phone"
						data-testid="phone-input"
						type="tel"
						value={localNumber}
						onChange={(e) => {
							setLocalNumber(e.target.value);
						}}
						placeholder="176 12345678"
						disabled={isVerifying}
						className={`
              flex-1 h-14 px-6 rounded-2xl bg-white border-2 text-lg font-bold text-brand-black outline-none transition-all
              ${localError ? "border-red-500 focus:border-red-500" : "border-brand-border/30 focus:border-brand-primary"}
              disabled:opacity-50 min-w-0
            `}
					/>
				</div>

				{(localError || error) && (
					<motion.p
						initial={{ opacity: 0, y: -10 }}
						animate={{ opacity: 1, y: 0 }}
						className="text-red-500 text-sm font-medium mb-4"
						data-testid="phone-error"
					>
						{localError || (error ? t(error) : "")}
					</motion.p>
				)}

				<PrimaryButton
					type="submit"
					data-testid="send-code-button"
					disabled={isVerifying || !localNumber}
				>
					{isVerifying ? (
						<div className="size-6 border-2 border-primary-blue-500/30 border-t-primary-blue-500 rounded-full animate-spin" />
					) : (
						t("send_code")
					)}
				</PrimaryButton>
			</form>

			<div className="bg-white p-4 rounded-2xl border border-brand-border/40 text-left gap-2 flex flex-row items-start mt-8">
				<Info className="size-4 shrink-0 text-brand-black mt-1" />
				<p className="text-sm text-brand-black leading-relaxed">
					{t("trust_copy")}
				</p>
			</div>
		</div>
	);
};
