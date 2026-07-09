import React from "react";
import { useTranslation } from "react-i18next";

export const ChatHistory: React.FC<{ closeChatHistory: () => void }> = ({
	closeChatHistory,
}) => {
	const { t } = useTranslation("chat");
	return (
		<div
			className="flex-1 overflow-y-auto px-5 py-6 flex flex-col items-center justify-center text-center min-h-0 gap-4"
			data-testid="chat-history-placeholder"
		>
			<p className="text-body text-brand-black max-w-[280px]">
				{t("history.placeholder")}
			</p>
			<button
				type="button"
				onClick={closeChatHistory}
				className="px-4 py-2 bg-primary-green-500 text-primary-blue-500 rounded-full text-[13px] font-medium cursor-pointer hover:bg-primary-green-500/85 transition-colors"
			>
				{t("history.hide")}
			</button>
		</div>
	);
};
