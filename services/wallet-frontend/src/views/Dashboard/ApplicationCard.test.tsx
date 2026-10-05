import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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
});
