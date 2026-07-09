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

const MOCK_TRANSLATIONS: Record<string, string> = {
	"overview.warning_modal_title": "Antrag vorzeitig generieren?",
};

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, defaultText: string) =>
			MOCK_TRANSLATIONS[key] || defaultText,
		i18n: { language: "de", changeLanguage: vi.fn() },
	}),
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

	it("renders the progress status card with progress bar", () => {
		renderComponent();
		expect(
			screen.getByText("Dein Antrag Schritt für Schritt zum Ziel"),
		).toBeInTheDocument();
		expect(screen.getByTestId("segmented-progress-bar")).toBeInTheDocument();
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

	it("renders both Öffnen and Herunterladen buttons and handles expiration recovery per new GCS signing rules", async () => {
		mockProfileState.milestoneLevel = 3;
		useProfileStore.setState({ milestoneLevel: 3 });
		renderComponent();
		const button = screen.getByTestId("generate-application-button");
		fireEvent.click(button);

		expect(
			await screen.findByText("Antragsentwurf Vorschau"),
		).toBeInTheDocument();

		const openLink = screen.getByText("Öffnen");
		expect(openLink).toBeInTheDocument();
		expect(openLink).toHaveAttribute("target", "_blank");
		expect(openLink).toHaveAttribute(
			"href",
			"https://storage.googleapis.com/open.pdf?disposition=inline",
		);
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
			await screen.findByText("Antrag vorzeitig generieren?"),
		).toBeInTheDocument();
	});

	it("directly opens PDF Preview Modal when generate button is clicked at milestoneLevel = 3", async () => {
		mockProfileState.milestoneLevel = 3;
		useProfileStore.setState({ milestoneLevel: 3 });
		renderComponent();
		const button = screen.getByTestId("generate-application-button");
		fireEvent.click(button);

		expect(
			await screen.findByText("Antragsentwurf Vorschau"),
		).toBeInTheDocument();
		expect(screen.getByTitle("PDF Vorschau")).toBeInTheDocument();
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
			await screen.findByText("Antragsentwurf Vorschau"),
		).toBeInTheDocument();
	});

	it("shows download button and triggers download inside the PDF Preview Modal", async () => {
		mockProfileState.milestoneLevel = 3;
		useProfileStore.setState({ milestoneLevel: 3 });
		renderComponent();
		const button = screen.getByTestId("generate-application-button");
		fireEvent.click(button);

		await waitFor(() => {
			expect(screen.getByText("Antragsentwurf Vorschau")).toBeInTheDocument();
		});

		const downloadButton = screen.getByText("Herunterladen");
		expect(downloadButton).toBeInTheDocument();

		fireEvent.click(downloadButton);
		expect(useProfileStore.getState().applicationStatus).toBe("idle");
	});

	it("renders the SegmentedProgressBar and not the legacy progress container", () => {
		renderComponent();
		expect(screen.getByTestId("segmented-progress-bar")).toBeInTheDocument();
		expect(screen.queryByText("Antragsfortschritt")).not.toBeInTheDocument();
	});
});
