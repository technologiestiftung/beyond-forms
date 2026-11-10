import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DashboardView } from "./DashboardView";
import { useProfileStore } from "../../store/useProfileStore";

const { mockProfileReturn } = vi.hoisted(() => ({
	mockProfileReturn: {
		profileData: { personalData: { firstName: "Jane" } } as
			| { personalData: { firstName: string } }
			| undefined,
		milestoneLevel: 0,
		isLoading: false,
		isError: false,
		refetch: vi.fn(),
	},
}));

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: "en", changeLanguage: vi.fn() },
	}),
}));

vi.mock("../../hooks/useProfile", () => ({
	useProfile: () => mockProfileReturn,
}));

vi.mock("../../hooks/useFormCompleteness", () => ({
	useFormCompleteness: () => ({ level: 0, isLoading: false }),
}));

vi.mock("../../hooks/useKnowledgeCompleteness", () => ({
	useKnowledgeCompleteness: () => ({ level: 0, isLoading: false }),
}));

vi.mock("../../hooks/useDiscovery", () => ({
	useDiscoveryMatch: () => ({ data: undefined }),
}));

vi.mock("../../services/cms", () => ({
	cmsService: {
		getMyTutorials: vi.fn().mockResolvedValue([
			{
				id: "1",
				slug: "intro",
				title: { de: "Intro", en: "Intro EN" },
				progress: { status: "pending" },
			},
			{
				id: "2",
				slug: "app_guide",
				title: { de: "Guide", en: "Guide EN" },
				progress: { status: "pending" },
			},
		]),
		updateTutorialProgress: vi.fn(),
	},
}));

describe("DashboardView", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		localStorage.clear();
		sessionStorage.clear();
		mockProfileReturn.profileData = { personalData: { firstName: "Jane" } };
		mockProfileReturn.milestoneLevel = 0;
		mockProfileReturn.isLoading = false;
		mockProfileReturn.isError = false;
		mockProfileReturn.refetch = vi.fn();
		useProfileStore.setState({
			milestoneLevel: 0,
			applicationStatus: "idle",
			documents: [],
		});
	});

	it("renders the loading skeleton inside the shared top bar", () => {
		mockProfileReturn.isLoading = true;

		render(
			<MemoryRouter>
				<DashboardView />
			</MemoryRouter>,
		);

		expect(screen.getByRole("banner")).toBeInTheDocument();
	});

	it("renders checklist copy, application card, and language switcher", async () => {
		render(
			<MemoryRouter>
				<DashboardView />
			</MemoryRouter>,
		);

		await screen.findByRole("heading", {
			level: 1,
			name: "onboarding.checklist.greeting_named",
		});

		expect(screen.getByText("onboarding.checklist.intro")).toBeInTheDocument();
		expect(
			screen.getByRole("heading", {
				level: 2,
				name: "sections.applications.basic_security.title",
			}),
		).toBeInTheDocument();
		expect(
			screen.getByText(
				"sections.applications.basic_security.description.in_progress",
			),
		).toBeInTheDocument();
		expect(screen.getByTestId("application-overview-button")).toHaveTextContent(
			"sections.applications.basic_security.actions.complete",
		);
		expect(screen.getByTestId("application-generate-button")).toHaveTextContent(
			"sections.applications.generate_button",
		);
		expect(screen.getByTestId("language-switcher")).toBeInTheDocument();

		expect(
			screen.getByRole("heading", {
				level: 2,
				name: "sections.applications.parking_permit.title",
			}),
		).toBeInTheDocument();
		expect(
			screen.getByRole("heading", {
				level: 2,
				name: "sections.applications.housing_allowance.title",
			}),
		).toBeInTheDocument();
		expect(
			screen.getAllByRole("button", {
				name: "sections.applications.generate_button",
			}),
		).toHaveLength(5);
	});

	it("renders anonymous greeting when firstName is empty or whitespace", async () => {
		mockProfileReturn.profileData = {
			personalData: { firstName: "   " },
		};

		render(
			<MemoryRouter>
				<DashboardView />
			</MemoryRouter>,
		);

		await screen.findByRole("heading", {
			level: 1,
			name: "onboarding.checklist.greeting_anonymous",
		});
	});

	it("shows profile load error and calls refetch when Retry is clicked", async () => {
		mockProfileReturn.isError = true;
		mockProfileReturn.profileData = undefined;

		render(
			<MemoryRouter>
				<DashboardView />
			</MemoryRouter>,
		);

		await screen.findByRole("heading", {
			level: 1,
			name: "load_error.title",
		});

		expect(screen.getByText("load_error.description")).toBeInTheDocument();

		const retry = screen.getByRole("button", { name: "load_error.retry" });
		retry.click();
		expect(mockProfileReturn.refetch).toHaveBeenCalledTimes(1);
	});
});
