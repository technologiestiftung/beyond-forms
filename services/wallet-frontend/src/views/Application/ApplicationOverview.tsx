import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
	Loader2,
	X,
	AlertCircle,
	FileText,
	Clock,
	ExternalLink,
	RefreshCw,
	CheckCircle2,
	AlertTriangle,
} from "lucide-react";
import { MAX_MILESTONE_LEVEL } from "../../store/useProfileStore";
import { useDocumentProcessingSocket } from "../../hooks/useDocumentProcessingSocket";
import { useProfile } from "../../hooks/useProfile";
import { useAutoVerification } from "../../hooks/useAutoVerification";
import { getMappedInformationSections } from "../../utils/profile";
import { AppRoutes } from "../../constants/routes";
import { QuestionnaireStatusList } from "../../components/Application/QuestionnaireStatusList";
import { DownloadSuccessModal } from "../../components/Application/DownloadSuccessModal";
import { PageContainer } from "../../components/Layout/PageContainer";
import { PrimaryButton } from "../../components/ui/PrimaryButton";

import { env } from "../../config/env.config";
import { authenticatedFetch } from "../../utils/apiClient";

const SegmentedProgressBar: React.FC<{ milestoneLevel: number }> = ({
	milestoneLevel,
}) => {
	const { t } = useTranslation("application");
	return (
		<div
			className="flex gap-2 w-full mt-2"
			data-testid="segmented-progress-bar"
		>
			<div className="flex-1 flex flex-col gap-1">
				<div
					className={`h-2.5 rounded-full transition-all duration-300 ${
						milestoneLevel >= 1 ? "bg-primary-blue-500" : "bg-slate-200"
					}`}
				/>
				<span
					className={`text-[9px] font-black uppercase tracking-wider text-center ${
						milestoneLevel >= 1 ? "text-primary-blue-500" : "text-brand-grey"
					}`}
				>
					{t("levels.pills.incomplete", "Unvollständig")}
				</span>
			</div>
			<div className="flex-1 flex flex-col gap-1">
				<div
					className={`h-2.5 rounded-full transition-all duration-300 ${
						milestoneLevel >= 2 ? "bg-primary-blue-500" : "bg-slate-200"
					}`}
				/>
				<span
					className={`text-[9px] font-black uppercase tracking-wider text-center ${
						milestoneLevel >= 2 ? "text-primary-blue-500" : "text-brand-grey"
					}`}
				>
					{t("levels.pills.advanced", "Fortgeschritten")}
				</span>
			</div>
			<div className="flex-1 flex flex-col gap-1">
				<div
					className={`h-2.5 rounded-full transition-all duration-300 ${
						milestoneLevel === 3 ? "bg-primary-blue-500" : "bg-slate-200"
					}`}
				/>
				<span
					className={`text-[9px] font-black uppercase tracking-wider text-center ${
						milestoneLevel === 3 ? "text-primary-blue-500" : "text-brand-grey"
					}`}
				>
					{t("levels.pills.ready", "Startklar")}
				</span>
			</div>
		</div>
	);
};

interface ExportUrls {
	signed_open_url: string;
	signed_download_url: string;
	expires_in_seconds: number;
}

interface ConfirmModalProps {
	t: (
		key: string,
		defaultText?: string,
		options?: Record<string, unknown>,
	) => string;
	onClose: () => void;
	onConfirm: () => void;
	isGenerating: boolean;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
	t,
	onClose,
	onConfirm,
	isGenerating,
}) => (
	<div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-110 flex items-center justify-center p-4 animate-fadeIn">
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="confirm-modal-title"
			className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 flex flex-col gap-6 shadow-2xl border border-slate-100 animate-scaleUp text-left"
		>
			<div className="flex items-start justify-between gap-4">
				<div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center shrink-0 border border-amber-200 shadow-sm">
					<AlertTriangle className="w-6 h-6 text-amber-600" />
				</div>
				<button
					onClick={onClose}
					className="p-2 -mr-2 text-brand-grey hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
					aria-label={t("overview.close_modal_button", "Schließen")}
				>
					<X className="w-5 h-5" />
				</button>
			</div>

			<div className="flex flex-col gap-2">
				<h3
					id="confirm-modal-title"
					className="text-xl font-extrabold text-slate-900 tracking-tight"
				>
					{t("overview.warning_modal_title", "Antrag unvollständig")}
				</h3>
				<p className="text-slate-600 leading-relaxed">
					{t(
						"overview.warning_modal_description",
						"Du hast noch nicht alle empfohlenen Felder ausgefüllt. Ein unvollständiger Antrag kann die Bearbeitung durch das Amt verzögern. Möchtest du den Antrag trotzdem jetzt schon generieren?",
					)}
				</p>
			</div>

			<div className="flex flex-col sm:flex-row gap-3 pt-2">
				<button
					type="button"
					onClick={onClose}
					className="px-5 py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition-colors cursor-pointer w-full"
				>
					{t("overview.warning_modal_cancel", "Zurück zum Antrag")}
				</button>
				<PrimaryButton
					data-testid="confirm-modal-submit"
					onClick={onConfirm}
					disabled={isGenerating}
					className="w-full bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-500"
				>
					{isGenerating && (
						<Loader2 className="size-5 animate-spin mr-2 shrink-0" />
					)}
					{t("overview.warning_modal_confirm", "Trotzdem generieren")}
				</PrimaryButton>
			</div>
		</div>
	</div>
);

interface PreviewModalProps {
	t: (
		key: string,
		defaultText?: string,
		options?: Record<string, unknown>,
	) => string;
	onClose: () => void;
	isExpired: boolean;
	generateAndShowPdf: () => void;
	isGenerating: boolean;
	isMobile: boolean;
	pdfUrl: string | null;
	secondsRemaining: number;
	exportUrls: ExportUrls | null;
	setInvisibleDownloadUrl: (url: string) => void;
	onDownloadSuccess: () => void;
}

const PreviewModal: React.FC<PreviewModalProps> = ({
	t,
	onClose,
	isExpired,
	generateAndShowPdf,
	isGenerating,
	isMobile,
	pdfUrl,
	secondsRemaining,
	exportUrls,
	setInvisibleDownloadUrl,
	onDownloadSuccess,
}) => (
	<div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-110 flex items-center justify-center p-4 md:p-10 animate-fadeIn">
		<div
			role="dialog"
			aria-modal="true"
			className="bg-white rounded-3xl w-full max-w-3xl h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-100 animate-scaleUp"
		>
			<div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
				<h3 className="font-bold text-slate-800 text-lg">
					{t("overview.preview_title", "Antragsentwurf Vorschau")}
				</h3>
				<button
					onClick={onClose}
					className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
				>
					<X className="w-4 h-4" />
				</button>
			</div>

			<div className="flex-1 bg-slate-100 relative flex flex-col items-center justify-center">
				{isExpired && (
					<div className="w-full h-full bg-slate-50 flex flex-col items-center justify-center p-6 text-center animate-fadeIn">
						<div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mb-4 text-amber-600 shadow-sm">
							<Clock className="w-8 h-8" />
						</div>
						<h4 className="font-bold text-slate-800 text-lg mb-2">
							{t(
								"overview.preview_expired_title",
								"Sicherheitslink abgelaufen",
							)}
						</h4>
						<p className="text-sm text-slate-500 max-w-xs leading-relaxed mb-6">
							{t(
								"overview.preview_expired_description",
								"Aus Datenschutzgründen (DSGVO) wurde der temporäre Link deaktiviert. Bitte aktualisiere die Vorschau.",
							)}
						</p>
						<PrimaryButton onClick={generateAndShowPdf} disabled={isGenerating}>
							{isGenerating && (
								<Loader2 className="size-4 animate-spin mr-2 shrink-0" />
							)}
							<RefreshCw className="w-4 h-4 mr-2 shrink-0" />
							{t("overview.refresh_preview_button", "Vorschau aktualisieren")}
						</PrimaryButton>
					</div>
				)}
				{!isExpired && isMobile && (
					<div className="w-full h-full bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
						<div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mb-4">
							<FileText className="w-8 h-8 text-red-500" />
						</div>
						<h4 className="font-bold text-slate-800 text-lg mb-2">
							{t(
								"overview.preview_ready_title",
								"Antrag bereit zum Herunterladen",
							)}
						</h4>
						<p className="text-sm text-slate-500 max-w-xs leading-relaxed">
							{t(
								"overview.preview_ready_description",
								"Dein ausgefüllter Antrag wurde erfolgreich als PDF erstellt. Lade ihn herunter oder öffne ihn in einem neuen Tab.",
							)}
						</p>
					</div>
				)}
				{!isExpired && !isMobile && (
					<iframe
						src={pdfUrl || ""}
						title="PDF Vorschau"
						className="w-full h-full border-none"
					/>
				)}
			</div>

			<div className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0 bg-slate-50/30">
				<div className="flex items-center gap-2 text-xs font-medium text-slate-500">
					<Clock
						className={`w-4 h-4 shrink-0 ${
							secondsRemaining <= 10 && !isExpired
								? "text-rose-500 animate-pulse"
								: "text-amber-500"
						}`}
					/>
					<span>
						{isExpired
							? t("overview.link_expired_label", "Link abgelaufen")
							: t(
									"overview.preview_timer_notice",
									"Link aus Sicherheitsgründen für {{count}}s gültig",
									{
										count: secondsRemaining,
									},
								)}
					</span>
				</div>

				<div className="flex flex-col sm:flex-row justify-end gap-3 w-full sm:w-auto">
					{exportUrls?.signed_open_url && (
						<a
							href={exportUrls.signed_open_url}
							target="_blank"
							rel="noopener noreferrer"
							onClick={(e) => {
								if (isExpired) {
									e.preventDefault();
								}
							}}
							className={`w-full sm:w-auto inline-flex items-center justify-center px-5 py-2.5 border border-slate-300 shadow-sm text-sm font-semibold rounded-xl text-slate-700 bg-white hover:bg-slate-50 active:bg-slate-100 transition-all text-center ${
								isExpired
									? "opacity-50 cursor-not-allowed pointer-events-none"
									: ""
							}`}
						>
							<ExternalLink className="w-4 h-4 mr-2 text-slate-500 shrink-0" />
							{t("overview.open_button", "Öffnen")}
						</a>
					)}
					<PrimaryButton
						onClick={() => {
							if (isExpired || !exportUrls) {
								return;
							}
							setInvisibleDownloadUrl(exportUrls.signed_download_url);
							onDownloadSuccess();
						}}
						disabled={isExpired}
						className="w-full sm:w-auto"
					>
						{t("overview.download_button", "Herunterladen")}
					</PrimaryButton>
				</div>
			</div>
		</div>
	</div>
);

export const ApplicationOverview: React.FC = () => {
	const { t } = useTranslation("application");
	const navigate = useNavigate();

	useDocumentProcessingSocket();

	const { profileData, milestoneLevel, documents, isLoading } = useProfile();
	useAutoVerification();
	const [dismissedDocId, setDismissedDocId] = useState<string | null>(null);

	const recentVerifiedDoc = (documents || []).find((doc) => {
		if (
			doc.status !== "VERIFIED" ||
			!doc.updatedAt ||
			doc.id === dismissedDocId
		) {
			return false;
		}
		const ageMs = new Date().getTime() - new Date(doc.updatedAt).getTime();
		return ageMs > 0 && ageMs < 120000;
	});

	const recentVerificationDocName = recentVerifiedDoc?.name || null;
	const recentVerificationDocId = recentVerifiedDoc?.id || null;
	const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
	const [isGenerating, setIsGenerating] = useState(false);
	const [pdfUrl, setPdfUrl] = useState<string | null>(null);
	const [exportUrls, setExportUrls] = useState<ExportUrls | null>(null);
	const [showPreviewModal, setShowPreviewModal] = useState(false);
	const [showSuccessModal, setShowSuccessModal] = useState(false);
	const [generationError, setGenerationError] = useState<string | null>(null);
	const [isMobile, setIsMobile] = useState(false);
	const [secondsRemaining, setSecondsRemaining] = useState<number>(0);
	const [isExpired, setIsExpired] = useState<boolean>(false);
	const [invisibleDownloadUrl, setInvisibleDownloadUrl] = useState<
		string | null
	>(null);
	const generateButtonContainerRef = useRef<HTMLDivElement>(null);
	const generateButtonRef = useRef<HTMLButtonElement>(null);

	const scrollToGenerateButton = () => {
		generateButtonContainerRef.current?.scrollIntoView({
			behavior: "smooth",
			block: "start",
		});
	};

	useEffect(() => {
		const userAgent =
			typeof window.navigator !== "undefined" ? window.navigator.userAgent : "";
		const mobileRegex =
			/Mobi|Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
		setIsMobile(window.innerWidth < 768 || mobileRegex.test(userAgent));
	}, []);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				setShowConfirmModal(false);
			}
		};
		if (showConfirmModal) {
			window.addEventListener("keydown", handleKeyDown);
		}
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [showConfirmModal]);

	useEffect(() => {
		return () => {
			if (pdfUrl && pdfUrl.startsWith("blob:")) {
				URL.revokeObjectURL(pdfUrl);
			}
		};
	}, [pdfUrl]);

	useEffect(() => {
		if (!exportUrls) {
			return () => {};
		}
		setSecondsRemaining(exportUrls.expires_in_seconds);

		const interval = setInterval(() => {
			setSecondsRemaining((prev) => {
				if (prev <= 1) {
					clearInterval(interval);
					setIsExpired(true);
					return 0;
				}
				return prev - 1;
			});
		}, 1000);

		return () => clearInterval(interval);
	}, [exportUrls]);

	const infoSections = getMappedInformationSections(profileData || {});

	const handleCategoryClick = (id: string) => {
		const matched = infoSections.find((s) => s.id === id);
		if (matched && matched.route) {
			navigate(matched.route);
		} else {
			navigate(`/application/questionnaire/${id}`);
		}
	};

	const generateAndShowPdf = async () => {
		setIsGenerating(true);
		setGenerationError(null);
		setIsExpired(false);
		try {
			if (env.VITE_USE_MOCKS || env.VITE_USE_MOCK_AUTH) {
				const { MOCK_PDF_BASE64 } = await import("./mockPdf");
				const binaryString = window.atob(MOCK_PDF_BASE64);
				const bytes = new Uint8Array(binaryString.length);
				for (let i = 0; i < binaryString.length; i++) {
					bytes[i] = binaryString.charCodeAt(i);
				}
				const blob = new Blob([bytes], { type: "application/pdf" });
				const url = URL.createObjectURL(blob);
				setPdfUrl(url);
				setExportUrls({
					signed_open_url: url,
					signed_download_url: url,
					expires_in_seconds: 60,
				});
			} else {
				const response = await authenticatedFetch(
					`${env.VITE_API_URL}/export/antrag_grundsicherung`,
				);
				if (!response.ok) {
					throw new Error(`Failed to generate PDF: ${response.statusText}`);
				}
				const contentType =
					(typeof response.headers.get === "function"
						? response.headers.get("content-type") ||
							response.headers.get("Content-Type")
						: (response.headers as unknown as Record<string, string>)[
								"content-type"
							] ||
							(response.headers as unknown as Record<string, string>)[
								"Content-Type"
							]) || "";

				if (contentType.includes("application/json")) {
					const data: ExportUrls = await response.json();
					setExportUrls(data);
					setPdfUrl(data.signed_open_url);
				} else {
					const blob = await response.blob();
					const url = URL.createObjectURL(blob);
					setPdfUrl(url);
					setExportUrls({
						signed_open_url: url,
						signed_download_url: url,
						expires_in_seconds: 60,
					});
				}
			}
			setShowPreviewModal(true);
		} catch (err) {
			console.error("PDF generation failed:", err);
			setGenerationError(
				t(
					"overview.errors.generation_failed",
					"Konnte den Antrag nicht generieren. Bitte versuche es später noch einmal.",
				),
			);
		} finally {
			setIsGenerating(false);
		}
	};

	const handleGenerateClick = async () => {
		if (milestoneLevel < MAX_MILESTONE_LEVEL) {
			setShowConfirmModal(true);
			return;
		}
		await generateAndShowPdf();
	};

	const confirmSubmission = async () => {
		setShowConfirmModal(false);
		await generateAndShowPdf();
	};

	if (isLoading && !profileData) {
		return (
			<PageContainer maxWidth="md" bgColor="brand-bg" withPadding={false}>
				<div className="flex items-center justify-center min-h-[50vh] bg-brand-bg">
					<Loader2 className="w-8 h-8 animate-spin text-slate-500" />
				</div>
			</PageContainer>
		);
	}

	return (
		<PageContainer
			maxWidth="md"
			bgColor="brand-bg"
			withPadding={false}
			topBarProps={{
				onBack: () => navigate(AppRoutes.Dashboard),
				showLanguageSwitcher: true,
				colorVariant: "green",
			}}
		>
			<div className="flex flex-col gap-6 py-4 w-full min-w-0 max-w-md mx-auto min-h-screen bg-brand-bg">
				<div className="flex flex-col gap-6 px-6">
					{generationError && (
						<div
							className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-900 font-medium w-full max-w-md mx-auto px-6 text-sm text-left shadow-sm"
							role="alert"
						>
							<AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />
							<p>{generationError}</p>
						</div>
					)}
					<div className="flex flex-col gap-4 px-1 mt-1 text-left">
						<h1 className="text-[32px] font-extrabold text-brand-black tracking-tight leading-[38px] max-w-xs">
							{t("overview.main_title", "Antrag auf Grundsicherung")}
						</h1>
						<div className="bg-white p-5 rounded-3xl shadow-sm flex flex-col gap-3 w-full">
							<h2 className="text-base font-extrabold text-brand-black">
								{t(
									"overview.progress_card_title",
									"Dein Antrag Schritt für Schritt zum Ziel",
								)}
							</h2>
							<SegmentedProgressBar milestoneLevel={milestoneLevel} />
						</div>
					</div>

					<button
						type="button"
						onClick={scrollToGenerateButton}
						className={`bg-secondary-orange-200 flex flex-row gap-2 p-3.5 rounded-xl shadow-sm text-left w-full cursor-pointer hover:bg-secondary-orange-300/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-blue-500 focus-visible:ring-offset-2 mb-4
								${milestoneLevel >= 2 ? "block" : "hidden"}`}
						aria-label={t(
							"overview.generate_notice_scroll_label",
							"Zum Antrag generieren scrollen",
						)}
					>
						<p className="text-body-lg font-semibold text-brand-black">
							{t(
								"overview.generate_notice_title",
								"Dein Antrag ist fast fertig! Du kannst ihn jederzeit runterladen.",
							)}
						</p>
					</button>
				</div>

				<div className="flex flex-col gap-4 px-6">
					<QuestionnaireStatusList onCategoryClick={handleCategoryClick} />
				</div>

				{recentVerificationDocName && (
					<div className="px-6 pt-4 animate-in fade-in duration-300">
						<div className="p-4 bg-green-50 border border-green-200 rounded-2xl flex items-center justify-between gap-3 text-green-950 font-medium text-sm text-left shadow-sm">
							<div className="flex items-center gap-3">
								<CheckCircle2 className="w-5 h-5 shrink-0 text-green-600" />
								<p>
									{t(
										"overview.document_auto_verified_banner",
										`Dein Antrag wurde basierend auf deinem Dokument "${recentVerificationDocName}" aktualisiert.`,
										{ documentName: recentVerificationDocName },
									)}
								</p>
							</div>
							<button
								onClick={() => setDismissedDocId(recentVerificationDocId)}
								className="text-green-700 hover:text-green-950 cursor-pointer p-1"
								aria-label={t("docs.close_aria")}
							>
								<X className="w-4 h-4" />
							</button>
						</div>
					</div>
				)}

				<div
					ref={generateButtonContainerRef}
					className="px-6 pt-2 pb-6"
					id="generate-application-button-container"
				>
					<PrimaryButton
						ref={generateButtonRef}
						onClick={handleGenerateClick}
						disabled={isGenerating}
						data-testid="generate-application-button"
						className="w-full"
					>
						{isGenerating && (
							<Loader2 className="size-5 animate-spin mr-2 shrink-0" />
						)}
						{t("overview.generate_button", "Antrag generieren")}
					</PrimaryButton>
				</div>

				{/* Warning Confirmation Modal */}
				{showConfirmModal && (
					<ConfirmModal
						t={t as unknown as ConfirmModalProps["t"]}
						onClose={() => setShowConfirmModal(false)}
						onConfirm={confirmSubmission}
						isGenerating={isGenerating}
					/>
				)}

				{/* Invisible Iframe for SPA-Safe Downloading */}
				{invisibleDownloadUrl && (
					<iframe
						src={invisibleDownloadUrl}
						title="Download Handshake"
						className="hidden border-none"
					/>
				)}

				{/* PDF Preview Modal */}
				{showPreviewModal && (
					<PreviewModal
						t={t as unknown as PreviewModalProps["t"]}
						onClose={() => {
							setShowPreviewModal(false);
							setExportUrls(null);
							if (pdfUrl && pdfUrl.startsWith("blob:")) {
								URL.revokeObjectURL(pdfUrl);
							}
							setPdfUrl(null);
							setInvisibleDownloadUrl(null);
						}}
						isExpired={isExpired}
						generateAndShowPdf={generateAndShowPdf}
						isGenerating={isGenerating}
						isMobile={isMobile}
						pdfUrl={pdfUrl}
						secondsRemaining={secondsRemaining}
						exportUrls={exportUrls}
						setInvisibleDownloadUrl={setInvisibleDownloadUrl}
						onDownloadSuccess={() => {
							setShowPreviewModal(false);
							setShowSuccessModal(true);
						}}
					/>
				)}

				<DownloadSuccessModal
					isOpen={showSuccessModal}
					onClose={() => setShowSuccessModal(false)}
					district={profileData?.address?.district || null}
				/>
			</div>
		</PageContainer>
	);
};
