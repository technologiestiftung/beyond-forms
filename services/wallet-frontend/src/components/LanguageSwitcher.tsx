import React, { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { usePreferencesStore } from "../store/usePreferencesStore";
import { Globe } from "lucide-react";

export type LanguageSwitcherVariant = "default" | "blue";

interface LanguageSwitcherProps {
	variant?: LanguageSwitcherVariant;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
	variant = "default",
}) => {
	const isBlue = variant === "blue";
	const { i18n, t } = useTranslation();
	const setLanguage = usePreferencesStore((s) => s.setLanguage);
	const [isOpen, setIsOpen] = useState(false);
	const rootRef = useRef<HTMLDivElement>(null);
	const languagesRegionId = useId();

	const currentLang = i18n.language.split("-")[0].toUpperCase();
	const languages = ["DE", "EN"];

	const toggleLanguage = (lang: string) => {
		const lowLang = lang.toLowerCase();
		void i18n.changeLanguage(lowLang);
		setLanguage(lowLang);
		setIsOpen(false);
	};

	useEffect(() => {
		if (!isOpen) {
			return undefined;
		}
		const onPointerDown = (e: PointerEvent) => {
			const el = rootRef.current;
			if (!el || el.contains(e.target as Node)) {
				return;
			}
			setIsOpen(false);
		};

		document.addEventListener("pointerdown", onPointerDown);
		return () => {
			document.removeEventListener("pointerdown", onPointerDown);
		};
	}, [isOpen]);

	useEffect(() => {
		if (!isOpen) {
			return undefined;
		}
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				setIsOpen(false);
			}
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [isOpen]);

	useEffect(() => {
		if (!isOpen) {
			return undefined;
		}

		const root = rootRef.current;
		if (!root) {
			return undefined;
		}

		const onFocusOut = (e: FocusEvent) => {
			const nextFocused = e.relatedTarget as Node | null;
			if (!nextFocused || !root.contains(nextFocused)) {
				setIsOpen(false);
			}
		};

		root.addEventListener("focusout", onFocusOut);
		return () => {
			root.removeEventListener("focusout", onFocusOut);
		};
	}, [isOpen]);

	return (
		<div
			ref={rootRef}
			data-testid="language-switcher"
			className={`
        inline-flex items-center justify-center rounded-full border border-brand-border-subtle overflow-hidden
  		focus-within:ring-2 focus-within:ring-primary-blue-500 focus-within:ring-offset-2 min-h-11 h-11 box-border
        ${isBlue ? "bg-brand-border-subtle" : "bg-white"}
        ${isOpen ? "gap-2 py-1 pr-1" : " w-11 min-w-11"}
      `}
		>
			<button
				type="button"
				aria-expanded={isOpen}
				aria-haspopup="true"
				aria-controls={isOpen ? languagesRegionId : undefined}
				onClick={() => setIsOpen((open) => !open)}
				aria-label={
					isOpen
						? t("language_switcher_toggle_close")
						: t("language_switcher_toggle_open")
				}
				className={`
          relative z-10 flex size-11 shrink-0 items-center justify-center cursor-pointer outline-none
          ${
						isBlue
							? "bg-brand-border-subtle hover:bg-brand-border text-primary-blue-500 transition-colors"
							: "bg-white text-brand-black"
					}
        `}
			>
				<span className="pointer-events-none flex size-6 shrink-0 items-center justify-center">
					<Globe className="size-6" strokeWidth={2.5} aria-hidden />
				</span>
			</button>

			{isOpen && (
				<div
					id={languagesRegionId}
					role="region"
					aria-label={t("language_selection_region")}
					className="relative z-0 flex min-w-0 items-center gap-1"
				>
					{languages.map((lang) => {
						const isActive = currentLang === lang;
						return (
							<button
								key={lang}
								type="button"
								onClick={() => toggleLanguage(lang)}
								aria-label={t("switch_to_language", {
									language: lang,
									defaultValue: `Switch to ${lang}`,
								})}
								aria-pressed={isActive}
								className={`h-9 w-11 cursor-pointer rounded-full text-xs font-bold focus-visible:outline-2 focus-visible:outline-primary-blue-500 ${
									isActive
										? "bg-brand-primary text-white shadow-sm"
										: "text-brand-black hover:bg-gray-100"
								}`}
							>
								{lang}
							</button>
						);
					})}
				</div>
			)}
		</div>
	);
};
