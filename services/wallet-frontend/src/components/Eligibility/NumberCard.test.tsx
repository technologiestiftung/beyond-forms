import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NumberCard } from "./NumberCard";

const baseProps = {
	id: "warm-rent",
	question: "Wie hoch ist Deine Warmmiete im Monat?",
	category: "Wohnen",
	unitLabel: "Euro",
	onChange: vi.fn(),
	onClear: vi.fn(),
	onNext: vi.fn(),
};

describe("NumberCard", () => {
	it("reports a plain number", () => {
		const onChange = vi.fn();
		render(<NumberCard {...baseProps} onChange={onChange} />);
		fireEvent.change(screen.getByTestId("number-input"), {
			target: { value: "650" },
		});
		expect(onChange).toHaveBeenCalledWith(650);
	});

	it("accepts a decimal comma and reports a number", () => {
		const onChange = vi.fn();
		render(<NumberCard {...baseProps} onChange={onChange} />);
		fireEvent.change(screen.getByTestId("number-input"), {
			target: { value: "430,87" },
		});
		expect(onChange).toHaveBeenCalledWith(430.87);
	});

	it("ignores letters entirely", () => {
		const onChange = vi.fn();
		render(<NumberCard {...baseProps} onChange={onChange} />);
		fireEvent.change(screen.getByTestId("number-input"), {
			target: { value: "abc" },
		});
		expect(onChange).not.toHaveBeenCalled();
		expect(screen.getByTestId("number-input")).toHaveValue("");
	});

	it("clears rather than reporting zero for an empty field", () => {
		const onClear = vi.fn();
		const onChange = vi.fn();
		render(
			<NumberCard
				{...baseProps}
				value={650}
				onChange={onChange}
				onClear={onClear}
			/>,
		);
		fireEvent.change(screen.getByTestId("number-input"), {
			target: { value: "" },
		});
		expect(onClear).toHaveBeenCalled();
		expect(onChange).not.toHaveBeenCalledWith(0);
	});

	it("keeps the next button disabled without a value", () => {
		render(<NumberCard {...baseProps} />);
		expect(screen.getByTestId("next-button")).toBeDisabled();
	});

	it("enables the next button once a value is set, including zero", () => {
		render(<NumberCard {...baseProps} value={0} />);
		expect(screen.getByTestId("next-button")).not.toBeDisabled();
	});

	it("shows the unit label", () => {
		render(<NumberCard {...baseProps} />);
		expect(screen.getByText("Euro")).toBeInTheDocument();
	});

	it("uses a decimal keypad rather than a spinner", () => {
		render(<NumberCard {...baseProps} />);
		const input = screen.getByTestId("number-input");
		expect(input).toHaveAttribute("type", "text");
		expect(input).toHaveAttribute("inputMode", "decimal");
	});
});
