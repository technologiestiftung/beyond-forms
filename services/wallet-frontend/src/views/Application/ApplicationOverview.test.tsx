import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ApplicationOverview } from "./ApplicationOverview";
import { useProfileStore } from "../../store/useProfileStore";
import { env } from "../../config/env.config";

const { mockProfileState } = vi.hoisted(() => ({
	mockProfileState: {
		milestoneLevel: 0,
		documents: [] as unknown[],
	},
}));

const mockUseDocumentProcessingSocket = vi.fn();
vi.mock("../../hooks/useDocumentProcessingSocket", () => ({
	useDocumentProcessingSocket: () => mockUseDocumentProcessingSocket(),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@tanstack/react-query")>();
	return {
		...actual,
		useQueryClient: () => ({
			invalidateQueries: vi.fn(),
		}),
	};
});

import { authenticatedFetch } from "../../utils/apiClient";

vi.mock("../../utils/apiClient", () => ({
	authenticatedFetch: vi.fn(),
}));

vi.mock("../../hooks/useProfile", () => ({
	useProfile: () => ({
		profileData: {},
		milestoneLevel: mockProfileState.milestoneLevel,
		documents: mockProfileState.documents,
		isLoading: false,
		isError: false,
	}),
}));

describe("ApplicationOverview", () => {
	beforeAll(() => {
		window.URL.createObjectURL = vi.fn(() => "mock-blob-url");
		window.URL.revokeObjectURL = vi.fn();
	});

	beforeEach(() => {
		vi.clearAllMocks();
		mockProfileState.milestoneLevel = 0;
		mockProfileState.documents = [];

		env.VITE_USE_MOCKS = false;
		env.VITE_USE_MOCK_AUTH = false;

		useProfileStore.setState({
			milestoneLevel: 0,
			applicationStatus: "idle",
			documents: [],
		});
		vi.mocked(authenticatedFetch).mockResolvedValue({
			ok: true,
			headers: {
				get: () => "application/json",
				"content-type": "application/json",
			},
			json: async () => ({
				signed_open_url:
					"https://storage.googleapis.com/open.pdf?disposition=inline",
				signed_download_url:
					"https://storage.googleapis.com/download.pdf?disposition=attachment",
				expires_in_seconds: 60,
			}),
			blob: async () =>
				new Blob(["mock-pdf-content"], { type: "application/pdf" }),
		} as unknown as Response);
	});

	const renderComponent = () => {
		return render(
			<MemoryRouter>
				<ApplicationOverview />
			</MemoryRouter>,
		);
	};

	it("does not render the legacy stats banner", () => {
		renderComponent();
		expect(
			screen.queryByTestId("application-stats-banner"),
		).not.toBeInTheDocument();
	});

	it("renders QuestionnaireStatusList per overview layout rules", () => {
		renderComponent();
		expect(screen.getByTestId("questionnaire-status-list")).toBeInTheDocument();
	});

	it("calls useDocumentProcessingSocket to initiate websocket connection", () => {
		renderComponent();
		expect(mockUseDocumentProcessingSocket).toHaveBeenCalled();
	});

	it("renders the top Antrag generieren button and triggers warning dialog at milestoneLevel < 3", () => {
		mockProfileState.milestoneLevel = 2;
		useProfileStore.setState({ milestoneLevel: 2 });
		renderComponent();
		const button = screen.getByTestId("generate-application-button");
		expect(button).toBeInTheDocument();
	});

	it("renders the download button and triggers download", async () => {
		mockProfileState.milestoneLevel = 3;
		useProfileStore.setState({ milestoneLevel: 3 });
		renderComponent();
		const button = screen.getByTestId("generate-application-button");
		fireEvent.click(button);

		expect(
			await screen.findByText("overview.preview_title"),
		).toBeInTheDocument();

		const downloadButton = screen.getByTestId("download-pdf-button");
		expect(downloadButton).toBeInTheDocument();

		const hiddenAnchor = screen.getByTestId(
			"download-pdf-anchor",
		) as HTMLAnchorElement;
		const clickSpy = vi.spyOn(hiddenAnchor, "click");

		fireEvent.click(downloadButton);

		expect(hiddenAnchor.getAttribute("href")).toContain(
			"storage.googleapis.com/download.pdf",
		);
		expect(clickSpy).toHaveBeenCalled();
	});

	it("renders the LanguageSwitcher", () => {
		renderComponent();
		expect(screen.getByTestId("language-switcher")).toBeInTheDocument();
	});

	it("shows warning modal when generate button is clicked at milestoneLevel < 3", async () => {
		mockProfileState.milestoneLevel = 2;
		useProfileStore.setState({ milestoneLevel: 2 });
		renderComponent();
		const button = screen.getByTestId("generate-application-button");
		fireEvent.click(button);

		expect(
			await screen.findByText("overview.warning_modal_title"),
		).toBeInTheDocument();
	});

	it("directly opens PDF Preview Modal when generate button is clicked at milestoneLevel = 3", async () => {
		mockProfileState.milestoneLevel = 3;
		useProfileStore.setState({ milestoneLevel: 3 });
		renderComponent();
		const button = screen.getByTestId("generate-application-button");
		fireEvent.click(button);

		expect(
			await screen.findByText("overview.preview_title"),
		).toBeInTheDocument();
		expect(screen.getByTitle("overview.pdf_preview_title")).toBeInTheDocument();
	});

	it("opens PDF Preview Modal after confirming warning dialog", async () => {
		mockProfileState.milestoneLevel = 1;
		useProfileStore.setState({ milestoneLevel: 1 });
		renderComponent();
		const button = screen.getByTestId("generate-application-button");
		fireEvent.click(button);

		const confirmButton = screen.getByTestId("confirm-modal-submit");
		fireEvent.click(confirmButton);

		expect(
			await screen.findByText("overview.preview_title"),
		).toBeInTheDocument();
	});

	it("shows download button and triggers download inside the PDF Preview Modal", async () => {
		mockProfileState.milestoneLevel = 3;
		useProfileStore.setState({ milestoneLevel: 3 });
		renderComponent();
		const button = screen.getByTestId("generate-application-button");
		fireEvent.click(button);

		await waitFor(() => {
			expect(screen.getByText("overview.preview_title")).toBeInTheDocument();
		});

		const downloadButton = screen.getByText("overview.download_button");
		expect(downloadButton).toBeInTheDocument();

		fireEvent.click(downloadButton);
		expect(useProfileStore.getState().applicationStatus).toBe("idle");
	});

	it("shows the almost-ready copy below a complete application", () => {
		mockProfileState.milestoneLevel = 2;
		useProfileStore.setState({ milestoneLevel: 2 });
		renderComponent();
		expect(
			screen.getByText("overview.cta_band.almost_ready_title"),
		).toBeInTheDocument();
		expect(
			screen.queryByText("overview.cta_band.ready_title"),
		).not.toBeInTheDocument();
	});

	it("shows the ready copy instead of the almost-ready copy once complete", () => {
		mockProfileState.milestoneLevel = 3;
		useProfileStore.setState({ milestoneLevel: 3 });
		renderComponent();
		expect(
			screen.getByText("overview.cta_band.ready_title"),
		).toBeInTheDocument();
		expect(
			screen.getByText("overview.generate_notice_ready_title"),
		).toBeInTheDocument();
		expect(
			screen.queryByText("overview.cta_band.almost_ready_title"),
		).not.toBeInTheDocument();
	});
});
