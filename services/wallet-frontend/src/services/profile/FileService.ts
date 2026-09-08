import { z } from "zod";
import { DocumentTypeEnum, DocumentSchema } from "../../schemas/profile.schema";
import type {
	WalletDocument,
	ProcessingStatus,
} from "../../schemas/profile.schema";
import { env } from "../../config/env.config";
import { authenticatedFetch } from "../../utils/apiClient";
import { DocumentNotFoundError } from "../../errors/DocumentNotFoundError";

export interface FileUploadResponse {
	success: boolean;
	document?: WalletDocument;
	message?: string;
	aborted?: boolean;
}

/**
 * Service for handling document uploads and file management.
 */
export class FileService {
	async getFiles(): Promise<WalletDocument[]> {
		if (env.VITE_USE_MOCKS || env.VITE_USE_MOCK_AUTH) {
			const { mockFileService } = await import("./MockFileService");
			return mockFileService.getFiles();
		}

		try {
			const response = await authenticatedFetch(`${env.VITE_API_URL}/files`, {
				credentials: "include",
			});

			if (!response.ok) {
				return [];
			}

			const data = await response.json();
			const mapped = (
				data as Array<{
					document_id?: string;
					id?: string;
					object_name?: string;
					name?: string;
					document_type?: string;
					type?: string;
					status?: string;
					upload_date?: string;
					uploadDate?: string;
					updated_at?: string;
					updatedAt?: string;
					file_url?: string;
					fileUrl?: string;
					user_error_code?: string;
					userErrorCode?: string;
				}>
			).map((doc) => ({
				id: doc.document_id || doc.id || "",
				name: doc.object_name || doc.name || "",
				type: doc.document_type || doc.type || "OTHER",
				status: (doc.status
					? doc.status.toUpperCase()
					: "PROCESSING") as ProcessingStatus,
				uploadDate:
					doc.upload_date || doc.uploadDate || new Date().toISOString(),
				updatedAt: doc.updated_at || doc.updatedAt,
				fileUrl: doc.file_url || doc.fileUrl,
				user_error_code: doc.user_error_code || doc.userErrorCode,
			}));

			const parsed = z.array(DocumentSchema).safeParse(mapped);
			if (!parsed.success) {
				console.error("Failed to parse documents from API:", parsed.error);
				return [];
			}
			return parsed.data;
		} catch (_e) {
			return [];
		}
	}

	async uploadFile(
		files: File | File[],
		type: z.infer<typeof DocumentTypeEnum>,
		signal?: AbortSignal,
	): Promise<FileUploadResponse> {
		if (env.VITE_USE_MOCKS || env.VITE_USE_MOCK_AUTH) {
			const { mockFileService } = await import("./MockFileService");
			return mockFileService.uploadFile(files, type);
		}

		const formData = new FormData();

		let url = `${env.VITE_API_URL}/upload`;

		if (Array.isArray(files)) {
			if (files.length === 1) {
				formData.append("file", files[0]);
				formData.append("document_type", type);
			} else {
				// Check if any is a PDF, if so, we can't stitch
				const hasPdf = files.some(
					(f) =>
						f.type === "application/pdf" ||
						f.name.toLowerCase().endsWith(".pdf"),
				);
				if (hasPdf) {
					return {
						success: false,
						message:
							"PDFs cannot be stitched. Please upload them individually.",
					};
				}
				files.forEach((f) => {
					formData.append("files", f);
				});
				formData.append("document_type", type);
				url = `${env.VITE_API_URL}/upload-stitched`;
			}
		} else {
			formData.append("file", files);
			formData.append("document_type", type);
		}

		try {
			const response = await authenticatedFetch(url, {
				method: "POST",
				body: formData,
				credentials: "include",
				signal,
			});

			if (!response.ok) {
				return { success: false, message: "Upload failed" };
			}

			const data = await response.json();
			return {
				success: true,
				document: {
					id: data.document_id,
					name: data.name,
					type: type,
					status: "PROCESSING",
					uploadDate: new Date().toISOString(),
				},
			};
		} catch (error) {
			if (error instanceof Error && error.name === "AbortError") {
				return { success: false, message: "Upload aborted", aborted: true };
			}
			return { success: false, message: "Network error during upload" };
		}
	}

	async bulkUploadFiles(
		items: { file: File; type: z.infer<typeof DocumentTypeEnum> }[],
	): Promise<FileUploadResponse[]> {
		if (env.VITE_USE_MOCKS || env.VITE_USE_MOCK_AUTH) {
			const { mockFileService } = await import("./MockFileService");
			return mockFileService.bulkUploadFiles(items);
		}

		const formData = new FormData();
		for (const { file, type } of items) {
			formData.append("files", file);
			formData.append("document_types", type);
		}

		try {
			const response = await authenticatedFetch(
				`${env.VITE_API_URL}/bulk-upload`,
				{
					method: "POST",
					body: formData,
					credentials: "include",
				},
			);

			if (!response.ok) {
				const message =
					response.status === 401 ? "Not authenticated" : "Upload failed";
				return items.map(() => ({ success: false, message }));
			}

			const data = (await response.json()) as Array<{
				name: string;
				status: string;
				document_id?: string;
				error_message?: string;
			}>;
			return data.map((item, index) => {
				if (item.status === "success") {
					return {
						success: true,
						document: {
							id: item.document_id,
							name: item.name,
							type: items[index].type,
							status: "PROCESSING" as const,
							uploadDate: new Date().toISOString(),
						},
					} as FileUploadResponse;
				}
				return {
					success: false,
					message: item.error_message ?? "Upload failed",
				} as FileUploadResponse;
			});
		} catch (_e) {
			return items.map(() => ({ success: false, message: "Network error" }));
		}
	}

	async deleteFile(documentId: string): Promise<void> {
		if (env.VITE_USE_MOCKS || env.VITE_USE_MOCK_AUTH) {
			const { mockFileService } = await import("./MockFileService");
			const success = await mockFileService.deleteFile(documentId);
			if (!success) {
				throw new Error("Failed to delete file from mock storage");
			}
			return;
		}

		try {
			const response = await authenticatedFetch(
				`${env.VITE_API_URL}/api/v1/documents/${documentId}`,
				{
					method: "DELETE",
					credentials: "include",
				},
			);
			if (!response.ok) {
				throw new Error(`Failed to delete document: ${response.statusText}`);
			}
		} catch (error) {
			console.error("deleteFile failed:", error);
			throw error;
		}
	}

	async getFileBlob(
		documentId: string,
		signal?: AbortSignal,
	): Promise<{ blob: Blob; mimeType: string }> {
		if (env.VITE_USE_MOCKS || env.VITE_USE_MOCK_AUTH) {
			const { mockFileService } = await import("./MockFileService");
			return mockFileService.getFileBlob(documentId);
		}

		const response = await authenticatedFetch(
			`${env.VITE_API_URL}/api/v1/documents/${documentId}/file?disposition=inline`,
			{
				method: "GET",
				credentials: "include",
				signal,
			},
		);

		if (!response.ok) {
			if (response.status === 404) {
				throw new DocumentNotFoundError();
			}
			throw new Error(`Failed to retrieve file blob: ${response.statusText}`);
		}

		const blob = await response.blob();
		const mimeType =
			response.headers.get("content-type") ||
			blob.type ||
			"application/octet-stream";
		return { blob, mimeType };
	}
}

export const fileService = new FileService();
