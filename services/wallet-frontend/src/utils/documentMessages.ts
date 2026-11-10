import type { TFunction } from "i18next";

// Codes set by the orchestration service when document processing fails.
const FAILURE_CODES = new Set([
	"DIS_INVOCATION_FAILED",
	"GCS_BLOB_MISSING",
	"PROCESSING_TIMEOUT",
	"PUBLISH_FAILED",
]);

// Codes attached to documents that are ready for review but need a closer look.
const WARNING_CODES = new Set([
	"PAGINATION_MISSING_PAGES",
	"LEGIBILITY_ISSUES",
	"DATA_CONFLICTS",
	"OLD_STATEMENT_WARNING",
]);

export const getDocumentFailureMessage = (
	t: TFunction,
	code?: string | null,
) =>
	code && FAILURE_CODES.has(code)
		? t(`errors.codes.${code}`)
		: t("errors.processing_failed");

export const getDocumentWarningMessage = (
	t: TFunction,
	code?: string | null,
) =>
	code && WARNING_CODES.has(code)
		? t(`review.warnings.${code}`)
		: t("review.warnings.default");
