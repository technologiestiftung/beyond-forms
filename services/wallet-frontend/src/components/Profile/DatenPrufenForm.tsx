import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDocumentReviewStore } from "../../store/useDocumentReviewStore";
import { authenticatedFetch } from "../../utils/apiClient";
import { CheckCircle2, Save, AlertTriangle, Pencil } from "lucide-react";

interface DatenPrufenFormProps {
	documentId: string;
}

const getWarningMessage = (
	code: string | null,
	t: (key: string, options?: Record<string, unknown>) => string,
): string => {
	if (!code) {
		return t("review.warnings.default", {
			defaultValue: "Bitte überprüfe die ausgelesenen Daten sorgfältig.",
		});
	}
	switch (code) {
		case "PAGINATION_MISSING_PAGES":
			return t("review.warnings.PAGINATION_MISSING_PAGES", {
				defaultValue:
					"Es sieht so aus, als ob einige Seiten dieses Dokuments fehlen könnten. Bitte überprüfe, ob alles vollständig ist.",
			});
		case "LEGIBILITY_ISSUES":
			return t("review.warnings.LEGIBILITY_ISSUES", {
				defaultValue:
					"Das Dokument ist an einigen Stellen schwer lesbar (z. B. durch Unschärfe oder Spiegelung). Bitte kontrolliere die Daten genau.",
			});
		case "DATA_CONFLICTS":
			return t("review.warnings.DATA_CONFLICTS", {
				defaultValue:
					"Einige ausgelesene Daten stimmen nicht mit Deinen bisherigen Angaben überein. Bitte bestätige die korrekten Details.",
			});
		case "OLD_STATEMENT_WARNING":
			return t("review.warnings.OLD_STATEMENT_WARNING", {
				defaultValue:
					"Dieser Nachweis scheint älter als 3 Monate zu sein. Du kannst fortfahren, aber die Sachbearbeiter bitten eventuell um eine Aktualisierung.",
			});
		default:
			return t("review.warnings.default", {
				defaultValue: "Bitte überprüfe die ausgelesenen Daten sorgfältig.",
			});
	}
};

export const DatenPrufenForm: React.FC<DatenPrufenFormProps> = ({
	documentId,
}) => {
	const { t } = useTranslation("profile");
	const { extractedFields, setExtractedFields, updateFieldValue } =
		useDocumentReviewStore();
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [warningCode, setWarningCode] = useState<string | null>(null);

	const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
	const [editValue, setEditValue] = useState<string>("");

	useEffect(() => {
		let isMounted = true;

		const fetchExtractions = async () => {
			try {
				setLoading(true);
				const response = await authenticatedFetch(
					`/api/v1/documents/${documentId}/extractions`,
				);

				if (!response.ok) {
					throw new Error("Failed to fetch extracted data");
				}

				const data = await response.json();

				if (isMounted) {
					if (data.user_error_code) {
						setWarningCode(data.user_error_code);
					}

					if (data.raw_data) {
						const fields = Object.entries(data.raw_data)
							.filter(
								([_, value]) =>
									value !== null &&
									value !== undefined &&
									String(value).trim() !== "",
							)
							.map(([key, value]) => ({
								id: crypto.randomUUID(),
								key,
								value: String(value),
								checked: true,
							}));
						setExtractedFields(fields);
					}
				}
			} catch (err) {
				if (isMounted) {
					setError(err instanceof Error ? err.message : "An error occurred");
				}
			} finally {
				if (isMounted) {
					setLoading(false);
				}
			}
		};

		fetchExtractions();

		return () => {
			isMounted = false;
		};
	}, [documentId, setExtractedFields]);

	const handleEditStart = (id: string, currentValue: string) => {
		setEditingFieldId(id);
		setEditValue(currentValue);
	};

	const handleEditSave = (id: string) => {
		updateFieldValue(id, editValue);
		setEditingFieldId(null);
	};

	if (loading) {
		return (
			<div className="flex justify-center items-center py-12">
				<div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand-primary"></div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="p-4 bg-red-50 text-red-600 rounded-lg">
				<p>{error}</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-6">
			{warningCode && (
				<div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md flex items-start gap-3">
					<AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
					<div>
						<h3 className="text-sm font-medium text-yellow-800">
							{t("review.warning_title", {
								defaultValue: "Überprüfung empfohlen",
							})}
						</h3>
						<p className="mt-1 text-sm text-yellow-700">
							{getWarningMessage(warningCode, t)}
						</p>
					</div>
				</div>
			)}

			<div className="flex flex-col gap-0 border border-brand-border-subtle rounded-xl overflow-hidden">
				{extractedFields.map((field, index) => {
					const fieldName = t(
						`review.fields.${String(field.key).toLowerCase()}`,
						{
							defaultValue: String(field.key).replace(/_/g, " "),
						},
					);
					return (
						<div
							key={field.id}
							className={`flex items-center justify-between p-4 ${
								index !== extractedFields.length - 1
									? "border-b border-brand-border-subtle"
									: ""
							}`}
						>
							<div className="flex items-start gap-3 flex-1 min-w-0">
								<CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
								<div className="flex flex-col flex-1 min-w-0 pr-4">
									<span className="text-xs font-medium text-brand-black uppercase tracking-wider mb-1 truncate">
										{fieldName}
									</span>

									{editingFieldId === field.id ? (
										<input
											type="text"
											value={editValue}
											onChange={(e) => setEditValue(e.target.value)}
											onClick={(e) => e.stopPropagation()}
											className="w-full text-body-lg font-semibold text-brand-carbon bg-brand-black/10 border border-brand-border-subtle rounded px-2 py-1 outline-none focus:border-brand-primary"
											autoFocus
											onKeyDown={(e) => {
												e.stopPropagation();
												if (e.key === "Enter") {
													handleEditSave(field.id);
												}
												if (e.key === "Escape") {
													setEditingFieldId(null);
												}
											}}
										/>
									) : (
										<div
											onClick={() => handleEditStart(field.id, field.value)}
											className="cursor-pointer rounded hover:bg-brand-black/5 -m-1 p-1 transition-colors"
										>
											<span className="text-body-lg font-semibold text-brand-carbon break-words">
												{field.value || "-"}
											</span>
										</div>
									)}
								</div>
							</div>

							<div className="flex-shrink-0">
								{editingFieldId === field.id ? (
									<button
										onClick={() => handleEditSave(field.id)}
										className="size-11 min-w-[44px] min-h-[44px] flex items-center justify-center text-brand-primary bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-full transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-brand-primary shadow-sm"
										aria-label={t("common.save")}
									>
										<Save className="size-5" />
									</button>
								) : (
									<button
										type="button"
										onClick={() => handleEditStart(field.id, field.value)}
										className="size-11 min-w-[44px] min-h-[44px] flex items-center justify-center bg-slate-50 border border-slate-200 rounded-full text-slate-600 hover:bg-slate-100 cursor-pointer focus-visible:outline-2 focus-visible:outline-brand-primary transition-colors shadow-sm"
										aria-label={t("common.edit_field", { field: fieldName })}
									>
										<Pencil className="size-4" />
									</button>
								)}
							</div>
						</div>
					);
				})}

				{extractedFields.length === 0 && (
					<div className="p-8 text-center text-brand-black">
						{t(
							"review.no_data",
							"Aus diesem Dokument wurden keine Daten ausgelesen.",
						)}
					</div>
				)}
			</div>
		</div>
	);
};
