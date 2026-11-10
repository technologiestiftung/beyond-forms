import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AppRoutes } from "../../constants/routes";
import { ApplicationCard } from "./ApplicationCard";

vi.mock("../../hooks/useProfile", () => ({
	useProfile: () => ({ milestoneLevel: 1 }),
}));

vi.mock("../../hooks/useGeneratedPdfModal", () => ({
	useGeneratedPdfModal: () => ({
		handleGenerate: vi.fn(),
		isGenerating: false,
		error: null,
		modal: null,
	}),
}));

describe("ApplicationCard i18n", () => {
	it('renders "in_progress" state with translation keys', () => {
		render(
			<MemoryRouter>
				<ApplicationCard
					status="in_progress"
					formType="antrag_grundsicherung_im_alter"
				/>
			</MemoryRouter>,
		);
		expect(
			screen.getByText(
				"sections.applications.basic_security.description.in_progress",
			),
		).toBeInTheDocument();
		expect(
			screen.getByText("sections.applications.generate_button"),
		).toBeInTheDocument();
	});

	it('renders "completed" state with translation keys', () => {
		render(
			<MemoryRouter>
				<ApplicationCard
					status="completed"
					formType="antrag_grundsicherung_im_alter"
				/>
			</MemoryRouter>,
		);
		expect(
			screen.getByText(
				"sections.applications.basic_security.description.completed",
			),
		).toBeInTheDocument();
	});

	const renderCard = (
		status: "not_started" | "in_progress" | "completed",
		level: number,
	) =>
		render(
			<MemoryRouter>
				<Routes>
					<Route
						path="/"
						element={
							<ApplicationCard
								status={status}
								level={level}
								formType="antrag_grundsicherung_im_alter"
							/>
						}
					/>
					<Route
						path={AppRoutes.ApplicationOverview}
						element={<div data-testid="overview-page" />}
					/>
				</Routes>
			</MemoryRouter>,
		);

	const actionOrder = () =>
		screen
			.getAllByRole("button")
			.map((button) => button.getAttribute("data-testid"));

	it.each([
		["not_started", 0, ["application-overview-button"]],
		[
			"in_progress",
			1,
			["application-overview-button", "application-generate-button"],
		],
		[
			"in_progress",
			2,
			["application-generate-button", "application-overview-button"],
		],
		[
			"completed",
			3,
			["application-generate-button", "application-overview-button"],
		],
	] as const)(
		"shows the %s (level %i) actions in priority order",
		(status, level, expected) => {
			renderCard(status, level);
			expect(actionOrder()).toEqual(expected);
		},
	);

	it.each([
		["not_started", 0, "sections.applications.basic_security.actions.start"],
		["in_progress", 1, "sections.applications.basic_security.actions.complete"],
		[
			"completed",
			3,
			"sections.applications.basic_security.actions.view_details",
		],
	] as const)(
		"labels the overview action for %s (level %i)",
		(status, level, label) => {
			renderCard(status, level);
			expect(
				screen.getByTestId("application-overview-button"),
			).toHaveTextContent(label);
		},
	);

	it("opens the application overview from the overview action", () => {
		renderCard("in_progress", 1);
		fireEvent.click(screen.getByTestId("application-overview-button"));
		expect(screen.getByTestId("overview-page")).toBeInTheDocument();
	});
});
