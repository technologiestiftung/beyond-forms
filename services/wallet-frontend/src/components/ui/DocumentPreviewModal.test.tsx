import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { DocumentPreviewModal } from "./DocumentPreviewModal";
import { fileService } from "../../services/profile/FileService";

vi.mock("../../services/profile/FileService", () => ({
	fileService: {
		getFileBlob: vi.fn(),
	},
}));

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, defaultValue?: string) => defaultValue || key,
		i18n: { language: "de", changeLanguage: vi.fn() },
	}),
}));

describe("DocumentPreviewModal", () => {
	const mockOnClose = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
		window.URL.createObjectURL = vi.fn(() => "blob:http://localhost/mock-url");
		window.URL.revokeObjectURL = vi.fn();
	});

	it("renders loading spinner immediately on mount before blob resolves", () => {
		// Unresolved promise so it stays in loading state
		vi.mocked(fileService.getFileBlob).mockReturnValue(new Promise(() => {}));

		render(
			<DocumentPreviewModal
				isOpen={true}
				documentId="test-doc-1"
				onClose={mockOnClose}
			/>,
		);

		expect(screen.getByTestId("preview-loading-spinner")).toBeInTheDocument();
		expect(screen.getByText("Dokument wird geladen...")).toBeInTheDocument();
	});

	it("renders iframe for application/pdf", async () => {
		const mockBlob = new Blob(["pdf content"], { type: "application/pdf" });
		vi.mocked(fileService.getFileBlob).mockResolvedValue({
			blob: mockBlob,
			mimeType: "application/pdf",
		});

		render(
			<DocumentPreviewModal
				isOpen={true}
				documentId="test-doc-pdf"
				onClose={mockOnClose}
			/>,
		);

		await waitFor(() => {
			expect(
				screen.queryByTestId("preview-loading-spinner"),
			).not.toBeInTheDocument();
		});

		const iframe = screen.getByTitle("PDF Vorschau");
		expect(iframe).toBeInTheDocument();
		expect(iframe).toHaveAttribute(
			"src",
			"blob:http://localhost/mock-url#toolbar=0",
		);
	});

	it("renders img for image/png", async () => {
		const mockBlob = new Blob(["img content"], { type: "image/png" });
		vi.mocked(fileService.getFileBlob).mockResolvedValue({
			blob: mockBlob,
			mimeType: "image/png",
		});

		render(
			<DocumentPreviewModal
				isOpen={true}
				documentId="test-doc-img"
				onClose={mockOnClose}
			/>,
		);

		await waitFor(() => {
			expect(
				screen.queryByTestId("preview-loading-spinner"),
			).not.toBeInTheDocument();
		});

		const img = screen.getByAltText("Dokument-Vorschau");
		expect(img).toBeInTheDocument();
		expect(img).toHaveAttribute("src", "blob:http://localhost/mock-url");
	});

	it("calls onClose exactly once when Escape key is pressed", async () => {
		const mockBlob = new Blob(["pdf content"], { type: "application/pdf" });
		vi.mocked(fileService.getFileBlob).mockResolvedValue({
			blob: mockBlob,
			mimeType: "application/pdf",
		});

		render(
			<DocumentPreviewModal
				isOpen={true}
				documentId="test-doc-esc"
				onClose={mockOnClose}
			/>,
		);

		await waitFor(() => {
			expect(
				screen.queryByTestId("preview-loading-spinner"),
			).not.toBeInTheDocument();
		});

		fireEvent.keyDown(window, { key: "Escape" });
		expect(mockOnClose).toHaveBeenCalledTimes(1);
	});

	it("invokes window.URL.revokeObjectURL when unmounted or closed", async () => {
		const mockBlob = new Blob(["pdf content"], { type: "application/pdf" });
		vi.mocked(fileService.getFileBlob).mockResolvedValue({
			blob: mockBlob,
			mimeType: "application/pdf",
		});

		const { unmount } = render(
			<DocumentPreviewModal
				isOpen={true}
				documentId="test-doc-revoke"
				onClose={mockOnClose}
			/>,
		);

		await waitFor(() => {
			expect(
				screen.queryByTestId("preview-loading-spinner"),
			).not.toBeInTheDocument();
		});

		unmount();
		expect(window.URL.revokeObjectURL).toHaveBeenCalledWith(
			"blob:http://localhost/mock-url",
		);
	});
});
