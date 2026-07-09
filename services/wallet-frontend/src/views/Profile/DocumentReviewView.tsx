import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { X, Edit3, Check, AlertCircle } from "lucide-react";
import { PageContainer } from "../../components/Layout/PageContainer";
import { AppRoutes } from "../../constants/routes";
import { env } from "../../config/env.config";
import { authenticatedFetch } from "../../utils/apiClient";
import { useProfileStore } from "../../store/useProfileStore";
import { useAuthStore } from "../../store/useAuthStore";
import { fileService } from "../../services/profile/FileService";
import { useProfile } from "../../hooks/useProfile";
import { ConfirmationModal } from "../../components/ui/ConfirmationModal";
import { REQUIRED_DOCUMENT_SLOTS } from "../../config/applicationConfig";
import {
	mapBackendDocTypeToSlotId,
	getTargetExitRoute,
	performMockAutoVerification,
	getMockProfileStorageKey,
} from "../../utils/profile";
import type { WalletDocument } from "../../schemas/profile.schema";
import { Origins, type OriginType } from "../../constants/origin";
import { formatDateString, convertGermanToIsoDate } from "../../utils/date";

const ENUM_TRANSLATION_KEYS: Record<string, Record<string, string>> = {
	health_insurance_status: {
		compulsory_insurance: "compulsory_insurance",
		voluntary_insurance: "voluntary_insurance",
		family_insurance: "family_insurance",
		private_insurance: "private_insurance",
		care_by_health_insurance_under_264_sgb_v:
			"care_by_health_insurance_under_264_sgb_v",
	},
};

const DATE_SCHEMA_FIELDS = new Set([
	"birth_date",
	"date_of_birth",
	"issued_on",
	"valid_until",
	"date_of_issue",
	"date_of_moving",
	"marriage_date",
	"married_since",
	"displaced_issued_on",
	"disability_valid_until",
	"confirmation_date",
	"statement_date",
	"date_issued",
	"date_of_application",
	"start_date_of_pension",
	"end_date_of_pension",
	"decision_date",
	"contract_end_date",
	"start_date_of_rent",
	"end_date_of_rent",
	"effective_date",
	"agreement_date",
	"application_date",
	"assignment_date",
	"divorce_date",
	"expected_due_date",
	"report_date",
	"statement_period_start",
	"statement_period_end",
	"period_from",
	"period_to",
	"estimated_start_of_pension",
	"effective_from",
]);

const isDateField = (key: string, value?: unknown): boolean => {
	// 1. Dynamic value check: if the value matches ISO/German date formats, it is a date
	if (
		typeof value === "string" &&
		(/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(value) ||
			/^\d{2}\.\d{2}\.\d{4}$/.test(value))
	) {
		return true;
	}
	// 2. Explicit schema lookup
	return DATE_SCHEMA_FIELDS.has(key.toLowerCase());
};

const normalizeBooleanForUi = (value: unknown): boolean | undefined => {
	if (typeof value === "boolean") {
		return value;
	}
	if (typeof value === "string") {
		const normalized = value.trim().toLowerCase();
		if (["true", "yes", "ja", "1"].includes(normalized)) {
			return true;
		}
		if (["false", "no", "nein", "0"].includes(normalized)) {
			return false;
		}
	}
	return undefined;
};

const renderFieldValue = (
	fieldKey: string,
	value: unknown,
	t: (key: string, opts?: { defaultValue?: string }) => string,
): string => {
	if (value === null || value === undefined) {
		return "—";
	}
	const boolValue = normalizeBooleanForUi(value);
	if (boolValue !== undefined) {
		return boolValue
			? t("common.yes", { defaultValue: "Ja" })
			: t("common.no", { defaultValue: "Nein" });
	}
	const enumMap = ENUM_TRANSLATION_KEYS[fieldKey];
	if (enumMap && typeof value === "string" && enumMap[value]) {
		return t(enumMap[value], { defaultValue: String(value) });
	}
	if (isDateField(fieldKey, value) && typeof value === "string") {
		return formatDateString(value);
	}
	return String(value);
};

interface LocalizedValidationErrorParams {
	field: string;
	msg: string | undefined;
	type: string | undefined;
	t: (key: string, opts?: { defaultValue?: string }) => string;
}

const getLocalizedValidationError = ({
	field,
	msg,
	type,
	t,
}: LocalizedValidationErrorParams): string => {
	const safeType = type || "";
	const safeMsg = msg || "";

	if (safeType === "value_error") {
		if (safeMsg.includes("at least one character")) {
			return t("validation.empty_string");
		}
		if (safeMsg.includes("E.164")) {
			return t("validation.invalid_phone");
		}
		if (safeMsg.includes("exactly five digits")) {
			return t("validation.invalid_zip");
		}
		if (safeMsg.includes("cannot be in the future")) {
			return t("validation.future_date_not_allowed");
		}
		if (safeMsg.includes("must be in the past")) {
			return t("validation.past_date_required");
		}
		if (safeMsg.includes("must be in the future")) {
			return t("validation.future_date_required");
		}
	}
	if (safeType.includes("decimal") || safeMsg.includes("decimal")) {
		return t("validation.invalid_decimal");
	}
	if (safeType.includes("date") || safeMsg.includes("date")) {
		return t("validation.invalid_date");
	}
	if (
		safeType === "greater_than" ||
		safeType === "less_than" ||
		safeType.includes("int")
	) {
		return t("validation.invalid_number");
	}
	if (field === "nationality" || field === "second_nationality") {
		return t("validation.invalid_country");
	}
	if (field === "legal_gender") {
		return t("validation.invalid_gender");
	}
	return t("validation.value_error");
};

export const DocumentReviewView: React.FC = () => {
	const { t } = useTranslation("profile");
	const { t: tApplication } = useTranslation("application");
	const { documentId } = useParams<{ documentId: string }>();
	const navigate = useNavigate();
	const location = useLocation();
	const queryClient = useQueryClient();
	const searchParams = new URLSearchParams(location.search);
	const rawOrigin = searchParams.get("origin");
	const origin: OriginType =
		rawOrigin === Origins.WIZARD || rawOrigin === Origins.HUB
			? rawOrigin
			: Origins.UNKNOWN;
	const category = searchParams.get("category");

	const setDocuments = useProfileStore((s) => s.setDocuments);
	const { deleteDocument } = useProfile();
	const [showDeleteModal, setShowDeleteModal] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const [loading, setLoading] = useState(true);
	const [docType, setDocType] = useState("id_card");
	const [correctedData, setCorrectedData] = useState<Record<string, unknown>>(
		{},
	);
	const [verifiedFields, setVerifiedFields] = useState<string[]>([]);

	const documents = useProfileStore((s) => s.documents || []);
	const currentDoc = Array.isArray(documents)
		? documents.find((d) => d.id === documentId)
		: undefined;

	useEffect(() => {
		if (!documentId || documentId === "undefined") {
			navigate(AppRoutes.ProfileDocuments);
		}
	}, [documentId, navigate]);

	useEffect(() => {
		if (currentDoc?.type) {
			setDocType(mapBackendDocTypeToSlotId(currentDoc.type));
		}
	}, [currentDoc]);

	// Inline editing state
	const [editingField, setEditingField] = useState<string | null>(null);
	const [editBuffer, setEditBuffer] = useState("");
	const [saveError, setSaveError] = useState<string | null>(null);
	const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

	useEffect(() => {
		let active = true;
		const loadExtractions = async () => {
			if (!documentId) {
				return;
			}
			if (
				import.meta.env.MODE !== "test" &&
				(env.VITE_USE_MOCKS ||
					env.VITE_USE_MOCK_AUTH ||
					!documentId.includes("-"))
			) {
				let raw: Record<string, string> = {
					given_names: "Max",
					family_name: "Mustermann",
					birth_date: "1990-01-01",
					birth_place: "Berlin",
				};

				const normalizedDocType = currentDoc?.type
					? mapBackendDocTypeToSlotId(currentDoc.type)
					: category;

				if (normalizedDocType === "rent") {
					raw = {
						rent_total: "430.00",
						heating_costs: "80.00",
						living_area: "50",
						number_of_rooms: "2",
						landlord_name: "Muster Vermieter",
						cable_tv_costs: "10.00",
						hot_water_costs: "20.00",
					};
				} else if (normalizedDocType === "heating") {
					raw = {
						heating_costs: "80.00",
						heating_type: "Sammelheizung",
					};
				} else if (
					normalizedDocType === "stmt3" ||
					normalizedDocType === "bank"
				) {
					raw = {
						bank_name: "Sparkasse Musterstadt",
						account_holder: "Helmut Klar",
						iban: "DE65940594210000123456",
						bic: "WELADED1BER",
						monthly_income: "650.00",
					};
				}
				if (active) {
					setCorrectedData(raw);
					setVerifiedFields(Object.keys(raw));
					setLoading(false);
				}
				return;
			}
			try {
				const response = await authenticatedFetch(
					`${env.VITE_API_URL}/api/v1/documents/${documentId}/extractions`,
				);
				if (response.ok && active) {
					const data = await response.json();
					const raw = data.raw_data || {};
					setCorrectedData(raw);
					// Prefill all extracted fields as checked/verified by default
					setVerifiedFields(
						Object.keys(raw).filter(
							(k) => raw[k] !== null && raw[k] !== undefined,
						),
					);
					if (data.document_type) {
						setDocType(mapBackendDocTypeToSlotId(data.document_type));
					}
				}
			} catch (err) {
				console.error("Failed to load document extractions:", err);
			} finally {
				if (active) {
					setLoading(false);
				}
			}
		};
		void loadExtractions();
		return () => {
			active = false;
		};
	}, [documentId, category, currentDoc?.type]);

	const toggleVerified = (field: string) => {
		if (verifiedFields.includes(field)) {
			setVerifiedFields(verifiedFields.filter((f) => f !== field));
		} else {
			setVerifiedFields([...verifiedFields, field]);
		}
	};

	const startEditing = (field: string, currentVal: unknown) => {
		setEditingField(field);
		const boolValue = normalizeBooleanForUi(currentVal);
		if (boolValue !== undefined) {
			setEditBuffer(boolValue ? "true" : "false");
			return;
		}
		const stringVal = String(currentVal ?? "");
		setEditBuffer(
			isDateField(field, stringVal) ? formatDateString(stringVal) : stringVal,
		);
	};

	const saveInlineEdit = (field: string) => {
		const nextValue =
			normalizeBooleanForUi(correctedData[field]) !== undefined
				? editBuffer === "true"
				: editBuffer;
		setCorrectedData({ ...correctedData, [field]: nextValue });
		setEditingField(null);
		if (fieldErrors[field]) {
			const { [field]: _removed, ...newErrors } = fieldErrors;
			setFieldErrors(newErrors);
		}
	};

	const parseErrorDetail = (errData: unknown, fallback: string): string => {
		if (!errData || typeof errData !== "object") {
			return fallback;
		}
		const data = errData as { detail?: unknown };
		if (Array.isArray(data.detail)) {
			const msgs = data.detail
				.map(
					(d: { loc?: string[]; msg?: string }) =>
						`${d.loc?.slice(-1)?.[0] || "Feld"}: ${d.msg}`,
				)
				.join(", ");
			if (msgs) {
				return msgs;
			}
		} else if (typeof data.detail === "string") {
			return data.detail;
		} else if (data.detail && typeof data.detail === "object") {
			const detailObj = data.detail as {
				message?: string;
				errors?: Record<
					string,
					Array<{ message: string; field_path?: string }>
				>;
			};
			if (detailObj.errors) {
				const msgs = Object.entries(detailObj.errors)
					.map(([field, errorsList]) => {
						const fieldMsgs = errorsList.map((fe) => fe.message).join(", ");
						return `${field}: ${fieldMsgs}`;
					})
					.join(", ");
				if (msgs) {
					return msgs;
				}
			}
			if (detailObj.message) {
				return detailObj.message;
			}
		}
		return fallback;
	};

	const errorBannerRef = useRef<HTMLDivElement>(null);

	const scrollToError = () => {
		requestAnimationFrame(() => {
			errorBannerRef.current?.scrollIntoView({
				behavior: "smooth",
				block: "center",
			});
		});
	};

	const constructPayloadData = (
		data: Record<string, unknown>,
		field: string | null,
		buffer: string,
	): Record<string, unknown> => {
		const payloadData: Record<string, unknown> = { ...data };
		if (field) {
			payloadData[field] =
				normalizeBooleanForUi(data[field]) !== undefined
					? buffer === "true"
					: buffer;
		}
		return payloadData;
	};

	const sanitizePayload = (
		payloadData: Record<string, unknown>,
	): Record<string, unknown> => {
		const sanitizedPayload: Record<string, unknown> = {};
		for (const key of Object.keys(payloadData)) {
			const rawVal = payloadData[key];
			if (rawVal === null || rawVal === undefined) {
				sanitizedPayload[key] = "";
				continue;
			}
			if (normalizeBooleanForUi(rawVal) !== undefined) {
				sanitizedPayload[key] = normalizeBooleanForUi(rawVal);
				continue;
			}
			const stringVal = String(rawVal);
			sanitizedPayload[key] = isDateField(key, stringVal)
				? convertGermanToIsoDate(stringVal)
				: stringVal;
		}
		return sanitizedPayload;
	};

	const checkIsMockEnvironment = (): boolean => {
		return (
			import.meta.env.MODE !== "test" &&
			(env.VITE_USE_MOCKS === true ||
				env.VITE_USE_MOCK_AUTH === true ||
				!documentId?.includes("-"))
		);
	};

	const handleMockVerification = async () => {
		const state = useAuthStore.getState();
		const phone = state.phoneNumber || "default";
		const activeStorageKey = getMockProfileStorageKey(phone);
		const storedProfile = localStorage.getItem(activeStorageKey);
		if (storedProfile) {
			const profileObj = JSON.parse(storedProfile);
			const docs: WalletDocument[] = profileObj.documents || [];
			const docToUpdate = docs.find((d) => d.id === documentId);
			if (docToUpdate) {
				docToUpdate.status = "VERIFIED";
				docToUpdate.updatedAt = new Date().toISOString();

				const { updatedProfile, hasChanges } = performMockAutoVerification(
					profileObj,
					docToUpdate,
				);

				if (hasChanges) {
					Object.assign(profileObj, updatedProfile);
				}

				localStorage.setItem(activeStorageKey, JSON.stringify(profileObj));
				void queryClient.invalidateQueries({ queryKey: ["profile"] });
			}
		}

		const stateDocs =
			useProfileStore.getState && typeof useProfileStore.getState === "function"
				? useProfileStore.getState().documents
				: [];
		const updatedDocs = (stateDocs || []).map((d) =>
			d.id === documentId ? { ...d, status: "VERIFIED" as const } : d,
		);
		setDocuments(updatedDocs);
		const categoryParam = category ? `&category=${category}` : "";
		navigate(
			`${AppRoutes.ProfileDocumentSuccess.replace(":documentId", documentId as string)}?origin=${origin}${categoryParam}`,
		);
		return;
	};

	interface ParseSubmitErrorParams {
		response: Response;
		fallbackMsg: string;
		setErrors: (e: Record<string, string>) => void;
		translationFn: (key: string, opts?: { defaultValue?: string }) => string;
	}

	const processErrorDetails = (
		detailObj: {
			message?: string;
			errors?: Record<
				string,
				Array<{ message: string; type: string; field_path?: string }>
			>;
		},
		setErrors: (e: Record<string, string>) => void,
		translationFn: (key: string, opts?: { defaultValue?: string }) => string,
	) => {
		if (detailObj.errors) {
			const errorsMap: Record<string, string> = {};
			for (const [field, errorsList] of Object.entries(detailObj.errors)) {
				const firstError = errorsList[0];
				if (firstError) {
					errorsMap[field] = getLocalizedValidationError({
						field,
						msg: firstError.message,
						type: firstError.type,
						t: translationFn,
					});
				}
			}
			setErrors(errorsMap);
			return null;
		}
		if (detailObj.message) {
			return detailObj.message;
		}
		return undefined;
	};

	const parseSubmitError = async ({
		response,
		fallbackMsg,
		setErrors,
		translationFn,
	}: ParseSubmitErrorParams) => {
		try {
			const errData = await response.json();
			const detailObj = errData.detail as {
				message?: string;
				errors?: Record<
					string,
					Array<{ message: string; type: string; field_path?: string }>
				>;
			};
			if (
				detailObj &&
				typeof detailObj === "object" &&
				!Array.isArray(detailObj)
			) {
				const processedMsg = processErrorDetails(
					detailObj,
					setErrors,
					translationFn,
				);
				if (processedMsg !== undefined) {
					return processedMsg || fallbackMsg;
				}
			}
			return parseErrorDetail(errData, fallbackMsg);
		} catch (_) {
			return fallbackMsg;
		}
	};

	const handleConfirmAll = async () => {
		if (!documentId || isSubmitting) {
			return;
		}

		setIsSubmitting(true);
		setFieldErrors({});
		setSaveError(null);

		const payloadData = constructPayloadData(
			correctedData,
			editingField,
			editBuffer,
		);
		const sanitizedPayload = sanitizePayload(payloadData);

		if (checkIsMockEnvironment()) {
			await handleMockVerification();
			return;
		}

		try {
			const response = await authenticatedFetch(
				`${env.VITE_API_URL}/api/v1/documents/${documentId}/verify`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						corrected_data: sanitizedPayload,
						verified_fields: verifiedFields,
						document_type: docType,
					}),
				},
			);

			if (response.ok) {
				// Refresh profile files store state instantly
				const files = await fileService.getFiles();
				setDocuments(files);
				const categoryParam = category ? `&category=${category}` : "";
				navigate(
					`${AppRoutes.ProfileDocumentSuccess.replace(":documentId", documentId)}?origin=${origin}${categoryParam}`,
				);
			} else {
				const fallbackMsg = t(
					"review.errors.verification_failed",
					"Fehler beim Bestätigen der Daten.",
				);
				const errorMsg = await parseSubmitError({
					response,
					fallbackMsg,
					setErrors: setFieldErrors,
					translationFn: t,
				});
				if (errorMsg) {
					setSaveError(errorMsg);
					scrollToError();
				}
			}
		} catch (err: unknown) {
			console.error("Verification request failed:", err);
			let errorMessage = t(
				"review.errors.system_error",
				"Ein unerwarteter Systemfehler ist aufgetreten.",
			);
			if (err instanceof Error) {
				errorMessage = err.message;
			}
			setSaveError(errorMessage);
			scrollToError();
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleDeleteDocument = () => {
		if (!documentId) {
			return;
		}
		setShowDeleteModal(true);
	};

	const handleConfirmDelete = async () => {
		if (!documentId) {
			return;
		}
		setShowDeleteModal(false);
		try {
			await deleteDocument(documentId);
			navigate(getTargetExitRoute(origin, category, "upload"));
		} catch (err) {
			console.error("Failed to delete document:", err);
		}
	};

	if (loading) {
		return (
			<PageContainer>
				<div className="size-10 border-4 border-brand-navy/20 border-t-brand-navy rounded-full animate-spin" />
			</PageContainer>
		);
	}

	return (
		<PageContainer
			topBarProps={{
				onBack: () => navigate(getTargetExitRoute(origin, category, "upload")),
				middleElement: (
					<span className="text-sm font-extrabold text-slate-800 tracking-wide uppercase truncate">
						{t("review.title", "Daten prüfen")}
					</span>
				),
				rightElement: (
					<button
						type="button"
						onClick={() =>
							navigate(getTargetExitRoute(origin, category, "upload"))
						}
						className="w-10 h-10 bg-white border border-slate-200 rounded-full flex items-center justify-center shadow-sm active:scale-90 transition-all"
					>
						<X className="w-5 h-5 text-slate-700" />
					</button>
				),
				showLanguageSwitcher: true,
			}}
		>
			<div className="w-full max-w-md flex flex-col items-center px-4">
				<p className="text-xs text-brand-grey text-center mb-6 px-4 leading-relaxed">
					{t(
						"review.subtitle",
						"Prüfe die ausgelesenen Daten und bestätige sie.",
					)}
				</p>

				{saveError && (
					<div
						ref={errorBannerRef}
						className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-900 font-medium w-full max-w-md mb-6 text-sm text-left shadow-sm animate-in fade-in duration-200"
					>
						<AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />
						<p>{saveError}</p>
					</div>
				)}

				{/* Document Category Selection Card */}
				<div className="w-full bg-white rounded-2xl border border-slate-100 p-4 shadow-sm mb-6 text-left">
					<label
						htmlFor="document-type-select"
						className="block text-[10px] font-bold text-brand-grey uppercase tracking-wide mb-1.5"
					>
						{t("review.detected_type", "Es wurde ein Dokument erkannt")}
					</label>
					<div className="relative">
						<select
							id="document-type-select"
							value={docType}
							onChange={(e) => setDocType(e.target.value)}
							className="w-full h-12 border border-slate-200 rounded-xl px-3 bg-slate-50 text-sm font-bold text-slate-800 focus:outline-none appearance-none cursor-pointer"
						>
							{REQUIRED_DOCUMENT_SLOTS.map((slot) => (
								<option key={slot.id} value={slot.id}>
									{tApplication(slot.titleKey, slot.defaultTitle)}
								</option>
							))}
							<option value="OTHER">{t("review.doc_type_other")}</option>
						</select>
					</div>
				</div>

				{/* Fields Headline */}
				<div className="w-full text-left mb-3 px-1">
					<h4 className="text-[11px] font-bold text-brand-grey uppercase tracking-wider">
						{t("review.detected_data", "Es wurden folgende Daten erkannt")}
					</h4>
				</div>

				{/* Fields List Layout Container */}
				<div className="w-full flex flex-col bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden divide-y divide-slate-100 mb-8">
					{Object.keys(correctedData)
						.filter((fieldKey) => {
							const val = correctedData[fieldKey];
							return val !== null && val !== undefined;
						})
						.map((fieldKey) => {
							const isEditing = editingField === fieldKey;
							const isChecked = verifiedFields.includes(fieldKey);
							const currentValue = correctedData[fieldKey];
							const isBooleanField =
								normalizeBooleanForUi(currentValue) !== undefined;

							const errorMsg = fieldErrors[fieldKey];

							return (
								<div
									key={fieldKey}
									className={`w-full p-4 flex flex-col transition-colors hover:bg-slate-50/30 text-left border-l-4 ${
										errorMsg
											? "border-l-rose-500 bg-rose-50/10"
											: "border-l-transparent border-slate-100"
									}`}
								>
									{isEditing ? (
										// Inline Editing Mode Panel
										<div className="w-full flex flex-col gap-3 animate-in fade-in duration-200">
											<label
												htmlFor={`input-${fieldKey}`}
												className="text-[10px] font-bold text-brand-grey uppercase tracking-wide"
											>
												{t(`review.fields.${String(fieldKey).toLowerCase()}`, {
													defaultValue: String(fieldKey).replace(/_/g, " "),
												})}
											</label>
											{isBooleanField ? (
												<select
													id={`input-${fieldKey}`}
													value={editBuffer}
													onChange={(e) => setEditBuffer(e.target.value)}
													className={`w-full h-12 border rounded-xl px-4 text-sm font-medium text-slate-800 bg-white focus:outline-none shadow-inner ${
														errorMsg
															? "border-rose-300 focus:border-rose-500"
															: "border-slate-200 focus:border-slate-400"
													}`}
													aria-invalid={errorMsg ? "true" : "false"}
													aria-describedby={
														errorMsg ? `error-${fieldKey}` : undefined
													}
													autoFocus
												>
													<option value="true">
														{t("common.yes", { defaultValue: "Ja" })}
													</option>
													<option value="false">
														{t("common.no", { defaultValue: "Nein" })}
													</option>
												</select>
											) : (
												<input
													id={`input-${fieldKey}`}
													type="text"
													value={editBuffer}
													onChange={(e) => setEditBuffer(e.target.value)}
													className={`w-full h-12 border rounded-xl px-4 text-sm font-medium text-slate-800 bg-white focus:outline-none shadow-inner ${
														errorMsg
															? "border-rose-300 focus:border-rose-500"
															: "border-slate-200 focus:border-slate-400"
													}`}
													aria-invalid={errorMsg ? "true" : "false"}
													aria-describedby={
														errorMsg ? `error-${fieldKey}` : undefined
													}
													autoFocus
												/>
											)}
											{errorMsg && (
												<div
													id={`error-${fieldKey}`}
													role="alert"
													className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-600 animate-in fade-in duration-200"
												>
													<AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
													<span>{errorMsg}</span>
												</div>
											)}
											<div className="flex items-center space-x-2 justify-end">
												<button
													type="button"
													onClick={() => setEditingField(null)}
													className="h-9 px-4 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600 active:scale-95 transition-all"
												>
													{t("common.cancel", "Abbrechen")}
												</button>
												<button
													type="button"
													onClick={() => saveInlineEdit(fieldKey)}
													className="h-9 px-4 rounded-lg bg-slate-900 text-white text-xs font-bold active:scale-95 transition-all"
												>
													{t("common.save", "Speichern")}
												</button>
											</div>
										</div>
									) : (
										// Standard Row Content Mode
										<>
											<div className="w-full flex items-center justify-between group">
												<div
													onClick={() => startEditing(fieldKey, currentValue)}
													className="flex flex-col gap-0.5 overflow-hidden flex-1 pr-4 cursor-pointer rounded-lg hover:bg-slate-100/50 p-1 -m-1 transition-all"
												>
													<span className="text-[10px] font-bold text-brand-grey uppercase tracking-wide">
														{t(
															`review.fields.${String(fieldKey).toLowerCase()}`,
															{
																defaultValue: String(fieldKey).replace(
																	/_/g,
																	" ",
																),
															},
														)}
													</span>
													<span className="text-sm font-bold text-slate-800 truncate">
														{renderFieldValue(fieldKey, currentValue, t)}
													</span>
												</div>

												<div className="flex items-center space-x-2 shrink-0">
													{/* Status Check Circle Overlay */}
													<button
														type="button"
														aria-label={`${t(`review.fields.${String(fieldKey).toLowerCase()}`, { defaultValue: fieldKey })} verifizieren`}
														aria-pressed={isChecked}
														onClick={() => toggleVerified(fieldKey)}
														className={`size-7 rounded-full flex items-center justify-center border transition-all ${
															isChecked
																? "bg-green-50 border-green-200 text-green-600 shadow-sm"
																: "bg-white border-slate-200 text-slate-300 hover:border-slate-300"
														}`}
													>
														<Check className="w-4 h-4 stroke-[3px]" />
													</button>

													{/* Accessible 44px Tap Target Inline Trigger Button */}
													<button
														type="button"
														aria-label={`Edit ${t(`review.fields.${String(fieldKey).toLowerCase()}`, { defaultValue: fieldKey })}`}
														onClick={() => startEditing(fieldKey, currentValue)}
														className="size-11 min-w-[44px] min-h-[44px] bg-slate-50 border border-slate-200 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-100 cursor-pointer focus-visible:outline-2 focus-visible:outline-brand-primary transition-all shadow-sm shrink-0"
													>
														<Edit3 className="size-4" />
													</button>
												</div>
											</div>
											{errorMsg && (
												<div
													id={`error-${fieldKey}`}
													role="alert"
													className="flex items-center gap-1.5 mt-1.5 text-[11px] font-semibold text-rose-600 animate-in fade-in duration-200"
												>
													<AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
													<span>{errorMsg}</span>
												</div>
											)}
										</>
									)}
								</div>
							);
						})}
				</div>

				{/* Primary Execution Trigger Action Button */}
				<div className="flex flex-col sm:flex-row items-center gap-3 w-full mt-4">
					<button
						type="button"
						onClick={handleDeleteDocument}
						className="w-full sm:flex-1 h-14 bg-white border border-rose-200 hover:bg-rose-50 text-rose-600 font-bold text-base rounded-2xl shadow-sm active:scale-98 transition-all flex items-center justify-center"
					>
						{t("review.delete_document", "Dokument löschen")}
					</button>
					<button
						type="button"
						data-testid="confirm-button"
						onClick={handleConfirmAll}
						disabled={isSubmitting}
						className={`w-full sm:flex-1 h-14 bg-slate-900 hover:bg-slate-800 text-white font-bold text-base rounded-2xl shadow-lg active:scale-98 transition-all flex items-center justify-center ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
					>
						{isSubmitting
							? t("common.saving", "Speichere...")
							: t("review.confirm_all", "Bestätigen")}
					</button>
				</div>
			</div>

			<ConfirmationModal
				isOpen={showDeleteModal}
				title={t("review.delete_title", "Dokument löschen?")}
				message={t(
					"review.delete_confirm",
					"Möchtest Du dieses Dokument wirklich löschen?",
				)}
				confirmLabel={t("common.delete", "Löschen")}
				cancelLabel={t("common.cancel", "Abbrechen")}
				onConfirm={handleConfirmDelete}
				onCancel={() => setShowDeleteModal(false)}
			/>
		</PageContainer>
	);
};
