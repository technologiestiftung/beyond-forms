/**
 * Thrown when an uploaded document asset cannot be located on the proxy server or cloud storage
 * (e.g., deleted by automated bucket TTL lifecycle rules or expired credentials).
 */
export class DocumentNotFoundError extends Error {
	constructor(
		message = "Das angeforderte Dokument konnte nicht auf dem Server gefunden werden.",
	) {
		super(message);
		this.name = "DocumentNotFoundError";
	}
}
