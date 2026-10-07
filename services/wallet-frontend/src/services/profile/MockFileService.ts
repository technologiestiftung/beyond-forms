import { z } from "zod";
import {
	ProcessingStatusEnum,
	DocumentTypeEnum,
} from "../../schemas/profile.schema";
import type { WalletDocument } from "../../schemas/profile.schema";
import { useAuthStore } from "../../store/useAuthStore";
import type { FileUploadResponse } from "./FileService";
import { getMockProfileStorageKey } from "../../utils/profile";

export class MockFileService {
	async getFiles(): Promise<WalletDocument[]> {
		await new Promise((resolve) => setTimeout(resolve, 500));
		const state = useAuthStore.getState();
		const phone = state.phoneNumber || "default";
		const activeStorageKey = getMockProfileStorageKey(phone);
		const stored = localStorage.getItem(activeStorageKey);

		if (stored) {
			const profile = JSON.parse(stored);
			return profile.documents || [];
		}
		return [];
	}

	async uploadFile(
		files: File | File[],
		type: z.infer<typeof DocumentTypeEnum>,
	): Promise<FileUploadResponse> {
		await new Promise((resolve) => setTimeout(resolve, 2000)); // Simulate upload time

		const isArray = Array.isArray(files);
		const fileName =
			isArray && files.length > 0
				? `stitched_mock_${files[0].name}`
				: (files as File).name;

		const mockDoc: WalletDocument = {
			id:
				typeof crypto !== "undefined" && crypto.randomUUID
					? crypto.randomUUID()
					: "123e4567-e89b-12d3-a456-426614174000",
			name: fileName,
			type,
			status: ProcessingStatusEnum.enum.PROCESSING,
			uploadDate: new Date().toISOString(),
		};

		// Update localStorage mock DB
		const state = useAuthStore.getState();
		const phone = state.phoneNumber || "default";
		const activeStorageKey = getMockProfileStorageKey(phone);
		const stored = localStorage.getItem(activeStorageKey);

		const profile = stored ? JSON.parse(stored) : { documents: [] };
		profile.documents = [...(profile.documents || []), mockDoc];
		localStorage.setItem(activeStorageKey, JSON.stringify(profile));

		// Simulate async background OCR processing by transitioning status to READY_FOR_REVIEW after 3 seconds
		setTimeout(() => {
			const storedProfile = localStorage.getItem(activeStorageKey);
			if (storedProfile) {
				const profileObj = JSON.parse(storedProfile);
				const docs: WalletDocument[] = profileObj.documents || [];
				const docToUpdate = docs.find((d) => d.id === mockDoc.id);
				if (docToUpdate) {
					docToUpdate.status = ProcessingStatusEnum.enum.READY_FOR_REVIEW;
					docToUpdate.updatedAt = new Date().toISOString();
					localStorage.setItem(activeStorageKey, JSON.stringify(profileObj));
				}
			}
		}, 3000);

		return { success: true, document: mockDoc };
	}

	async bulkUploadFiles(
		items: { file: File; type: z.infer<typeof DocumentTypeEnum> }[],
	): Promise<FileUploadResponse[]> {
		await new Promise((resolve) => setTimeout(resolve, 2000));
		const mockDoc1: WalletDocument = {
			id:
				typeof crypto !== "undefined" && crypto.randomUUID
					? crypto.randomUUID()
					: "123e4567-e89b-12d3-a456-426614174001",
			name: items[0].file.name,
			type: items[0].type,
			status: ProcessingStatusEnum.enum.PROCESSING,
			uploadDate: new Date().toISOString(),
		};
		const mockDoc2: WalletDocument = {
			id:
				typeof crypto !== "undefined" && crypto.randomUUID
					? crypto.randomUUID()
					: "123e4567-e89b-12d3-a456-426614174002",
			name: items[1].file.name,
			type: items[1].type,
			status: ProcessingStatusEnum.enum.PROCESSING,
			uploadDate: new Date().toISOString(),
		};

		// Update localStorage mock DB
		const state = useAuthStore.getState();
		const phone = state.phoneNumber || "default";
		const activeStorageKey = getMockProfileStorageKey(phone);
		const stored = localStorage.getItem(activeStorageKey);

		const profile = stored ? JSON.parse(stored) : { documents: [] };
		profile.documents = [...(profile.documents || []), mockDoc1, mockDoc2];
		localStorage.setItem(activeStorageKey, JSON.stringify(profile));

		// Simulate async background OCR processing by transitioning status to READY_FOR_REVIEW after 3 seconds
		setTimeout(() => {
			const storedProfile = localStorage.getItem(activeStorageKey);
			if (storedProfile) {
				const profileObj = JSON.parse(storedProfile);
				const docs: WalletDocument[] = profileObj.documents || [];
				const matchingIds = new Set([mockDoc1.id, mockDoc2.id]);
				const docsToUpdate = docs.filter((d) => matchingIds.has(d.id));
				for (const doc of docsToUpdate) {
					doc.status = ProcessingStatusEnum.enum.READY_FOR_REVIEW;
					doc.updatedAt = new Date().toISOString();
				}
				if (docsToUpdate.length > 0) {
					localStorage.setItem(activeStorageKey, JSON.stringify(profileObj));
				}
			}
		}, 3000);

		return [
			{ success: true, document: mockDoc1 },
			{ success: true, document: mockDoc2 },
		];
	}

	async deleteFile(documentId: string): Promise<boolean> {
		await new Promise((resolve) => setTimeout(resolve, 500));

		const state = useAuthStore.getState();
		const phone = state.phoneNumber || "default";
		const activeStorageKey = getMockProfileStorageKey(phone);
		const stored = localStorage.getItem(activeStorageKey);

		if (stored) {
			const profile = JSON.parse(stored);
			const documents: WalletDocument[] = profile.documents || [];
			profile.documents = documents.filter((d) => d.id !== documentId);
			localStorage.setItem(activeStorageKey, JSON.stringify(profile));
			return true;
		}
		return false;
	}

	async getFileBlob(
		documentId: string,
	): Promise<{ blob: Blob; mimeType: string }> {
		await new Promise((resolve) => setTimeout(resolve, 300));
		const state = useAuthStore.getState();
		const phone = state.phoneNumber || "default";
		const activeStorageKey = getMockProfileStorageKey(phone);
		const stored = localStorage.getItem(activeStorageKey);
		let isImg = documentId.includes("image") || documentId.includes("png");

		if (stored) {
			const profile = JSON.parse(stored);
			const doc = (profile.documents || []).find(
				(d: { id: string; name: string }) => d.id === documentId,
			);
			if (
				doc &&
				(doc.name.toLowerCase().endsWith(".png") ||
					doc.name.toLowerCase().endsWith(".jpg") ||
					doc.name.toLowerCase().endsWith(".jpeg"))
			) {
				isImg = true;
			}
		}

		if (isImg) {
			// Transparent 1x1 GIF or simple PNG blob
			const base64 =
				"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
			const byteCharacters = atob(base64);
			const byteNumbers = new Array(byteCharacters.length);
			for (let i = 0; i < byteCharacters.length; i++) {
				byteNumbers[i] = byteCharacters.charCodeAt(i);
			}
			const byteArray = new Uint8Array(byteNumbers);
			const blob = new Blob([byteArray], { type: "image/png" });
			return { blob, mimeType: "image/png" };
		}

		const content =
			"%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n5 0 obj\n<< /Length 44 >>\nstream\nBT\n/F1 24 Tf\n100 700 Td\n(Mock Document Preview) Tj\nET\nendstream\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000117 00000 n \n0000000289 00000 n \n0000000357 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n452\n%%EOF";
		const blob = new Blob([content], { type: "application/pdf" });
		return { blob, mimeType: "application/pdf" };
	}
}

export const mockFileService = new MockFileService();
