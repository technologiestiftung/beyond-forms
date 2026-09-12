import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DocumentReviewSuccessView } from "./DocumentReviewSuccessView";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
	const actual = await vi.importActual("react-router-dom");
	return {
		...actual,
		useNavigate: () => mockNavigate,
	};
});

describe("DocumentReviewSuccessView", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("replaces the flow step when it hands back to the exit route", () => {
		render(
			<MemoryRouter
				initialEntries={["/profile/documents/doc-1/success?origin=hub"]}
			>
				<DocumentReviewSuccessView />
			</MemoryRouter>,
		);

		fireEvent.click(screen.getByText("success.back_action"));

		expect(mockNavigate).toHaveBeenCalledWith(expect.any(String), {
			replace: true,
		});
	});
});
