import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useChatStore } from "../../store/useChatStore";
import * as Icons from "../ui/Icons";
import { AppRoutes } from "../../constants/routes";
import { useNavigate } from "react-router-dom";
import { useUIStore } from "../../store/useUIStore";

interface ChatFormProps {
	submitUserMessage: (text: string) => void;
}

export const ChatForm: React.FC<ChatFormProps> = ({ submitUserMessage }) => {
	const { t } = useTranslation("chat");
	const isLoading = useChatStore((s) => s.isLoading);
	const [inputValue, setInputValue] = useState("");
	const closeChat = useUIStore((s) => s.closeChat);

	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const text = inputValue.trim();
		if (!text) {
			return;
		}
		submitUserMessage(text);
		setInputValue("");
	};

	const navigate = useNavigate();

	const handleNavigation = () => {
		navigate(AppRoutes.ProfilePersonalDataUpload);
		closeChat();
	};

	return (
		<div className="bg-white border-t border-brand-border-subtle px-5 py-4 shrink-0">
			<form onSubmit={handleSubmit} className="flex gap-2 items-center">
				<button
					type="button"
					onClick={handleNavigation}
					className="size-12 flex items-center justify-center bg-primary-blue-500 rounded-full text-white disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed hover:bg-primary-blue-500/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-blue-500 transition-colors shrink-0"
					aria-label={t("upload")}
				>
					<Icons.PaperclipIcon className="size-5" />
				</button>
				<input
					type="text"
					name="message"
					value={inputValue}
					onChange={(e) => setInputValue(e.target.value)}
					placeholder={t("input_placeholder")}
					aria-label={t("input_placeholder")}
					autoComplete="off"
					disabled={isLoading}
					data-testid="chat-input"
					className="flex-1 h-12 px-4 bg-white border border-brand-border-subtle rounded-2xl text-body text-brand-black placeholder:text-brand-black/70 outline-none focus:border-brand-primary transition-colors disabled:opacity-60"
				/>
				<button
					type="submit"
					disabled={!inputValue.trim() || isLoading}
					data-testid="chat-send"
					className="size-12 flex items-center justify-center bg-primary-blue-500 rounded-full text-white disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed hover:bg-primary-blue-500/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-blue-500 transition-colors shrink-0"
					aria-label={t("send")}
				>
					{isLoading ? (
						<Icons.LoaderIcon className="size-5 animate-spin" />
					) : (
						<Icons.SendIcon className="size-5" />
					)}
				</button>
			</form>
		</div>
	);
};
