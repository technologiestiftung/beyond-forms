import React, { Suspense, useCallback, useEffect, useRef } from "react";
import {
	Outlet,
	useLocation,
	useNavigate,
	type Location,
} from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePendingUploadStore } from "../../../store/usePendingUploadStore";
import { BACKGROUND_ROUTES_ID } from "../../../constants/dom";

const FOCUSABLE_SELECTOR =
	'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export interface DocumentFlowDialogProps {
	background: Location;
}

/** Desktop-only shell for the upload → review → success flow. */
export const DocumentFlowDialog: React.FC<DocumentFlowDialogProps> = ({
	background,
}) => {
	const { t } = useTranslation("application");
	const navigate = useNavigate();
	const location = useLocation();
	const dialogRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef(document.activeElement as HTMLElement | null);

	const getFocusables = () =>
		Array.from(
			dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ??
				[],
		).filter((element) => {
			if (element.hasAttribute("disabled")) {
				return false;
			}
			// The steps keep hidden file inputs; focusing one drops focus out of the dialog.
			const style = window.getComputedStyle(element);
			return style.display !== "none" && style.visibility !== "hidden";
		});

	const close = useCallback(() => {
		navigate(`${background.pathname}${background.search}`, { replace: true });
	}, [background, navigate]);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape") {
				return;
			}
			// A modal opened inside a step (delete, preview) owns Escape first.
			if (dialogRef.current?.querySelector('[role="dialog"]')) {
				return;
			}
			close();
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [close]);

	// Each step lazy-loads, so wait for its content before handing over focus.
	useEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog) {
			return undefined;
		}

		const focusFirstElement = () => {
			const [firstFocusable] = getFocusables();
			firstFocusable?.focus();
			return Boolean(firstFocusable);
		};

		if (focusFirstElement()) {
			return undefined;
		}

		dialog.focus();
		const observer = new MutationObserver(() => {
			if (focusFirstElement()) {
				observer.disconnect();
			}
		});
		observer.observe(dialog, { childList: true, subtree: true });
		return () => observer.disconnect();
	}, [location.pathname]);

	useEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog) {
			return undefined;
		}

		const handleTab = (event: KeyboardEvent) => {
			if (event.key !== "Tab") {
				return;
			}

			const focusables = getFocusables();
			if (focusables.length === 0) {
				return;
			}

			const first = focusables[0];
			const last = focusables[focusables.length - 1];

			if (event.shiftKey && document.activeElement === first) {
				last.focus();
				event.preventDefault();
			} else if (!event.shiftKey && document.activeElement === last) {
				first.focus();
				event.preventDefault();
			}
		};

		dialog.addEventListener("keydown", handleTab);
		return () => dialog.removeEventListener("keydown", handleTab);
	}, []);

	// Keeps the page behind the dialog out of reach of pointer, focus and AT.
	useEffect(() => {
		const backgroundRoot = document.getElementById(BACKGROUND_ROUTES_ID);
		if (!backgroundRoot) {
			return undefined;
		}

		const wasInert = backgroundRoot.hasAttribute("inert");
		backgroundRoot.setAttribute("inert", "");
		return () => {
			if (!wasInert) {
				backgroundRoot.removeAttribute("inert");
			}
		};
	}, []);

	// Captured while rendering, before the effects above move focus into the dialog.
	// Declared after the inert effect so that cleanup, which runs in declaration
	// order, has already made the background focusable again by this point.
	useEffect(() => () => triggerRef.current?.focus?.(), []);

	useEffect(() => {
		const { overflow } = document.body.style;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = overflow;
			// Dropped but never staged, e.g. closed while the step was still loading.
			usePendingUploadStore.getState().takePendingFile();
		};
	}, []);

	const handleBackdropClick = (event: React.MouseEvent) => {
		if (event.target === event.currentTarget) {
			close();
		}
	};

	return (
		<div
			onClick={handleBackdropClick}
			data-testid="document-flow-backdrop"
			className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-menu-backdrop flex items-center justify-center p-6 animate-in fade-in duration-200"
		>
			<div
				ref={dialogRef}
				role="dialog"
				aria-modal="true"
				tabIndex={-1}
				aria-label={t("docs.upload_dialog_aria", "Dokument hinzufügen")}
				data-testid="document-flow-dialog"
				className="bg-white w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-3xl shadow-2xl animate-in zoom-in-95 duration-300"
			>
				<Suspense
					fallback={
						<div className="flex items-center justify-center py-24">
							<div className="size-10 border-4 border-primary-blue-500 border-t-transparent rounded-full animate-spin" />
						</div>
					}
				>
					<Outlet />
				</Suspense>
			</div>
		</div>
	);
};
