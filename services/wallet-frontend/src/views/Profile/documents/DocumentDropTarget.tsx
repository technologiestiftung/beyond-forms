import React, { useState } from "react";
import type { TFunction } from "i18next";
import { Upload } from "lucide-react";
import { PrimaryButton } from "../../../components/ui/PrimaryButton";

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

	const handleDrop = (event: React.DragEvent) => {
		event.preventDefault();
		setIsDraggedOver(false);
		const file = event.dataTransfer.files?.[0];
		if (file) {
			onFile(file);
		}
	};

	return (
		<div
			data-testid="document-drop-target"
			onDragOver={(event) => {
				event.preventDefault();
				setIsDraggedOver(true);
			}}
			onDragLeave={() => setIsDraggedOver(false)}
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
					defaultValue:
						"oder wähle eine Datei von Deinem Computer aus. PDF, JPG oder PNG (max. 10 MB)",
				})}
			</p>

			<p className="text-xs text-primary-blue-300">
				{t("personal.upload.formats", "PDF, JPG, PNG or HEIC (max. 10MB)")}
			</p>
			<PrimaryButton onClick={onOpen} className="lg:w-fit mt-2">
				{t("docs.add_document", {
					ns: "application",
					defaultValue: "Dokument hinzufügen",
				})}
			</PrimaryButton>
		</div>
	);
};
