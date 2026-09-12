export const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;

export const ACCEPTED_DOCUMENT_MIME_TYPES = [
	"application/pdf",
	"image/jpeg",
	"image/png",
	"image/heic",
	"image/heif",
];

export const ACCEPTED_DOCUMENT_EXTENSIONS = [
	".pdf",
	".jpg",
	".jpeg",
	".png",
	".heic",
	".heif",
];

export const DOCUMENT_ACCEPT_ATTRIBUTE = [
	...ACCEPTED_DOCUMENT_MIME_TYPES,
	...ACCEPTED_DOCUMENT_EXTENSIONS,
].join(",");

export type DocumentFileRejection = "file_type_invalid" | "file_too_large";

/** Browsers report an empty type for HEIC, so the extension is a valid fallback. */
export const validateDocumentFile = (
	file: File,
): DocumentFileRejection | null => {
	const name = file.name.toLowerCase();
	const isAccepted =
		ACCEPTED_DOCUMENT_MIME_TYPES.includes(file.type) ||
		ACCEPTED_DOCUMENT_EXTENSIONS.some((extension) => name.endsWith(extension));

	if (!isAccepted) {
		return "file_type_invalid";
	}
	if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
		return "file_too_large";
	}
	return null;
};
