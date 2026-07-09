import React from "react";
import { useTranslation } from "react-i18next";

export const ChatTypingIndicator: React.FC = () => {
	const { t } = useTranslation("chat");
	return (
		<div
			className="flex items-start w-full"
			data-testid="chat-typing-indicator"
			aria-live="polite"
			aria-busy="true"
			aria-label={t("typing_indicator")}
		>
			<div className="bg-brand-bg rounded-xl px-4 py-3 flex gap-1.5">
				<span className="size-2 rounded-full bg-primary-blue-100 animate-pulse [animation-delay:0ms]" />
				<span className="size-2 rounded-full bg-primary-blue-100 animate-pulse [animation-delay:150ms]" />
				<span className="size-2 rounded-full bg-primary-blue-100 animate-pulse [animation-delay:300ms]" />
			</div>
		</div>
	);
};
