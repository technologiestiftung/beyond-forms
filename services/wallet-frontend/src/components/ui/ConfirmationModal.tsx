import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { X, AlertCircle } from "lucide-react";

export interface ConfirmationModalProps {
	isOpen: boolean;
	title: string;
	message: string;
	confirmLabel?: string;
	cancelLabel?: string;
	onConfirm: () => void;
	onCancel: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
	isOpen,
	title,
	message,
	confirmLabel = "Löschen",
	cancelLabel = "Abbrechen",
	onConfirm,
	onCancel,
}) => {
	const { t } = useTranslation("common");
	const modalRef = useRef<HTMLDivElement>(null);

	// Escape Key Global Listener (Only active when Open)
	useEffect(() => {
		if (!isOpen) {
			return () => {};
		}

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onCancel();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [isOpen, onCancel]);

	// Keyboard Focus Trapping (Locks Tab navigation inside Modal)
	useEffect(() => {
		if (!isOpen) {
			return () => {};
		}

		const modalElement = modalRef.current;
		if (!modalElement) {
			return () => {};
		}

		const focusableSelectors =
			'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
		const focusableElements =
			modalElement.querySelectorAll<HTMLElement>(focusableSelectors);
		const firstFocusable = focusableElements[0];
		const lastFocusable = focusableElements[focusableElements.length - 1];

		// Auto-focus first element for full accessibility compliance
		if (firstFocusable) {
			firstFocusable.focus();
		}

		const handleTabKey = (e: KeyboardEvent) => {
			if (e.key !== "Tab") {
				return;
			}

			if (e.shiftKey) {
				if (document.activeElement === firstFocusable) {
					lastFocusable.focus();
					e.preventDefault();
				}
			} else if (document.activeElement === lastFocusable) {
				firstFocusable.focus();
				e.preventDefault();
			}
		};

		modalElement.addEventListener("keydown", handleTabKey);
		return () => {
			modalElement.removeEventListener("keydown", handleTabKey);
		};
	}, [isOpen]);

	if (!isOpen) {
		return null;
	}

	const handleBackdropClick = (e: React.MouseEvent) => {
		if (e.target === e.currentTarget) {
			onCancel();
		}
	};

	return (
		<div
			onClick={handleBackdropClick}
			className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200"
		>
			{/* Modal Panel Card */}
			<div
				ref={modalRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby="confirmation-modal-title"
				aria-describedby="confirmation-modal-message"
				className="bg-white w-full max-w-sm rounded-[28px] p-6 shadow-2xl border border-slate-100 flex flex-col gap-5 animate-in zoom-in-95 duration-300 text-center relative"
			>
				{/* Close Button */}
				<button
					type="button"
					onClick={onCancel}
					className="absolute top-4 right-4 size-8 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center active:scale-90 transition-all"
					aria-label={t("common.close_dialog")}
				>
					<X className="w-4 h-4 text-slate-500" />
				</button>

				{/* Warning Icon Indicator */}
				<div className="mx-auto size-14 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 mb-1">
					<AlertCircle className="size-7" />
				</div>

				{/* Text Details */}
				<div className="flex flex-col gap-2">
					<h3
						id="confirmation-modal-title"
						className="text-lg font-extrabold text-slate-900 leading-tight"
					>
						{title}
					</h3>
					<p
						id="confirmation-modal-message"
						className="text-sm text-brand-grey leading-relaxed px-2"
					>
						{message}
					</p>
				</div>

				{/* Actions Button Bar */}
				<div className="flex flex-col gap-2.5 w-full mt-2">
					<button
						type="button"
						onClick={onConfirm}
						className="w-full h-12 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-bold rounded-2xl shadow-md active:scale-98 transition-all flex items-center justify-center text-sm"
					>
						{confirmLabel}
					</button>
					<button
						type="button"
						onClick={onCancel}
						className="w-full h-12 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-2xl active:scale-98 transition-all flex items-center justify-center text-sm"
					>
						{cancelLabel}
					</button>
				</div>
			</div>
		</div>
	);
};
