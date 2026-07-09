import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
	render,
	screen,
	fireEvent,
	waitFor,
	act,
} from "@testing-library/react";
import { DocumentDropzone } from "./DocumentDropzone";
import { BrowserRouter } from "react-router-dom";
import {
	fileService,
	type FileUploadResponse,
} from "../../services/profile/FileService";
import { useAuthStore } from "../../store/useAuthStore";
import { useProfileStore } from "../../store/useProfileStore";
import { useUIStore } from "../../store/useUIStore";
import { AppRoutes } from "../../constants/routes";

// Mock dependencies
const mockInvalidateQueries = vi.fn();
vi.mock("@tanstack/react-query", async () => {
	const actual = await vi.importActual("@tanstack/react-query");
	return {
		...actual,
		useQueryClient: () => ({
			invalidateQueries: mockInvalidateQueries,
		}),
	};
});

vi.mock("../../services/profile/FileService", () => ({
	fileService: {
		uploadFile: vi.fn(),
	},
}));

vi.mock("heic2any", () => ({
	default: vi.fn(),
}));

const mockNavigate = vi.fn();
let mockSearch = "";
vi.mock("react-router-dom", async () => {
	const actual = await vi.importActual("react-router-dom");
	return {
		...actual,
		useNavigate: () => mockNavigate,
		useLocation: () => ({
			pathname: "/",
			search: mockSearch,
			hash: "",
			state: null,
			key: "default",
		}),
	};
});

vi.mock("../../hooks/useProfile", () => ({
	useProfile: () => {
		const documents = useProfileStore((s) => s.documents);
		return {
			documents,
			isLoading: false,
			isError: false,
		};
	},
}));

const renderWithRouter = (ui: React.ReactElement) => {
	return render(ui, { wrapper: BrowserRouter });
};

describe("DocumentDropzone", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockSearch = "";
		useAuthStore.setState({ token: "mock-valid-token" });
		useProfileStore.getState().reset();
		localStorage.clear();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("renders the upload instructions initially", () => {
		renderWithRouter(<DocumentDropzone />);
		expect(
			screen.getByText("personal.choice.upload.title"),
		).toBeInTheDocument();
		expect(screen.getByText("personal.upload.drag_drop")).toBeInTheDocument();
	});

	it("allows file selection", async () => {
		renderWithRouter(<DocumentDropzone />);
		const input = document.querySelector('input[type="file"]');

		if (!input) {
			throw new Error("Input not found");
		}

		const file = new File(["hello"], "hello.png", { type: "image/png" });
		fireEvent.change(input, { target: { files: [file] } });

		expect(screen.getByAltText("Seite 1")).toBeInTheDocument();
		expect(screen.getByTestId("upload-confirm-button")).not.toBeDisabled();
	});

	it("shows processing state after successful upload", async () => {
		const mockResp: FileUploadResponse = {
			success: true,
			document: {
				id: "mock-doc-id",
				name: "hello.png",
				type: "ID_CARD",
				status: "PROCESSING",
				uploadDate: new Date().toISOString(),
				confidence: 1,
			},
		};
		vi.mocked(fileService.uploadFile).mockResolvedValue(mockResp);

		renderWithRouter(<DocumentDropzone />);
		const input = document.querySelector('input[type="file"]');
		if (!input) {
			throw new Error("Input not found");
		}

		const file = new File(["hello"], "hello.png", { type: "image/png" });
		fireEvent.change(input, { target: { files: [file] } });

		fireEvent.click(screen.getByTestId("upload-confirm-button"));

		expect(screen.getByText("personal.upload.uploading")).toBeInTheDocument();

		await waitFor(
			() => {
				expect(
					screen.getByText("personal.upload.processing"),
				).toBeInTheDocument();
			},
			{ timeout: 2000 },
		);
	});

	it("shows error state on upload failure", async () => {
		vi.mocked(fileService.uploadFile).mockResolvedValue({
			success: false,
			message: "Upload failed",
		});

		renderWithRouter(<DocumentDropzone />);
		const input = document.querySelector('input[type="file"]');
		if (!input) {
			throw new Error("Input not found");
		}

		const file = new File(["hello"], "hello.png", { type: "image/png" });
		fireEvent.change(input, { target: { files: [file] } });

		fireEvent.click(screen.getByTestId("upload-confirm-button"));

		await waitFor(() => {
			expect(screen.getByText("Upload failed")).toBeInTheDocument();
		});
	});

	it("redirects immediately to review page if analysis completes under 30s (Path A)", async () => {
		const mockResp: FileUploadResponse = {
			success: true,
			document: {
				id: "mock-doc-id",
				name: "hello.png",
				type: "ID_CARD",
				status: "PROCESSING",
				uploadDate: new Date().toISOString(),
				confidence: 1,
			},
		};
		vi.mocked(fileService.uploadFile).mockResolvedValue(mockResp);
		useProfileStore.setState({ documents: [] });

		renderWithRouter(<DocumentDropzone />);
		const input = document.querySelector('input[type="file"]');
		if (!input) {
			throw new Error("Input not found");
		}

		const file = new File(["hello"], "hello.png", { type: "image/png" });
		fireEvent.change(input, { target: { files: [file] } });

		fireEvent.click(screen.getByTestId("upload-confirm-button"));

		await waitFor(() => {
			expect(
				screen.getByText("personal.upload.processing"),
			).toBeInTheDocument();
		});

		// Simulate successful OCR extraction status update
		act(() => {
			useProfileStore.setState({
				documents: [
					{
						id: "mock-doc-id",
						name: "hello.png",
						type: "ID_CARD",
						status: "READY_FOR_REVIEW",
						uploadDate: new Date().toISOString(),
					},
				],
			});
		});

		await waitFor(
			() => {
				expect(mockNavigate).toHaveBeenCalledWith(
					"/profile/documents/mock-doc-id/review?origin=hub",
				);
			},
			{ timeout: 2500 },
		);
	});

	it("redirects to profile documents hub after processing timeout (Path B) and displays toast notification", async () => {
		const showToastSpy = vi.fn();
		useUIStore.setState({ showToast: showToastSpy });

		const mockResp: FileUploadResponse = {
			success: true,
			document: {
				id: "mock-doc-id",
				name: "hello.png",
				type: "ID_CARD",
				status: "PROCESSING",
				uploadDate: new Date().toISOString(),
				confidence: 1,
			},
		};
		vi.mocked(fileService.uploadFile).mockResolvedValue(mockResp);

		const { unmount } = renderWithRouter(<DocumentDropzone />);
		const input = document.querySelector('input[type="file"]');
		if (!input) {
			throw new Error("Input not found");
		}

		const file = new File(["hello"], "hello.png", { type: "image/png" });
		fireEvent.change(input, { target: { files: [file] } });

		fireEvent.click(screen.getByTestId("upload-confirm-button"));

		await waitFor(() => {
			expect(
				screen.getByText("personal.upload.processing"),
			).toBeInTheDocument();
		});

		// Timeout duration is configured to be 1000ms in test environment
		await waitFor(
			() => {
				expect(mockNavigate).toHaveBeenCalledWith("/profile/documents");
			},
			{ timeout: 1500 },
		);

		expect(showToastSpy).toHaveBeenCalledWith({
			type: "success",
			title: "personal.upload.background_processing_title",
			message: "personal.upload.background_processing_desc",
		});

		unmount();
	});

	it("aborts the active upload request on unmount", async () => {
		let capturedSignal: AbortSignal | undefined;
		vi.mocked(fileService.uploadFile).mockImplementation(
			async (
				_files: File | File[],
				_type: Parameters<typeof fileService.uploadFile>[1],
				signal?: AbortSignal,
			) => {
				capturedSignal = signal;
				return new Promise<FileUploadResponse>(() => {});
			},
		);

		const { unmount } = renderWithRouter(<DocumentDropzone />);
		const input = document.querySelector('input[type="file"]');
		if (!input) {
			throw new Error("Input not found");
		}

		const file = new File(["hello"], "hello.png", { type: "image/png" });
		fireEvent.change(input, { target: { files: [file] } });

		fireEvent.click(screen.getByTestId("upload-confirm-button"));

		expect(fileService.uploadFile).toHaveBeenCalled();
		expect(capturedSignal).toBeDefined();
		expect(capturedSignal?.aborted).toBe(false);

		unmount();

		expect(capturedSignal?.aborted).toBe(true);
	});

	it("redirects to login when session is expired (token is null) during upload", async () => {
		useAuthStore.setState({ token: "valid-token" });

		vi.mocked(fileService.uploadFile).mockImplementation(async () => {
			useAuthStore.setState({ token: null });
			return {
				success: false,
				message: "Upload failed",
			};
		});

		renderWithRouter(<DocumentDropzone />);
		const input = document.querySelector('input[type="file"]');
		if (!input) {
			throw new Error("Input not found");
		}

		const file = new File(["hello"], "hello.png", { type: "image/png" });
		fireEvent.change(input, { target: { files: [file] } });

		fireEvent.click(screen.getByTestId("upload-confirm-button"));

		await waitFor(() => {
			expect(mockNavigate).toHaveBeenCalledWith(AppRoutes.Auth);
		});
	});

	it("invalidates the profile query cache on successful upload", async () => {
		const mockResp: FileUploadResponse = {
			success: true,
			document: {
				id: "mock-doc-id",
				name: "hello.png",
				type: "ID_CARD",
				status: "PROCESSING",
				uploadDate: new Date().toISOString(),
				confidence: 1,
			},
		};
		vi.mocked(fileService.uploadFile).mockResolvedValue(mockResp);

		renderWithRouter(<DocumentDropzone />);
		const input = document.querySelector('input[type="file"]');
		if (!input) {
			throw new Error("Input not found");
		}

		const file = new File(["hello"], "hello.png", { type: "image/png" });
		fireEvent.change(input, { target: { files: [file] } });

		fireEvent.click(screen.getByTestId("upload-confirm-button"));

		await waitFor(() => {
			expect(mockInvalidateQueries).toHaveBeenCalledWith({
				queryKey: ["profile"],
			});
		});
	});

	it("renders the camera scan instructions and camera button in camera mode", () => {
		mockSearch = "?mode=camera";

		renderWithRouter(<DocumentDropzone />);

		expect(
			screen.getByText("personal.choice.camera.title"),
		).toBeInTheDocument();
		expect(screen.getByText("personal.choice.camera.desc")).toBeInTheDocument();
		expect(
			screen.getByText("personal.choice.camera.button"),
		).toBeInTheDocument();
	});

	it("redirects contextually to specific category on cancel when category param is present", () => {
		mockSearch = "?category=identity";
		renderWithRouter(<DocumentDropzone />);
		const cancelBtn = screen.getByTestId("tutorial-back");
		fireEvent.click(cancelBtn);
		expect(mockNavigate).toHaveBeenCalledWith(
			"/profile/documents/category/identity",
		);
	});

	it("redirects contextually to specific category after processing timeout (Path B) when category param is present", async () => {
		mockSearch = "?category=identity";
		const mockResp: FileUploadResponse = {
			success: true,
			document: {
				id: "mock-doc-id",
				name: "hello.png",
				type: "ID_CARD",
				status: "PROCESSING",
				uploadDate: new Date().toISOString(),
				confidence: 1,
			},
		};
		vi.mocked(fileService.uploadFile).mockResolvedValue(mockResp);

		const { unmount } = renderWithRouter(<DocumentDropzone />);
		const input = document.querySelector('input[type="file"]');
		if (!input) {
			throw new Error("Input not found");
		}

		const file = new File(["hello"], "hello.png", { type: "image/png" });
		fireEvent.change(input, { target: { files: [file] } });
		fireEvent.click(screen.getByTestId("upload-confirm-button"));

		await waitFor(() => {
			expect(
				screen.getByText("personal.upload.processing"),
			).toBeInTheDocument();
		});

		await waitFor(
			() => {
				expect(mockNavigate).toHaveBeenCalledWith(
					"/profile/documents/category/identity",
				);
			},
			{ timeout: 1500 },
		);

		unmount();
	});

	it("forwards category parameter to review page on fast analysis completion (Path A)", async () => {
		mockSearch = "?category=identity";
		const mockResp: FileUploadResponse = {
			success: true,
			document: {
				id: "mock-doc-id",
				name: "hello.png",
				type: "ID_CARD",
				status: "PROCESSING",
				uploadDate: new Date().toISOString(),
				confidence: 1,
			},
		};
		vi.mocked(fileService.uploadFile).mockResolvedValue(mockResp);
		useProfileStore.setState({ documents: [] });

		renderWithRouter(<DocumentDropzone />);
		const input = document.querySelector('input[type="file"]');
		if (!input) {
			throw new Error("Input not found");
		}

		const file = new File(["hello"], "hello.png", { type: "image/png" });
		fireEvent.change(input, { target: { files: [file] } });
		fireEvent.click(screen.getByTestId("upload-confirm-button"));

		await waitFor(() => {
			expect(
				screen.getByText("personal.upload.processing"),
			).toBeInTheDocument();
		});

		act(() => {
			useProfileStore.setState({
				documents: [
					{
						id: "mock-doc-id",
						name: "hello.png",
						type: "ID_CARD",
						status: "READY_FOR_REVIEW",
						uploadDate: new Date().toISOString(),
					},
				],
			});
		});

		await waitFor(
			() => {
				expect(mockNavigate).toHaveBeenCalledWith(
					"/profile/documents/mock-doc-id/review?origin=hub&category=identity",
				);
			},
			{ timeout: 2500 },
		);
	});

	it("clears the processing timeout if the component is unmounted before the timeout fires", async () => {
		const showToastSpy = vi.fn();
		useUIStore.setState({ showToast: showToastSpy });

		const mockResp: FileUploadResponse = {
			success: true,
			document: {
				id: "mock-doc-id",
				name: "hello.png",
				type: "ID_CARD",
				status: "PROCESSING",
				uploadDate: new Date().toISOString(),
				confidence: 1,
			},
		};
		vi.mocked(fileService.uploadFile).mockResolvedValue(mockResp);

		const { unmount } = renderWithRouter(<DocumentDropzone />);
		const input = document.querySelector('input[type="file"]');
		if (!input) {
			throw new Error("Input not found");
		}

		const file = new File(["hello"], "hello.png", { type: "image/png" });
		fireEvent.change(input, { target: { files: [file] } });
		fireEvent.click(screen.getByTestId("upload-confirm-button"));

		await waitFor(() => {
			expect(
				screen.getByText("personal.upload.processing"),
			).toBeInTheDocument();
		});

		unmount();

		await new Promise((r) => setTimeout(r, 1200));

		expect(showToastSpy).not.toHaveBeenCalled();
		expect(mockNavigate).not.toHaveBeenCalled();
	});

	it("active cta opens file picker when no file is selected initially", async () => {
		renderWithRouter(<DocumentDropzone />);
		const dropzone = screen.getByTestId("dropzone-select-trigger");
		expect(dropzone).not.toBeDisabled();

		const input = document.querySelector(
			'input[type="file"]',
		) as HTMLInputElement;
		const clickSpy = vi.spyOn(input, "click");

		fireEvent.click(dropzone);
		expect(clickSpy).toHaveBeenCalledOnce();
	});

	it("camera mode renders dedicated mobile capture interface and capture environment attribute", async () => {
		mockSearch = "?mode=camera";
		renderWithRouter(<DocumentDropzone />);

		const dropzone = screen.getByTestId("dropzone-select-trigger");
		expect(dropzone).not.toBeDisabled();
		expect(screen.getByText("personal.choice.camera.desc")).toBeInTheDocument();

		const input = document.querySelector(
			'input[type="file"]',
		) as HTMLInputElement;
		expect(input.getAttribute("capture")).toBe("environment");
	});

	it("renders an image preview thumbnail when an image file is queued and revokes on removal", async () => {
		const createObjectURLSpy = vi
			.spyOn(URL, "createObjectURL")
			.mockReturnValue("blob:mock-image-url");
		const revokeObjectURLSpy = vi.spyOn(URL, "revokeObjectURL");

		renderWithRouter(<DocumentDropzone />);
		const input = document.querySelector(
			'input[type="file"]',
		) as HTMLInputElement;

		const file = new File(["mock"], "scan.png", { type: "image/png" });
		fireEvent.change(input, { target: { files: [file] } });

		expect(createObjectURLSpy).toHaveBeenCalledWith(file);
		expect(screen.getByAltText("Seite 1")).toHaveAttribute(
			"src",
			"blob:mock-image-url",
		);

		const removeBtn = screen.getByLabelText("common.remove_file");
		fireEvent.click(removeBtn);

		expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:mock-image-url");
	});

	it("redirects immediately to wizard questions with extraction state if origin is wizard and category is about_me (Path A)", async () => {
		mockSearch = "?origin=wizard&category=about_me";
		const mockResp: FileUploadResponse = {
			success: true,
			document: {
				id: "mock-doc-id",
				name: "hello.png",
				type: "ID_CARD",
				status: "PROCESSING",
				uploadDate: new Date().toISOString(),
				confidence: 1,
			},
		};
		vi.mocked(fileService.uploadFile).mockResolvedValue(mockResp);
		useProfileStore.setState({ documents: [] });

		renderWithRouter(<DocumentDropzone />);
		const input = document.querySelector('input[type="file"]');
		if (!input) {
			throw new Error("Input not found");
		}

		const file = new File(["hello"], "hello.png", { type: "image/png" });
		fireEvent.change(input, { target: { files: [file] } });
		fireEvent.click(screen.getByTestId("upload-confirm-button"));

		await waitFor(() => {
			expect(
				screen.getByText("personal.upload.processing"),
			).toBeInTheDocument();
		});

		act(() => {
			useProfileStore.setState({
				documents: [
					{
						id: "mock-doc-id",
						name: "hello.png",
						type: "ID_CARD",
						status: "READY_FOR_REVIEW",
						uploadDate: new Date().toISOString(),
					},
				],
			});
		});

		await waitFor(
			() => {
				expect(mockNavigate).toHaveBeenCalledWith(
					"/dashboard/application/about-me/questions",
					{
						state: {
							extractedData: {
								given_names: "Helmut",
								family_name: "Klar",
								birth_date: "1959-05-12",
								birth_place: "Berlin",
							},
						},
					},
				);
			},
			{ timeout: 2500 },
		);
	});

	it("extracts mock first and last name dynamically from uploaded file name in mock flow", async () => {
		mockSearch = "?origin=wizard&category=about_me";
		const mockResp: FileUploadResponse = {
			success: true,
			document: {
				id: "mock-doc-id",
				name: "max_mustermann.png",
				type: "ID_CARD",
				status: "PROCESSING",
				uploadDate: new Date().toISOString(),
				confidence: 1,
			},
		};
		vi.mocked(fileService.uploadFile).mockResolvedValue(mockResp);
		useProfileStore.setState({ documents: [] });

		renderWithRouter(<DocumentDropzone />);
		const input = document.querySelector('input[type="file"]');
		if (!input) {
			throw new Error("Input not found");
		}

		const file = new File(["hello"], "max_mustermann.png", {
			type: "image/png",
		});
		fireEvent.change(input, { target: { files: [file] } });
		fireEvent.click(screen.getByTestId("upload-confirm-button"));

		await waitFor(() => {
			expect(
				screen.getByText("personal.upload.processing"),
			).toBeInTheDocument();
		});

		act(() => {
			useProfileStore.setState({
				documents: [
					{
						id: "mock-doc-id",
						name: "max_mustermann.png",
						type: "ID_CARD",
						status: "READY_FOR_REVIEW",
						uploadDate: new Date().toISOString(),
					},
				],
			});
		});

		await waitFor(
			() => {
				expect(mockNavigate).toHaveBeenCalledWith(
					"/dashboard/application/about-me/questions",
					{
						state: {
							extractedData: {
								given_names: "Max",
								family_name: "Mustermann",
								birth_date: "1959-05-12",
								birth_place: "Berlin",
							},
						},
					},
				);
			},
			{ timeout: 2500 },
		);
	});
});
