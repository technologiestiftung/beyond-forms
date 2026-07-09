import React from "react";
import { useTranslation } from "react-i18next";
import { useChatStore } from "../../store/useChatStore";

export const ChatErrorMessage: React.FC = () => {
	const { t } = useTranslation("chat");

	const clearError = useChatStore((s) => s.clearError);

	return (
		<div
			data-testid="chat-error"
			className="w-full rounded-2xl border border-red-200 bg-red-50 px-4 py-3 flex flex-col gap-2"
			role="alert"
		>
			<p className="text-body text-red-900">{t("error.general")}</p>
			<button
				type="button"
				onClick={clearError}
				data-testid="chat-error-dismiss"
				className="self-start text-sm font-semibold text-red-800 underline cursor-pointer"
			>
				{t("error.dismiss")}
			</button>
		</div>
	);
};
