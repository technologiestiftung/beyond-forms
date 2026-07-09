import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DateOfBirthCard } from "./DateOfBirthCard";

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, options?: { defaultValue?: string }) =>
			options?.defaultValue ?? key,
	}),
}));

describe("DateOfBirthCard", () => {
	it("maintains a stable flex-grow and justify-between container structure to prevent button jump", () => {
		const onChangeMock = vi.fn();
		const onClearMock = vi.fn();
		const onNextMock = vi.fn();

		const { rerender } = render(
			<DateOfBirthCard
				id="dateOfBirth"
				question="Wann bist du geboren?"
				category="Geburtsdatum"
				value={undefined}
				onChange={onChangeMock}
				onClear={onClearMock}
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

		// Simulate entering a valid date
		const dateInput = screen.getByTestId("dob-date-input");
		fireEvent.change(dateInput, { target: { value: "1959-01-20" } });
		expect(onChangeMock).toHaveBeenCalledWith("1959-01-20");

		// Re-render with selected value
		rerender(
			<DateOfBirthCard
				id="dateOfBirth"
				question="Wann bist du geboren?"
				category="Geburtsdatum"
				value="1959-01-20"
				onChange={onChangeMock}
				onClear={onClearMock}
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
