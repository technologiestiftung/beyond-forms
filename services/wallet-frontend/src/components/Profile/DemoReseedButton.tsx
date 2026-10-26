import React from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { DEMO_PERSONAS, type DemoPersona } from "../../config/demoPersonas";
import { reseedDemoProfile } from "../../services/profile/demoReseed";
import { useAuthStore } from "../../store/useAuthStore";
import { SecondaryButton } from "../ui/SecondaryButton";

const ReseedButton: React.FC<{ persona: DemoPersona }> = ({ persona }) => {
	const { t } = useTranslation("profile");
	const queryClient = useQueryClient();
	const { mutate, isPending, isError } = useMutation({
		mutationFn: () => reseedDemoProfile(persona),
		onSuccess: () => {
			void queryClient.invalidateQueries();
		},
	});

	return (
		<div className="flex flex-col gap-2 w-full max-w-md mx-auto lg:max-w-none lg:mx-0 lg:mt-8">
			<SecondaryButton
				onClick={() => mutate()}
				disabled={isPending}
				data-testid="demo-reseed-button"
				className="lg:w-auto lg:self-start"
			>
				{isPending ? t("demo_reseed.pending") : t("demo_reseed.button")}
			</SecondaryButton>
			{isError && (
				<p role="alert" className="text-sm text-rose-600 font-medium">
					{t("demo_reseed.error")}
				</p>
			)}
		</div>
	);
};

export const DemoReseedButton: React.FC = () => {
	const phoneNumber = useAuthStore((s) => s.phoneNumber);
	const persona = DEMO_PERSONAS.find((p) => p.phoneNumber === phoneNumber);

	return persona ? <ReseedButton persona={persona} /> : null;
};
