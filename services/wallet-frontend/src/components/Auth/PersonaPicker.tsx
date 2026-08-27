import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { UserPlus } from "lucide-react";
import { useAuthStore } from "../../store/useAuthStore";
import type { OTP, PhoneNumber } from "../../schemas/auth.schema";
import { DEMO_PERSONAS, generateOwnDramaNumber } from "../../config/demoPersonas";
import { env } from "../../config/env.config";
import { getMockProfileStorageKey } from "../../utils/profile";

interface PersonaPickerProps {
	onUsePhoneNumber: () => void;
}

// Drama numbers skip SMS verification and accept any 6-digit code, on both
// the mock provider and the real staging auth-proxy — this is just a fixed
// placeholder for that "any code" slot, not a secret or a bypass of anything
// the backend doesn't already sanction for these numbers.
const AUTO_VERIFY_CODE = "482913" as OTP;

export const PersonaPicker: React.FC<PersonaPickerProps> = ({
	onUsePhoneNumber,
}) => {
	const { t } = useTranslation("auth");
	const [error, setError] = useState<string | null>(null);

	const loginInstantly = async (phone: string) => {
		setError(null);
		try {
			await useAuthStore.getState().login(phone as PhoneNumber);
			if (useAuthStore.getState().status === "ERROR") {
				setError(
					useAuthStore.getState().error ||
						t("persona_picker.login_failed", "Anmeldung fehlgeschlagen."),
				);
				return;
			}
			await useAuthStore.getState().verify(AUTO_VERIFY_CODE);
		} catch (e) {
			console.error("Instant persona login failed:", e);
			setError(t("persona_picker.login_failed", "Anmeldung fehlgeschlagen."));
		}
	};

	const handlePersonaClick = async (persona: (typeof DEMO_PERSONAS)[number]) => {
		if (env.VITE_USE_MOCK_AUTH) {
			localStorage.setItem(
				getMockProfileStorageKey(persona.phoneNumber),
				JSON.stringify(persona.getProfile()),
			);
		}
		await loginInstantly(persona.phoneNumber);
	};

	const handleCreateNewClick = async () => {
		await loginInstantly(generateOwnDramaNumber());
	};

	return (
		<div
			className="w-full max-w-sm flex flex-col items-center relative"
			data-testid="persona-picker"
		>
			<div className="mb-8 text-center flex flex-col gap-4">
				<h1 className="text-brand-black text-h1 font-bold leading-tight m-0 p-0">
					{t("persona_picker.title", "Wer bist Du?")}
				</h1>
				<p className="text-brand-black text-body-lg leading-relaxed m-0 p-0">
					{t(
						"persona_picker.subtitle",
						"Wähle ein Demo-Profil, um Klaro direkt auszuprobieren.",
					)}
				</p>
			</div>

			<div className="w-full flex flex-col gap-3">
				{DEMO_PERSONAS.map((persona) => (
					<button
						key={persona.slug}
						type="button"
						onClick={() => void handlePersonaClick(persona)}
						data-testid={`persona-card-${persona.slug}`}
						className="w-full flex items-center gap-4 bg-white border-2 border-brand-border/30 rounded-2xl p-4 text-left hover:border-brand-primary transition-all active:scale-98"
					>
						<div className="size-14 shrink-0 rounded-full bg-primary-green-500 text-primary-blue-500 flex items-center justify-center text-xl font-bold">
							{persona.displayName.charAt(0)}
						</div>
						<div className="flex flex-col min-w-0">
							<span className="font-bold text-brand-black text-body-lg truncate">
								{persona.displayName}
							</span>
							<span className="text-sm text-brand-black/70 truncate">
								{t(persona.statusKey, persona.fallbackStatus)}
							</span>
						</div>
					</button>
				))}

				<button
					type="button"
					onClick={() => void handleCreateNewClick()}
					data-testid="persona-card-create-new"
					className="w-full flex items-center gap-4 bg-white border-2 border-dashed border-brand-border/30 rounded-2xl p-4 text-left hover:border-brand-primary transition-all active:scale-98"
				>
					<div className="size-14 shrink-0 rounded-full bg-brand-bg flex items-center justify-center text-brand-primary">
						<UserPlus className="size-6" />
					</div>
					<span className="font-bold text-brand-black text-body-lg">
						{t("persona_picker.create_new_profile", "Neues Profil erstellen")}
					</span>
				</button>
			</div>

			{error && (
				<p
					className="text-red-500 text-sm font-medium mt-4"
					data-testid="persona-picker-error"
				>
					{error}
				</p>
			)}

			<button
				type="button"
				onClick={onUsePhoneNumber}
				data-testid="use-phone-instead-link"
				className="mt-8 text-sm font-bold text-brand-black underline underline-offset-2"
			>
				{t("persona_picker.use_phone_instead", "Mit Telefonnummer anmelden")}
			</button>
		</div>
	);
};
