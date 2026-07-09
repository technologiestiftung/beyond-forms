import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QuestionnaireStatusList } from "./QuestionnaireStatusList";
import { useProfile } from "../../hooks/useProfile";
import type { Profile } from "../../schemas/profile.schema";

// Mock react-i18next
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (_key: string, defaultText: string) => defaultText,
		i18n: { language: "de", changeLanguage: vi.fn() },
	}),
}));

// Mock the useProfile hook
vi.mock("../../hooks/useProfile", () => ({
	useProfile: vi.fn(),
}));

// Mock getMappedInformationSections to return a predictable list of complete and incomplete sections
const mockSections = [
	{
		id: "about_me",
		title: "Über Dich",
		completed: true,
		route: "/about-me",
		questionsRoute: "/about-me/questions",
		icon: () => <div data-testid="mock-icon-about_me" />,
		totalQuestions: 5,
		answeredQuestions: 5,
	},
	{
		id: "income_assets",
		title: "Dein Einkommen, Ersparnisse und Wertsachen",
		completed: false,
		route: "/income-assets",
		icon: () => <div data-testid="mock-icon-income_assets" />,
		totalQuestions: 6,
		answeredQuestions: 0,
	},
	{
		id: "household",
		title: "Familie und Haushalt",
		completed: false,
		route: "/household",
		icon: () => <div data-testid="mock-icon-household" />,
		totalQuestions: 5,
		answeredQuestions: 2,
	},
	{
		id: "health",
		title: "Gesundheit und zusätzlicher Bedarf",
		completed: false,
		route: "/health",
		icon: () => <div data-testid="mock-icon-health" />,
		totalQuestions: 3,
		answeredQuestions: 0,
	},
];

vi.mock("../../utils/profile", async () => {
	const actual = await vi.importActual("../../utils/profile");
	return {
		...actual,
		getMappedInformationSections: () => mockSections,
	};
});

describe("QuestionnaireStatusList", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(useProfile).mockReturnValue({
			profileData: {} as unknown as Profile,
			isLoading: false,
			isError: false,
			refetch: vi.fn(),
			updateSection: vi.fn(),
			isUpdating: false,
			updateError: null,
			deleteDocument: vi.fn(),
			isDeleting: false,
			submitProfile: vi.fn(),
			completionPercentage: 0,
			documents: [],
			milestoneLevel: 0,
		});
	});

	it("renders all questionnaire categories in the list with correct titles", () => {
		render(<QuestionnaireStatusList />);
		expect(screen.getByText("Über Dich")).toBeInTheDocument();
		expect(screen.getByText("Familie und Haushalt")).toBeInTheDocument();
		expect(
			screen.getByText("Dein Einkommen, Ersparnisse und Wertsachen"),
		).toBeInTheDocument();
		expect(
			screen.getByText("Gesundheit und zusätzlicher Bedarf"),
		).toBeInTheDocument();
	});

	it("renders correct progress badges and custom checkmark states", () => {
		render(<QuestionnaireStatusList />);

		// 1. Completed state (Über Dich): Filled circle with checkmark
		const completeCard = screen.getByText("Über Dich").closest("button");
		expect(completeCard).toBeInTheDocument();
		expect(screen.getByText("Fragen: 5/5")).toBeInTheDocument();
		expect(
			completeCard?.querySelector(".bg-primary-blue-500"),
		).toBeInTheDocument(); // Filled background circle

		// 2. Unlocked but Incomplete/Started state (Dein Einkommen, Ersparnisse und Wertsachen)
		const incomeCard = screen
			.getByText("Dein Einkommen, Ersparnisse und Wertsachen")
			.closest("button");
		expect(incomeCard).toBeInTheDocument();
		expect(incomeCard?.closest(".opacity-50")).not.toBeInTheDocument(); // Not disabled
		expect(incomeCard?.closest(".pointer-events-none")).not.toBeInTheDocument(); // Clickable

		// 3. Locked state (Familie und Haushalt): Locked and disabled because preceding active Income section is incomplete
		const householdCard = screen
			.getByText("Familie und Haushalt")
			.closest("button");
		expect(householdCard).toBeInTheDocument();
		expect(householdCard?.closest(".opacity-70")).toBeInTheDocument(); // Opacity disabled style
		expect(householdCard?.closest(".pointer-events-none")).toBeInTheDocument(); // Click disabled

		// 4. Locked state (Gesundheit und zusätzlicher Bedarf): Locked and disabled because preceding active Income section is incomplete
		const lockedCard = screen
			.getByText("Gesundheit und zusätzlicher Bedarf")
			.closest("button");
		expect(lockedCard).toBeInTheDocument();
		expect(lockedCard?.closest(".opacity-70")).toBeInTheDocument(); // Opacity disabled style
		expect(lockedCard?.closest(".pointer-events-none")).toBeInTheDocument(); // Click disabled
		expect(lockedCard?.querySelector("svg")).toBeInTheDocument(); // Gray lock circle
	});
});
