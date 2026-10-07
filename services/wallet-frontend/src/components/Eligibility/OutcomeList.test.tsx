import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { OutcomeList } from "./OutcomeList";

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

const renderList = (outcomes: Parameters<typeof OutcomeList>[0]["outcomes"]) =>
	render(
		<MemoryRouter>
			<OutcomeList outcomes={outcomes} />
		</MemoryRouter>,
	);

describe("OutcomeList", () => {
	it("gives every benefit its own card with title, reason and action", () => {
		renderList([
			{ translationKey: "eligible", isEligible: true },
			{ translationKey: "not_eligible", isEligible: false },
			{ translationKey: "sozialamt", isEligible: false },
		]);

		const cards = screen.getAllByTestId("outcome-card");
		expect(cards).toHaveLength(3);

		cards.forEach((card, index) => {
			const key = ["eligible", "not_eligible", "sozialamt"][index];
			expect(card).toHaveAccessibleName(`outcome.${key}.title`);
			expect(within(card).getByTestId("outcome-reason")).toHaveTextContent(
				`outcome.${key}.description`,
			);
			expect(within(card).getByTestId("outcome-cta")).toBeInTheDocument();
		});
	});

	it("links the Sozialamt outcome externally", () => {
		renderList([{ translationKey: "sozialamt", isEligible: false }]);

		expect(screen.getByTestId("outcome-cta")).toHaveAttribute(
			"target",
			"_blank",
		);
	});
});
