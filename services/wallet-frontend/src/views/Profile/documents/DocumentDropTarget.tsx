import React, { useState } from "react";
import type { TFunction } from "i18next";
import { AlertCircle, Upload } from "lucide-react";
import { PrimaryButton } from "../../../components/ui/PrimaryButton";
import { validateDocumentFile } from "../../../utils/fileValidation";

export interface DocumentDropTargetProps {
	onFile: (file: File) => void;
	onOpen: () => void;
	t: TFunction;
}

export const DocumentDropTarget: React.FC<DocumentDropTargetProps> = ({
	onFile,
	onOpen,
	t,
}) => {
	const [isDraggedOver, setIsDraggedOver] = useState(false);
	const [rejection, setRejection] = useState<string | null>(null);

	const handleDrop = (event: React.DragEvent) => {
		event.preventDefault();
		setIsDraggedOver(false);
		const file = event.dataTransfer.files?.[0];
		if (!file) {
			return;
		}

		const reason = validateDocumentFile(file);
		if (reason) {
			setRejection(reason);
			return;
		}
		setRejection(null);
		onFile(file);
	};

	return (
		<div
			data-testid="document-drop-target"
			onDragOver={(event) => {
				event.preventDefault();
				setIsDraggedOver(true);
			}}
			onDragLeave={(event) => {
				if (!event.currentTarget.contains(event.relatedTarget as Node)) {
					setIsDraggedOver(false);
				}
			}}
			onDrop={handleDrop}
			className={`w-full flex flex-col items-center gap-2 px-5 py-5 rounded-2xl border-2 border-dashed text-center transition-colors ${
				isDraggedOver
					? "border-primary-blue-500 bg-brand-bg"
					: "border-brand-border bg-brand-bg/40"
			}`}
		>
			<Upload className="size-6 text-primary-blue-500" aria-hidden="true" />
			<p className="text-body-lg font-bold text-brand-black">
				{t("docs.dropzone_title", {
					ns: "application",
					defaultValue: "Dokument hierher ziehen",
				})}
			</p>
			<p className="text-sm text-brand-grey">
				{t("docs.dropzone_hint", {
					ns: "application",
					defaultValue: "oder wähle eine Datei von Deinem Computer aus.",
				})}
			</p>

			<p className="text-xs text-primary-blue-400">
				{t("personal.upload.formats", "PDF, JPG, PNG oder HEIC (max. 10 MB)")}
			</p>

			{rejection && (
				<p
					role="alert"
					data-testid="document-drop-target-error"
					className="flex items-center gap-2 text-sm font-medium text-red-700"
				>
					<AlertCircle className="size-4 shrink-0" aria-hidden="true" />
					{t(`errors.${rejection}`)}
				</p>
			)}

			<PrimaryButton onClick={onOpen} className="lg:w-fit mt-2">
				{t("docs.add_document", {
					ns: "application",
					defaultValue: "Dokument hinzufügen",
				})}
			</PrimaryButton>
		</div>
	);
};
