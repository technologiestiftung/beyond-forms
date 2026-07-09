import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAuthStore, type AuthStatus } from "../../store/useAuthStore";
import type { OTP } from "../../schemas/auth.schema";
import * as Icons from "../ui/Icons";
import { motion, useReducedMotion } from "framer-motion";
import { Timer, RefreshCw, AlertCircle } from "lucide-react";
import { PrimaryButton } from "../ui/PrimaryButton";

interface OTPFormProps {
	onSuccess?: (isNewUser: boolean) => void;
}

export const OTPForm: React.FC<OTPFormProps> = ({ onSuccess }) => {
	const { t } = useTranslation("auth");
	const verify = useAuthStore((s) => s.verify);
	const resend = useAuthStore((s) => s.resend);
	const status: AuthStatus = useAuthStore((s) => s.status);
	const phoneNumber = useAuthStore((s) => s.phoneNumber);
	const error = useAuthStore((s) => s.error);
	const errorCode = useAuthStore((s) => s.errorCode);
	const clearError = useAuthStore((s) => s.clearError);
	const shouldReduceMotion = useReducedMotion();

	const [code, setCode] = useState(["", "", "", "", "", ""]);
	const [countdown, setCountdown] = useState(60);
	const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

	useEffect(() => {
		let timer: ReturnType<typeof setTimeout> | undefined;
		if (countdown > 0) {
			timer = setTimeout(() => {
				setCountdown(countdown - 1);
			}, 1000);
		}
		return () => {
			if (timer) {
				clearTimeout(timer);
			}
		};
	}, [countdown]);

	const handleChange = (index: number, value: string) => {
		// If multiple characters are entered (e.g. from a native autocomplete or similar)
		// we only take the first digit and move focus.
		const digit = value.replace(/\D/g, "").slice(-1);
		if (!digit && value !== "") {
			return;
		}

		const newCode = [...code];
		newCode[index] = digit;
		setCode(newCode);

		if (digit && index < 5) {
			inputRefs.current[index + 1]?.focus();
		}

		const fullCode = newCode.join("");
		if (fullCode.length === 6) {
			void verify(fullCode as OTP, { onSuccess });
		}
	};

	const handlePaste = (e: React.ClipboardEvent) => {
		e.preventDefault();
		const pastedData = e.clipboardData
			.getData("text")
			.replace(/\D/g, "")
			.slice(0, 6);
		if (!pastedData) {
			return;
		}

		const newCode = [...code];
		pastedData.split("").forEach((char, i) => {
			if (i < 6) {
				newCode[i] = char;
			}
		});
		setCode(newCode);

		// Focus last filled input or the one after
		const nextIndex = Math.min(pastedData.length, 5);
		inputRefs.current[nextIndex]?.focus();

		if (pastedData.length === 6) {
			void verify(pastedData as OTP, { onSuccess });
		}
	};

	const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
		if (e.key === "Backspace" && !code[index] && index > 0) {
			inputRefs.current[index - 1]?.focus();
		}
	};

	const handleResend = () => {
		if (countdown === 0) {
			void resend();
			setCountdown(60);
			clearError();
		}
	};

	const isVerifying = status === "VERIFYING_CODE";
	const isRateLimited = errorCode === "RATE_LIMIT_EXCEEDED";

	const isCountdownActive = countdown > 0;

	return (
		<div
			className="w-full max-w-sm flex flex-col items-center relative"
			data-testid="otp-form"
		>
			<div className="size-24 bg-white rounded-full flex items-center justify-center mb-10 shadow-sm border border-brand-border/10">
				<div className="size-14 text-brand-primary">
					<Icons.PhoneIcon className="size-full" />
				</div>
			</div>

			<div className="mb-10 text-center flex flex-col gap-4">
				<h1 className="text-brand-black text-h1 font-bold leading-tight m-0 p-0">
					{t("otp_title")}
				</h1>
				<p className="text-brand-black text-body-lg leading-relaxed m-0 p-0">
					{t("otp_desc", { phone: phoneNumber })}
				</p>
			</div>

			<div className="w-full flex flex-col gap-10">
				<div className="flex flex-col gap-4">
					<label className="text-brand-black text-sm font-bold uppercase tracking-wider block text-center">
						{t("otp_label")}
					</label>

					<div className="grid grid-cols-6 gap-2 w-full">
						{code.map((digit, i) => (
							<input
								key={i}
								ref={(el) => {
									inputRefs.current[i] = el;
								}}
								data-testid={`otp-input-${i}`}
								aria-label={t("otp_digit_label", { index: i + 1 })}
								type="text"
								inputMode="numeric"
								maxLength={1}
								value={digit}
								onChange={(e) => {
									handleChange(i, e.target.value);
								}}
								onKeyDown={(e) => {
									handleKeyDown(i, e);
								}}
								onPaste={handlePaste}
								disabled={isVerifying}
								className={`
                  w-full aspect-square bg-white border-2 rounded-2xl text-otp font-bold text-center outline-none transition-all text-brand-black
                  ${error ? "border-red-500 focus:border-red-500" : "border-brand-border/30 focus:border-brand-primary"}
                  disabled:bg-gray-50 disabled:text-brand-black/40
                `}
							/>
						))}
					</div>

					{error && (
						<motion.div
							initial={
								shouldReduceMotion
									? { opacity: 0 }
									: { opacity: 0, scale: 0.95 }
							}
							animate={{ opacity: 1, scale: 1 }}
							data-testid="otp-error"
							className={`
                w-full p-4 rounded-xl flex gap-3
                ${isRateLimited ? "bg-orange-50 text-orange-900 border border-orange-200" : "bg-red-50 text-red-900 border border-red-200"}
              `}
						>
							<AlertCircle className="size-5 shrink-0" />
							<p className="text-sm font-medium">{t(error)}</p>
						</motion.div>
					)}
				</div>

				<div className="flex flex-col items-center gap-8">
					<PrimaryButton
						data-testid="verify-button"
						onClick={() => {
							void verify(code.join("") as OTP, { onSuccess });
						}}
						disabled={isVerifying || code.some((d) => !d)}
					>
						{isVerifying ? (
							<div className="size-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
						) : (
							t("verify")
						)}
					</PrimaryButton>

					<div className="flex flex-col items-center gap-3">
						<button
							data-testid="resend-button"
							onClick={handleResend}
							disabled={isCountdownActive || isVerifying}
							className={`
                flex items-center gap-2 text-body-lg font-bold transition-colors cursor-pointer
                ${isCountdownActive ? "text-brand-black cursor-not-allowed" : "text-brand-black hover:text-brand-primary underline"}
              `}
						>
							<RefreshCw
								className={`size-4 ${isVerifying ? "animate-spin" : ""}`}
							/>
							{t("resend_code")} {isCountdownActive ? `(${countdown}s)` : ""}
						</button>
					</div>
				</div>
				<div className="bg-white p-4 rounded-2xl border border-brand-border/40 text-left gap-2 flex flex-row items-center">
					<Timer className="size-4 shrink-0 text-brand-black" />
					<p className="text-sm text-brand-black leading-relaxed">
						{t("otp_validity_box")}
					</p>
				</div>
			</div>
		</div>
	);
};
