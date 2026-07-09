import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ApplicationCard } from "./ApplicationCard";

vi.mock("../../hooks/useProfile", () => ({
	useProfile: () => ({ milestoneLevel: 1 }),
}));

describe("ApplicationCard i18n", () => {
	it('renders "in_progress" state with translation keys', () => {
		render(
			<MemoryRouter>
				<ApplicationCard status="in_progress" />
			</MemoryRouter>,
		);
		expect(
			screen.getByText(
				"sections.applications.basic_security.description.in_progress",
			),
		).toBeInTheDocument();
		expect(
			screen.getByText("sections.applications.basic_security.actions.continue"),
		).toBeInTheDocument();
	});

	it('renders "completed" state with translation keys', () => {
		render(
			<MemoryRouter>
				<ApplicationCard status="completed" />
			</MemoryRouter>,
		);
		expect(
			screen.getByText(
				"sections.applications.basic_security.description.completed",
			),
		).toBeInTheDocument();
	});
});
