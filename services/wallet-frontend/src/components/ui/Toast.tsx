import React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, CheckCircle2, X } from "lucide-react";

interface ToastProps {
	show: boolean;
	type?: "error" | "success";
	title: string;
	message: string;
	onClose: () => void;
	onClick?: () => void;
	testId?: string;
}

/**
 * Standardized Toast component for empathetic error and success feedback.
 * Designed for Sandor with high contrast and clear interactions.
 */
export const Toast: React.FC<ToastProps> = ({
	show,
	type = "error",
	title,
	message,
	onClose,
	onClick,
	testId,
}) => {
	const { t } = useTranslation("common");
	const isError = type === "error";

	return (
		<AnimatePresence>
			{show && (
				<motion.div
					initial={{ opacity: 0, y: 100 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: 100 }}
					data-testid={testId}
					className={`
            fixed bottom-10 left-1/2 -translate-x-1/2 w-[calc(100%-2.5rem)] max-w-sm
            p-4 rounded-2xl shadow-2xl flex items-center gap-4 z-toast
            ${isError ? "bg-red-600" : "bg-green-600"} text-white
          `}
				>
					{isError ? (
						<AlertCircle className="size-6 shrink-0" />
					) : (
						<CheckCircle2 className="size-6 shrink-0" />
					)}

					<div
						className={`flex-1 ${onClick ? "cursor-pointer hover:opacity-85" : ""}`}
						onClick={onClick}
					>
						<p className="font-bold text-sm">{title}</p>
						<p className="text-xs opacity-90">{message}</p>
					</div>

					<button
						onClick={onClose}
						className="p-1 hover:bg-white/10 rounded-lg transition-colors"
						aria-label={t("close")}
					>
						<X className="size-5" />
					</button>
				</motion.div>
			)}
		</AnimatePresence>
	);
};
