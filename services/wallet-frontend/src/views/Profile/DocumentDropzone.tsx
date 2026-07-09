import React, { useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import heic2any from "heic2any";
import { PrimaryButton } from "../../components/ui/PrimaryButton";
import {
	Upload,
	File,
	X,
	CheckCircle2,
	Loader2,
	AlertCircle,
	Camera,
} from "lucide-react";
import { z } from "zod";
import { StepLayout } from "../../components/Layout/StepLayout";
import { AppRoutes } from "../../constants/routes";
import { fileService } from "../../services/profile/FileService";
import {
	DocumentTypeEnum,
	type WalletDocument,
} from "../../schemas/profile.schema";
import { Origins, type OriginType } from "../../constants/origin";

import { useAuthStore } from "../../store/useAuthStore";
import { useProfileStore } from "../../store/useProfileStore";
import { useUIStore } from "../../store/useUIStore";
import { useProfile } from "../../hooks/useProfile";
import { useScrollToTop } from "../../utils/scroll";
import { useQueryClient } from "@tanstack/react-query";
import {
	getTargetExitRoute as getSharedExitRoute,
	performMockAutoVerification,
	getMockProfileStorageKey,
} from "../../utils/profile";
import { env } from "../../config/env.config";
import { authenticatedFetch } from "../../utils/apiClient";

export const DocumentDropzone: React.FC = () => {
	const { t } = useTranslation("profile");
	const navigate = useNavigate();
	const location = useLocation();
	const queryClient = useQueryClient();
	const searchParams = new URLSearchParams(location.search);

	const rawOrigin = searchParams.get("origin") || Origins.HUB;
	const origin: OriginType =
		rawOrigin === Origins.WIZARD || rawOrigin === Origins.HUB
			? rawOrigin
			: Origins.UNKNOWN;
	const mode = searchParams.get("mode") || "upload";
	const category = searchParams.get("category");

	const getTargetExitRoute = () => {
		return getSharedExitRoute(origin, category, "upload");
	};

	const [files, setFiles] = useState<File[]>([]);
	const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
	const [status, setStatus] = useState<
		"IDLE" | "UPLOADING" | "PROCESSING" | "SUCCESS" | "ERROR"
	>("IDLE");
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [uploadedDocId, setUploadedDocId] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const addPageInputRef = useRef<HTMLInputElement>(null);
	const { documents } = useProfile();
	const processingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);
	const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const abortControllerRef = useRef<AbortController | null>(null);

	// Reset scrolling when status changes since it renders different page content.
	useScrollToTop(status);

	React.useEffect(() => {
		return () => {
			if (processingTimeoutRef.current) {
				clearTimeout(processingTimeoutRef.current);
				processingTimeoutRef.current = null;
			}
			if (successTimeoutRef.current) {
				clearTimeout(successTimeoutRef.current);
				successTimeoutRef.current = null;
			}
			if (abortControllerRef.current) {
				abortControllerRef.current.abort();
				abortControllerRef.current = null;
			}
		};
	}, []);

	React.useEffect(() => {
		return () => {
			imagePreviewUrls.forEach((url) => {
				if (url.startsWith("blob:")) {
					URL.revokeObjectURL(url);
				}
			});
		};
	}, [imagePreviewUrls]);

	const handleMockAutoVerify = React.useCallback(
		(docId: string) => {
			try {
				const state = useAuthStore.getState();
				const phone = state.phoneNumber || "default";
				const activeStorageKey = getMockProfileStorageKey(phone);
				const storedProfile = localStorage.getItem(activeStorageKey);
				let mockFirstName = "Helmut";
				let mockLastName = "Klar";

				const profileObj = storedProfile
					? JSON.parse(storedProfile)
					: { documents: useProfileStore.getState().documents || [] };

				const docs: WalletDocument[] = profileObj.documents || [];
				const docToUpdate = docs.find((d) => d.id === docId);
				if (docToUpdate) {
					docToUpdate.status = "VERIFIED";
					docToUpdate.updatedAt = new Date().toISOString();

					const { updatedProfile, hasChanges } = performMockAutoVerification(
						profileObj,
						docToUpdate,
					);

					if (hasChanges) {
						Object.assign(profileObj, updatedProfile);
						mockFirstName = updatedProfile.personalData?.firstName || "Helmut";
						mockLastName = updatedProfile.personalData?.lastName || "Klar";
					}

					localStorage.setItem(activeStorageKey, JSON.stringify(profileObj));
				}
				void queryClient.invalidateQueries({ queryKey: ["profile"] });

				if (category === "about_me") {
					navigate(AppRoutes.ApplicationAboutMeQuestions, {
						state: {
							extractedData: {
								given_names: mockFirstName,
								family_name: mockLastName,
								birth_date: "1959-05-12",
								birth_place: "Berlin",
							},
						},
					});
				} else if (category === "housing") {
					navigate(AppRoutes.ApplicationHousingQuestions, {
						state: {
							extractedData: {
								accomodation_type: "Rental Apartment",
								tenancy_status: "Main Tenant",
								rent_total: 430,
								heating_costs: 80,
								living_area: 50,
								number_of_rooms: 2,
								landlord_name: "Muster Vermieter",
								cable_tv_costs: 10,
								hot_water_costs: 20,
							},
						},
					});
				} else {
					navigate(AppRoutes.ApplicationOverview);
				}
			} catch (err) {
				console.error("Mock auto verify failed:", err);
			}
		},
		[category, navigate, queryClient],
	);

	const handleAutoVerify = React.useCallback(
		async (docId: string) => {
			if (env.VITE_USE_MOCKS || env.VITE_USE_MOCK_AUTH) {
				handleMockAutoVerify(docId);
				return;
			}

			try {
				const extResp = await authenticatedFetch(
					`${env.VITE_API_URL}/api/v1/documents/${docId}/extractions`,
				);
				if (!extResp.ok) {
					throw new Error("Failed to fetch extractions");
				}
				const extData = await extResp.json();
				const rawData = extData.raw_data || {};
				const docType = extData.document_type || "id_card";

				const verifyResp = await authenticatedFetch(
					`${env.VITE_API_URL}/api/v1/documents/${docId}/verify`,
					{
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							corrected_data: rawData,
							verified_fields: Object.keys(rawData),
							document_type: docType,
						}),
					},
				);

				if (!verifyResp.ok) {
					throw new Error("Auto-verification failed");
				}

				void queryClient.invalidateQueries({ queryKey: ["profile"] });

				if (category === "about_me") {
					navigate(AppRoutes.ApplicationAboutMeQuestions, {
						state: { extractedData: rawData },
					});
				} else if (category === "housing") {
					navigate(AppRoutes.ApplicationHousingQuestions, {
						state: { extractedData: rawData },
					});
				} else if (category === "income_assets") {
					navigate(AppRoutes.ApplicationIncomeAssetsQuestions, {
						state: { extractedData: rawData },
					});
				} else if (category === "health") {
					navigate(AppRoutes.ApplicationHealthQuestions, {
						state: { extractedData: rawData },
					});
				} else {
					navigate(AppRoutes.ApplicationOverview);
				}
			} catch (err) {
				console.error("Auto verify failed:", err);

				// Try to load raw extraction data if possible, to pass to wizard
				let extractedData = {};
				try {
					const extResp = await authenticatedFetch(
						`${env.VITE_API_URL}/api/v1/documents/${docId}/extractions`,
					);
					if (extResp.ok) {
						const extData = await extResp.json();
						extractedData = extData.raw_data || {};
					}
				} catch (innerErr) {
					console.error(
						"Failed to fetch raw extractions during error fallback:",
						innerErr,
					);
				}

				if (origin === "wizard") {
					if (category === "about_me") {
						navigate(AppRoutes.ApplicationAboutMeQuestions, {
							state: { extractedData },
						});
					} else if (category === "housing") {
						navigate(AppRoutes.ApplicationHousingQuestions, {
							state: { extractedData },
						});
					} else {
						navigate(AppRoutes.ApplicationOverview);
					}
				} else {
					navigate(
						`${AppRoutes.ProfileDocumentReview.replace(
							":documentId",
							docId,
						)}?origin=${origin}${category ? `&category=${category}` : ""}`,
					);
				}
			}
		},
		[category, navigate, origin, queryClient, handleMockAutoVerify],
	);

	React.useEffect(() => {
		if (status === "PROCESSING" && uploadedDocId) {
			const activeMatch = (documents || []).find(
				(d: WalletDocument) => d.id === uploadedDocId,
			);
			if (activeMatch) {
				if (activeMatch.status === "READY_FOR_REVIEW") {
					setStatus("SUCCESS");
					if (processingTimeoutRef.current) {
						clearTimeout(processingTimeoutRef.current);
						processingTimeoutRef.current = null;
					}
					const successDelay = import.meta.env.MODE === "test" ? 50 : 1500;
					successTimeoutRef.current = setTimeout(() => {
						if (origin === "wizard") {
							void handleAutoVerify(uploadedDocId);
						} else {
							navigate(
								`${AppRoutes.ProfileDocumentReview.replace(
									":documentId",
									uploadedDocId,
								)}?origin=${origin}${category ? `&category=${category}` : ""}`,
							);
						}
					}, successDelay);
				}

				if (activeMatch.status === "FAILED") {
					setStatus("ERROR");
					setErrorMessage(
						activeMatch.user_error_code ||
							t(
								"errors.processing_failed",
								"Dokumentenverarbeitung fehlgeschlagen.",
							),
					);
					if (processingTimeoutRef.current) {
						clearTimeout(processingTimeoutRef.current);
						processingTimeoutRef.current = null;
					}
				}
			}
		}
		return undefined;
	}, [
		documents,
		status,
		uploadedDocId,
		navigate,
		origin,
		t,
		category,
		handleAutoVerify,
	]);

	const handlePreviewFile = async (file: File, isAdd: boolean) => {
		let url = "";
		const extension = file.name.split(".").pop()?.toLowerCase();

		switch (extension) {
			case "heic":
			case "heif":
				try {
					const blob = await heic2any({ blob: file, toType: "image/jpeg" });
					url = URL.createObjectURL(Array.isArray(blob) ? blob[0] : blob);
				} catch (error) {
					console.error("Failed to generate preview for HEIC:", error);
				}
				break;

			case "jpg":
			case "jpeg":
			case "png":
			case "bmp":
				url = URL.createObjectURL(file);
				break;

			case "pdf":
				// ignore preview generation for PDFs
				break;

			default:
				// fallback for other standard web image mime-types
				if (file.type.startsWith("image/")) {
					url = URL.createObjectURL(file);
				}
				break;
		}

		if (url) {
			setImagePreviewUrls((prev) => (isAdd ? [...prev, url] : [url]));
		} else if (!isAdd) {
			setImagePreviewUrls([]);
		}
	};

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const selectedFile = e.target.files?.[0];
		if (selectedFile) {
			setFiles([selectedFile]);
			void handlePreviewFile(selectedFile, false);
			setStatus("IDLE");
			setErrorMessage(null);
		}
		e.target.value = "";
	};

	const handleAddPage = (e: React.ChangeEvent<HTMLInputElement>) => {
		const selectedFile = e.target.files?.[0];
		if (selectedFile) {
			setFiles((prev) => [...prev, selectedFile]);
			void handlePreviewFile(selectedFile, true);
			setStatus("IDLE");
			setErrorMessage(null);
		}
		e.target.value = "";
	};

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
	};

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		const droppedFile = e.dataTransfer.files?.[0];
		if (droppedFile) {
			setFiles([droppedFile]);
			void handlePreviewFile(droppedFile, false);
			setStatus("IDLE");
			setErrorMessage(null);
		}
	};

	const handleUpload = async () => {
		if (files.length === 0) {
			return;
		}

		const token = useAuthStore.getState().token;
		if (!token) {
			navigate(AppRoutes.Auth);
			return;
		}

		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
		}
		const controller = new AbortController();
		abortControllerRef.current = controller;

		setStatus("UPLOADING");
		try {
			const rawType = searchParams.get("type");
			let defaultType: z.infer<typeof DocumentTypeEnum> = "OTHER";
			if (category === "income_assets") {
				defaultType = "BANK_STATEMENT";
			} else if (category === "about_me") {
				defaultType = "ID_CARD";
			} else if (category === "housing") {
				defaultType = "RENTAL_CONTRACT";
			}
			const parsedType = DocumentTypeEnum.safeParse(rawType);
			const targetType = parsedType.success ? parsedType.data : defaultType;

			const response = await fileService.uploadFile(
				files,
				targetType,
				controller.signal,
			);

			if (response.aborted || controller.signal.aborted) {
				return;
			}

			if (response.success && response.document?.id) {
				void queryClient.invalidateQueries({ queryKey: ["profile"] });
				setUploadedDocId(response.document.id);
				setStatus("PROCESSING");

				// Start the 30-second threshold timeout for Path B (backgrounding)
				const timeoutDuration = import.meta.env.MODE === "test" ? 1000 : 30000;
				processingTimeoutRef.current = setTimeout(() => {
					useUIStore.getState().showToast({
						type: "success",
						title: t("personal.upload.background_processing_title"),
						message: t("personal.upload.background_processing_desc"),
					});
					navigate(getTargetExitRoute());
				}, timeoutDuration);
			} else {
				if (!useAuthStore.getState().token) {
					navigate(AppRoutes.Auth);
					return;
				}
				setStatus("ERROR");
				setErrorMessage(
					response.message || t("errors.upload_failed", "Upload failed"),
				);
			}
		} catch (error) {
			if (controller.signal.aborted) {
				return;
			}
			if (!useAuthStore.getState().token) {
				navigate(AppRoutes.Auth);
				return;
			}
			setStatus("ERROR");
			setErrorMessage(t("errors.system_error", "A system error occurred"));
			console.error("Upload error:", error);
		} finally {
			if (abortControllerRef.current === controller) {
				abortControllerRef.current = null;
			}
		}
	};

	const removeFile = (index: number) => {
		const url = imagePreviewUrls[index];
		if (url && url.startsWith("blob:")) {
			URL.revokeObjectURL(url);
		}

		const newFiles = [...files];
		newFiles.splice(index, 1);

		const newUrls = [...imagePreviewUrls];
		newUrls.splice(index, 1);

		setFiles(newFiles);
		setImagePreviewUrls(newUrls);

		setStatus("IDLE");
		setErrorMessage(null);

		if (newFiles.length === 0 && fileInputRef.current) {
			fileInputRef.current.value = "";
		}
		if (addPageInputRef.current) {
			addPageInputRef.current.value = "";
		}
	};

	const renderSuccessState = () => (
		<div className="flex flex-col items-center gap-6 py-12 text-center animate-in fade-in zoom-in duration-300">
			<div className="size-20 bg-green-100 rounded-full flex items-center justify-center">
				<CheckCircle2 className="size-10 text-green-600" />
			</div>
			<div className="flex flex-col gap-2">
				<h2 className="text-2xl font-bold text-brand-carbon">
					{t("personal.upload.success_title", "Dokument hochgeladen!")}
				</h2>
				<p className="text-brand-slate">
					{t(
						"personal.upload.success_desc",
						"Wir verarbeiten Dein Dokument jetzt. Du wirst gleich weitergeleitet.",
					)}
				</p>
			</div>
		</div>
	);

	const renderLoadingState = () => (
		<div className="flex flex-col items-center gap-6 py-12 text-center">
			<div className="size-20 bg-brand-muted rounded-full flex items-center justify-center">
				<Loader2 className="size-10 text-brand-black animate-spin" />
			</div>
			<div className="flex flex-col gap-2">
				<h2 className="text-2xl font-bold text-brand-carbon">
					{status === "UPLOADING"
						? t("personal.upload.uploading", "Wird hochgeladen...")
						: t("personal.upload.processing", "Wird verarbeitet...")}
				</h2>
				<p className="text-brand-slate animate-pulse">
					{t(
						"personal.upload.processing_desc",
						"Dies dauert normalerweise nur wenige Sekunden.",
					)}
				</p>
			</div>
		</div>
	);

	const renderDropzoneArea = () => {
		if (files.length > 0) {
			return (
				<div className="flex flex-col gap-4 w-full h-full p-4 md:p-6 overflow-y-auto">
					<div className="grid grid-cols-2 md:grid-cols-3 gap-4">
						{files.map((file, index) => (
							<div
								key={`${file.name}-${index}`}
								className="relative flex flex-col items-center gap-2"
							>
								<div className="relative w-full aspect-[3/4] bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden group">
									{imagePreviewUrls[index] ? (
										<img
											src={imagePreviewUrls[index]}
											alt={`Seite ${index + 1}`}
											className="w-full h-full object-cover"
										/>
									) : (
										<div className="w-full h-full flex flex-col items-center justify-center text-brand-black/40">
											<File className="size-8 mb-2" />
											<span className="text-xs font-medium px-2 text-center truncate w-full">
												PDF
											</span>
										</div>
									)}

									<button
										onClick={(e) => {
											e.stopPropagation();
											removeFile(index);
										}}
										className="absolute top-2 right-2 size-8 bg-white/90 hover:bg-red-50 hover:text-red-600 shadow-sm rounded-full flex items-center justify-center text-brand-black/70 transition-colors cursor-pointer"
										aria-label={t("common.remove_file")}
									>
										<X className="size-4" />
									</button>
								</div>
								<div className="w-full flex flex-col items-center">
									<span className="text-xs font-medium text-brand-slate text-center">
										{t("personal.upload.page", "Seite")} {index + 1}
									</span>
								</div>
							</div>
						))}

						{files.length > 0 &&
							!files[0].type.includes("pdf") &&
							!files[0].name.toLowerCase().endsWith(".pdf") && (
								<button
									onClick={(e) => {
										e.stopPropagation();
										addPageInputRef.current?.click();
									}}
									className="relative w-full aspect-[3/4] flex flex-col items-center justify-center gap-3 bg-brand-bg hover:bg-slate-100 rounded-2xl border-2 border-dashed border-slate-300 hover:border-brand-black/40 transition-colors cursor-pointer group"
								>
									<div className="size-10 bg-white shadow-sm rounded-full flex items-center justify-center text-brand-black group-hover:scale-110 transition-transform">
										<Upload className="size-5" />
									</div>
									<span className="text-sm font-medium text-brand-black">
										{t("personal.upload.add_page", "Weitere Seite")}
									</span>
								</button>
							)}
					</div>
				</div>
			);
		}

		if (mode === "camera") {
			return (
				<div className="flex flex-col items-center gap-4 text-center px-8">
					<div className="size-16 bg-brand-black/5 rounded-2xl flex items-center justify-center text-brand-black">
						<Camera className="size-8 text-primary-blue-500" />
					</div>
					<div className="flex flex-col gap-1">
						<p className="font-bold text-brand-black">
							{t("personal.choice.camera.button", "Kamera öffnen")}
						</p>
						<p className="text-sm text-brand-black/70">
							{t(
								"personal.upload.camera_hint",
								"Bitte das Dokument gut ausgeleuchtet und flach hinlegen.",
							)}
						</p>
					</div>
				</div>
			);
		}

		return (
			<div className="flex flex-col items-center gap-4 text-center px-8">
				<div className="size-16 bg-brand-black/5 rounded-2xl flex items-center justify-center text-brand-black">
					<Upload className="size-8" />
				</div>
				<div className="flex flex-col gap-1">
					<p className="font-bold text-brand-black">
						{t("personal.upload.drag_drop")}
					</p>
					<p className="text-sm text-brand-black/70">
						{t("personal.upload.formats", "PDF, JPG, PNG or HEIC (max. 10MB)")}
					</p>
				</div>
			</div>
		);
	};

	const getSubmitButtonText = () => {
		if (files.length > 0) {
			if (mode === "camera") {
				return t("personal.upload.confirm_camera");
			}
			return t("personal.upload.confirm");
		}
		if (mode === "camera") {
			return t("personal.upload.start_camera");
		}
		return t("personal.upload.start_upload");
	};

	const renderContent = () => {
		if (status === "SUCCESS") {
			return renderSuccessState();
		}

		if (status === "PROCESSING" || status === "UPLOADING") {
			return renderLoadingState();
		}

		return (
			<div className="w-full flex flex-col gap-8">
				<div className="flex flex-col gap-4 text-center">
					<h1 className="text-3xl font-bold text-brand-black leading-tight">
						{mode === "camera"
							? t("personal.choice.camera.title", "Mit Kamera scannen")
							: t("personal.choice.upload.title", "Dokument hochladen")}
					</h1>
					<p className="text-lg text-brand-black/70">
						{mode === "camera"
							? t(
									"personal.choice.camera.desc",
									"Lade ein Foto Deines Dokuments hoch.",
								)
							: t(
									"personal.choice.upload.desc",
									"Lade ein Foto oder PDF Deines Dokuments hoch.",
								)}
					</p>
				</div>

				{errorMessage && (
					<div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-900 font-medium animate-in fade-in slide-in-from-top-1">
						<AlertCircle className="size-5 shrink-0" />
						<p>{errorMessage}</p>
					</div>
				)}

				<div
					role="button"
					tabIndex={0}
					data-testid="dropzone-select-trigger"
					aria-label={
						mode === "camera"
							? "Kamera öffnen"
							: "Datei auswählen oder hierher ziehen"
					}
					onKeyDown={(e) => {
						if (e.key === "Enter" || e.key === " ") {
							e.preventDefault();
							if (files.length === 0) {
								fileInputRef.current?.click();
							}
						}
					}}
					onDragOver={handleDragOver}
					onDrop={handleDrop}
					onClick={() => files.length === 0 && fileInputRef.current?.click()}
					className={`
            relative w-full aspect-square md:aspect-video flex flex-col items-center justify-center gap-4
            border-3 border-dashed rounded-3xl transition-all cursor-pointer select-none
            ${
							files.length > 0
								? "border-brand-black bg-white"
								: "border-brand-border-subtle bg-brand-bg hover:bg-white hover:border-brand-black/30"
						}
          `}
				>
					<input
						type="file"
						ref={fileInputRef}
						onChange={handleFileChange}
						onClick={(e) => e.stopPropagation()}
						accept={
							mode === "camera" ? "image/*" : ".pdf,.jpg,.jpeg,.png,.heic,.heif"
						}
						capture={mode === "camera" ? "environment" : undefined}
						className="hidden"
					/>

					<input
						type="file"
						ref={addPageInputRef}
						onChange={handleAddPage}
						onClick={(e) => e.stopPropagation()}
						accept="image/*"
						capture={mode === "camera" ? "environment" : undefined}
						className="hidden"
					/>

					{renderDropzoneArea()}
				</div>

				{files.length > 0 && status === "IDLE" && (
					<div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
						<PrimaryButton
							onClick={handleUpload}
							data-testid="upload-confirm-button"
						>
							{getSubmitButtonText()}
						</PrimaryButton>
					</div>
				)}
			</div>
		);
	};

	return (
		<StepLayout onBack={() => navigate(getTargetExitRoute())}>
			<div className="max-w-md w-full mx-auto">{renderContent()}</div>
		</StepLayout>
	);
};
