import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DateOfBirthCard } from "./DateOfBirthCard";

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, options?: { defaultValue?: string }) =>
			options?.defaultValue ?? key,
		i18n: { language: "de" },
	}),
}));

const baseProps = {
	id: "dateOfBirth",
	question: "Wann bist du geboren?",
	category: "Geburtsdatum",
	onChange: vi.fn(),
	onClear: vi.fn(),
	onNext: vi.fn(),
};

describe("DateOfBirthCard", () => {
	it("says nothing about a date while the field still has focus", () => {
		render(<DateOfBirthCard {...baseProps} />);
		const input = screen.getByTestId("dob-date-input");
		fireEvent.focus(input);
		fireEvent.change(input, { target: { value: "11.02.0001" } });
		expect(screen.queryByTestId("date-error")).toBeNull();
	});

	it("names a year before 1900 once the field is left", () => {
		render(<DateOfBirthCard {...baseProps} />);
		const input = screen.getByTestId("dob-date-input");
		fireEvent.focus(input);
		fireEvent.change(input, { target: { value: "11.02.0001" } });
		fireEvent.blur(input);
		expect(screen.getByTestId("date-error")).toHaveTextContent(
			"date_error.too_early",
		);
		expect(input).toHaveAttribute("aria-invalid", "true");
	});

	it("names a date in the future once the field is left", () => {
		render(<DateOfBirthCard {...baseProps} />);
		const input = screen.getByTestId("dob-date-input");
		fireEvent.change(input, { target: { value: "11.02.2099" } });
		fireEvent.blur(input);
		expect(screen.getByTestId("date-error")).toHaveTextContent(
			"date_error.future",
		);
	});

	it("drops the message once the date is corrected", () => {
		render(<DateOfBirthCard {...baseProps} />);
		const input = screen.getByTestId("dob-date-input");
		fireEvent.change(input, { target: { value: "11.02.2099" } });
		fireEvent.blur(input);
		expect(screen.getByTestId("date-error")).toBeInTheDocument();
		fireEvent.change(input, { target: { value: "02.05.1997" } });
		expect(screen.queryByTestId("date-error")).toBeNull();
	});

	it("says nothing about an empty field", () => {
		render(<DateOfBirthCard {...baseProps} />);
		fireEvent.blur(screen.getByTestId("dob-date-input"));
		expect(screen.queryByTestId("date-error")).toBeNull();
	});

	it("keeps the next button disabled on an out-of-range date", () => {
		render(<DateOfBirthCard {...baseProps} />);
		fireEvent.change(screen.getByTestId("dob-date-input"), {
			target: { value: "11.02.2099" },
		});
		expect(screen.getByTestId("next-button")).toBeDisabled();
	});

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
		fireEvent.change(dateInput, { target: { value: "20.01.1959" } });
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
