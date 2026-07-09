import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FileService } from "./FileService";
import { env } from "../../config/env.config";

// Mock Auth Store at the top level
vi.mock("../../store/useAuthStore", () => ({
	useAuthStore: {
		getState: () => ({ token: "mock-token" }),
	},
}));

// Mock env at the top level
vi.mock("../../config/env.config", () => ({
	env: {
		VITE_API_URL: "/api",
		VITE_USE_MOCKS: false,
		VITE_USE_MOCK_AUTH: false,
	},
}));

describe("FileService", () => {
	let service: FileService;

	beforeEach(() => {
		service = new FileService();
		vi.stubGlobal("fetch", vi.fn());
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.clearAllMocks();
	});

	it("getFiles should return an array of mapped WalletDocuments", async () => {
		const mockPayload = [
			{
				document_id: "doc-123",
				object_name: "id-card.pdf",
				document_type: "ID_CARD",
				status: "COMPLETED",
				confidence_score: 0.95,
				upload_date: "2023-10-01T12:00:00Z",
				file_url: "https://storage.googleapis.com/beyond-forms/id-card.pdf",
			},
		];

		vi.mocked(fetch).mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(mockPayload),
		} as Response);

		const result = await service.getFiles();

		expect(fetch).toHaveBeenCalledWith(
			`${env.VITE_API_URL}/files`,
			expect.any(Object),
		);
		expect(result).toHaveLength(1);
		expect(result[0]).toEqual({
			id: "doc-123",
			name: "id-card.pdf",
			type: "id_card",
			status: "COMPLETED",
			confidence: 0.95,
			uploadDate: "2023-10-01T12:00:00Z",
			fileUrl: "https://storage.googleapis.com/beyond-forms/id-card.pdf",
			user_error_code: undefined,
		});
	});

	it("getFiles should default status to PROCESSING if missing in payload", async () => {
		const mockPayload = [
			{
				document_id: "doc-123",
				object_name: "id-card.pdf",
				document_type: "ID_CARD",
				confidence_score: 0.95,
				upload_date: "2023-10-01T12:00:00Z",
				file_url: "https://storage.googleapis.com/beyond-forms/id-card.pdf",
			},
		];

		vi.mocked(fetch).mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(mockPayload),
		} as Response);

		const result = await service.getFiles();

		expect(result[0].status).toBe("PROCESSING");
	});

	it("getFiles should return an empty array on fetch failure", async () => {
		vi.mocked(fetch).mockResolvedValue({
			ok: false,
			status: 500,
		} as Response);

		const result = await service.getFiles();
		expect(result).toEqual([]);
	});

	it("getFiles should return an empty array on network error", async () => {
		vi.mocked(fetch).mockRejectedValue(new Error("Network error"));

		const result = await service.getFiles();
		expect(result).toEqual([]);
	});

	const mockBulkItems = [
		{ file: new File([], "id-card.pdf"), type: "ID_CARD" as const },
		{ file: new File([], "bank-statement.pdf"), type: "bank" as const },
	];

	it("bulkUploadFiles should return an array of mapped WalletDocuments", async () => {
		vi.mocked(fetch).mockResolvedValue({
			ok: true,
			status: 200,
			json: () =>
				Promise.resolve([
					{ name: "id-card.pdf", document_id: "doc-123", status: "success" },
					{
						name: "bank-statement.pdf",
						document_id: "doc-456",
						status: "success",
					},
				]),
		} as Response);

		const result = await service.bulkUploadFiles(mockBulkItems);

		expect(fetch).toHaveBeenCalledWith(
			`${env.VITE_API_URL}/bulk-upload`,
			expect.objectContaining({ method: "POST", credentials: "include" }),
		);
		expect(result).toHaveLength(2);
		expect(result[0]).toEqual({
			success: true,
			document: {
				id: "doc-123",
				name: "id-card.pdf",
				type: "ID_CARD",
				status: "PROCESSING",
				uploadDate: expect.any(String),
				confidence: 0,
			},
		});
		expect(result[1]).toEqual({
			success: true,
			document: {
				id: "doc-456",
				name: "bank-statement.pdf",
				type: "bank",
				status: "PROCESSING",
				uploadDate: expect.any(String),
				confidence: 0,
			},
		});
	});

	it("bulkUploadFiles should map per-file failures from a successful response", async () => {
		vi.mocked(fetch).mockResolvedValue({
			ok: true,
			status: 200,
			json: () =>
				Promise.resolve([
					{ name: "id-card.pdf", document_id: "doc-123", status: "success" },
					{
						name: "bank-statement.pdf",
						error_message: "File too large",
						status: "failed",
					},
				]),
		} as Response);

		const result = await service.bulkUploadFiles(mockBulkItems);

		expect(result).toHaveLength(2);
		expect(result[0].success).toBe(true);
		expect(result[1]).toEqual({ success: false, message: "File too large" });
	});

	it("bulkUploadFiles should return an array of failed uploads", async () => {
		vi.mocked(fetch).mockResolvedValue({ ok: false, status: 500 } as Response);

		const result = await service.bulkUploadFiles(mockBulkItems);
		expect(result).toHaveLength(2);
		expect(result[0]).toEqual({ success: false, message: "Upload failed" });
		expect(result[1]).toEqual({ success: false, message: "Upload failed" });
	});

	it("bulkUploadFiles should return an array of failed uploads on network error", async () => {
		vi.mocked(fetch).mockRejectedValue(new Error("Network error"));

		const result = await service.bulkUploadFiles(mockBulkItems);
		expect(result).toHaveLength(2);
		expect(result[0]).toEqual({ success: false, message: "Network error" });
		expect(result[1]).toEqual({ success: false, message: "Network error" });
	});
});
