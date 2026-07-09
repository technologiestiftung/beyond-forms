import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QuestionCard } from "./QuestionCard";

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, options?: { defaultValue?: string }) =>
			options?.defaultValue ?? key,
	}),
}));

describe("QuestionCard", () => {
	it("maintains a stable flex-grow and justify-between container structure to prevent button jump", () => {
		const onChangeMock = vi.fn();
		const onNextMock = vi.fn();

		const { rerender } = render(
			<QuestionCard
				id="livesInGermany"
				question="Wohnst du in Deutschland?"
				category="Wohnsitz"
				options={["YES", "NO"]}
				value={undefined}
				onChange={onChangeMock}
				onNext={onNextMock}
			/>,
		);

		const card = screen.getByTestId("question-card");
		// Verify resilient structural classes are present to prevent button jump
		expect(card).toHaveClass(
			"flex",
			"flex-col",
			"justify-between",
			"flex-grow",
		);

		// Initial state: Next button is disabled
		const nextBtn = screen.getByTestId("next-button");
		expect(nextBtn).toBeDisabled();

		// Click an option
		const optionYes = screen.getByTestId("option-yes");
		fireEvent.click(optionYes);
		expect(onChangeMock).toHaveBeenCalledWith("YES");

		// Re-render with selected value
		rerender(
			<QuestionCard
				id="livesInGermany"
				question="Wohnst du in Deutschland?"
				category="Wohnsitz"
				options={["YES", "NO"]}
				value="YES"
				onChange={onChangeMock}
				onNext={onNextMock}
			/>,
		);

		// Next button should now be enabled without losing structural layout integrity
		expect(nextBtn).toBeEnabled();
		expect(card).toHaveClass(
			"flex",
			"flex-col",
			"justify-between",
			"flex-grow",
		);
	});
});
