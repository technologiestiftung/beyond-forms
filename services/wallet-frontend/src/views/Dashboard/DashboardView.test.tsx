import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DashboardView } from "./DashboardView";
import { useProfileStore } from "../../store/useProfileStore";

const { mockProfileReturn } = vi.hoisted(() => ({
	mockProfileReturn: {
		profileData: { personalData: { firstName: "Jane" } } as
			| Record<string, unknown>
			| undefined,
		milestoneLevel: 0,
		isLoading: false,
		isError: false,
		refetch: vi.fn(),
	},
}));

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		/** Returns i18n keys except when `t` is called with a string default (e.g. ApplicationCard). */
		t: (key: string, options?: string | Record<string, unknown>) =>
			typeof options === "string" ? options : key,
		i18n: { language: "en", changeLanguage: vi.fn() },
	}),
}));

vi.mock("../../hooks/useProfile", () => ({
	useProfile: () => mockProfileReturn,
}));

vi.mock("../../hooks/useFormCompleteness", () => ({
	useFormCompleteness: () => ({ level: 0, isLoading: false }),
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
				"Starte mit Deinem Antrag. Klaro zeigt Dir Schritt-für-Schritt, was wichtig ist.",
			),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Fortfahren" }),
		).toBeInTheDocument();
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
			screen.getAllByRole("button", { name: "Antrag generieren" }),
		).toHaveLength(4);
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

	it("shows every application when no assessment has been stored", async () => {
		render(
			<MemoryRouter>
				<DashboardView />
			</MemoryRouter>,
		);
		await screen.findByTestId("language-switcher");
		expect(
			screen.getAllByRole("button", { name: "Antrag generieren" }),
		).toHaveLength(4);
		expect(screen.queryByTestId("dashboard-hidden-toggle")).toBeNull();
	});

	it("folds away the benefits the profile rules out", async () => {
		// A single pensioner: past the retirement age SGB II does not apply, and with nobody
		// else in the household neither does Kinderzuschlag. Both are categorical — no
		// income figure needed, which is exactly what the profile can answer.
		mockProfileReturn.profileData = {
			personalData: {
				firstName: "Jane",
				dateOfBirth: "1950-01-01",
				isGermanCitizen: true,
			},
			household: { maritalStatus: "Single", personsInHouseholdCount: 1 },
		};
		render(
			<MemoryRouter>
				<DashboardView />
			</MemoryRouter>,
		);
		await screen.findByTestId("dashboard-hidden-toggle");

		expect(screen.queryByTestId("dashboard-hidden-list")).toBeNull();
		screen.getByTestId("dashboard-hidden-toggle").click();
		expect(await screen.findByTestId("dashboard-hidden-list")).toBeTruthy();
	});

	it("keeps a benefit visible when the profile cannot decide it", async () => {
		// The profile carries no gross income, savings band or warm rent, so every
		// means-tested verdict is undecided — and undecided must never hide a form.
		mockProfileReturn.profileData = {
			personalData: {
				firstName: "Jane",
				dateOfBirth: "1994-01-15",
				isGermanCitizen: true,
			},
			household: { maritalStatus: "Single", personsInHouseholdCount: 1 },
			health: { abilityToWork: "Fully able" },
			financial: { monthlyIncome: 1100 },
		};
		render(
			<MemoryRouter>
				<DashboardView />
			</MemoryRouter>,
		);
		await screen.findByTestId("language-switcher");

		// Grundsicherungsgeld stays on offer: nothing in the profile rules it out.
		expect(
			screen.getByRole("heading", {
				level: 2,
				name: "sections.applications.basic_income.title",
			}),
		).toBeInTheDocument();
	});
});
