import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ChildrenCard } from "./ChildrenCard";

const baseProps = {
	id: "children",
	question: "Wann sind Deine Kinder geboren?",
	category: "Kinder im Haushalt",
	addLabel: "Kind hinzufügen",
	removeLabel: "Kind {{index}} entfernen",
	childLabel: "Kind {{index}}",
	onChange: vi.fn(),
	onNext: vi.fn(),
};

describe("ChildrenCard", () => {
	it("starts with one empty row so no extra click is needed", () => {
		render(<ChildrenCard {...baseProps} />);
		expect(screen.getAllByTestId(/^child-date-/)).toHaveLength(1);
	});

	it("adds a row", () => {
		render(<ChildrenCard {...baseProps} />);
		fireEvent.click(screen.getByTestId("add-child"));
		expect(screen.getAllByTestId(/^child-date-/)).toHaveLength(2);
	});

	it("removes a row", () => {
		render(<ChildrenCard {...baseProps} />);
		fireEvent.click(screen.getByTestId("add-child"));
		fireEvent.click(screen.getByTestId("remove-child-1"));
		expect(screen.getAllByTestId(/^child-date-/)).toHaveLength(1);
	});

	it("labels each row with its number", () => {
		render(<ChildrenCard {...baseProps} />);
		fireEvent.click(screen.getByTestId("add-child"));
		expect(screen.getByText("Kind 1")).toBeInTheDocument();
		expect(screen.getByText("Kind 2")).toBeInTheDocument();
	});

	it("names the child in the remove button's accessible label", () => {
		render(<ChildrenCard {...baseProps} />);
		fireEvent.click(screen.getByTestId("add-child"));
		expect(screen.getByTestId("remove-child-0")).toHaveAttribute(
			"aria-label",
			"Kind 1 entfernen",
		);
	});

	it("keeps the next button disabled while a row is empty", () => {
		render(<ChildrenCard {...baseProps} />);
		expect(screen.getByTestId("next-button")).toBeDisabled();
	});

	it("reports the filled rows and enables the next button", () => {
		const onChange = vi.fn();
		render(<ChildrenCard {...baseProps} onChange={onChange} />);
		fireEvent.change(screen.getByTestId("child-date-0"), {
			target: { value: "2019-04-02" },
		});
		expect(onChange).toHaveBeenCalledWith([{ dateOfBirth: "2019-04-02" }]);
		expect(screen.getByTestId("next-button")).not.toBeDisabled();
	});

	it("blocks the next button when a second row is added but left empty", () => {
		render(
			<ChildrenCard {...baseProps} value={[{ dateOfBirth: "2019-04-02" }]} />,
		);
		fireEvent.click(screen.getByTestId("add-child"));
		expect(screen.getByTestId("next-button")).toBeDisabled();
	});

	/**
	 * Typing a date by keyboard walks through an out-of-range date: the moment the first
	 * digit of the year lands, the browser completes the value as year 0001, which is
	 * below the field's own min. The card must leave that on screen — writing "" back
	 * wipes the day and month the user already typed.
	 */
	it("leaves a half-typed year on screen", () => {
		render(<ChildrenCard {...baseProps} />);
		const input = screen.getByTestId("child-date-0");
		fireEvent.change(input, { target: { value: "0001-02-11" } });
		expect(input).toHaveValue("0001-02-11");
	});

	it("does not report a date outside the allowed range upward", () => {
		const onChange = vi.fn();
		render(<ChildrenCard {...baseProps} onChange={onChange} />);
		fireEvent.change(screen.getByTestId("child-date-0"), {
			target: { value: "0001-02-11" },
		});
		expect(onChange).toHaveBeenCalledWith([]);
	});

	it("keeps the next button disabled on a date outside the allowed range", () => {
		render(<ChildrenCard {...baseProps} />);
		fireEvent.change(screen.getByTestId("child-date-0"), {
			target: { value: "0001-02-11" },
		});
		expect(screen.getByTestId("next-button")).toBeDisabled();
	});

	/**
	 * The message waits for blur. Typing a year walks through 0002, 0020, 0202 before it
	 * reaches 2020 — three out-of-range values in a row — and a message that appears and
	 * vanishes with every keystroke is worse than none.
	 */
	it("says nothing about a date while the field still has focus", () => {
		render(<ChildrenCard {...baseProps} />);
		const input = screen.getByTestId("child-date-0");
		fireEvent.focus(input);
		fireEvent.change(input, { target: { value: "0001-02-11" } });
		expect(screen.queryByTestId("date-error-0")).toBeNull();
	});

	it("names a year before 1900 once the field is left", () => {
		render(<ChildrenCard {...baseProps} />);
		const input = screen.getByTestId("child-date-0");
		fireEvent.focus(input);
		fireEvent.change(input, { target: { value: "0001-02-11" } });
		fireEvent.blur(input);
		expect(screen.getByTestId("date-error-0")).toHaveTextContent(
			"date_error.too_early",
		);
		expect(input).toHaveAttribute("aria-invalid", "true");
	});

	it("names a date in the future once the field is left", () => {
		render(<ChildrenCard {...baseProps} />);
		const input = screen.getByTestId("child-date-0");
		fireEvent.focus(input);
		fireEvent.change(input, { target: { value: "2099-02-11" } });
		fireEvent.blur(input);
		expect(screen.getByTestId("date-error-0")).toHaveTextContent(
			"date_error.future",
		);
	});

	it("drops the message once the date is corrected", () => {
		render(<ChildrenCard {...baseProps} />);
		const input = screen.getByTestId("child-date-0");
		fireEvent.change(input, { target: { value: "2099-02-11" } });
		fireEvent.blur(input);
		expect(screen.getByTestId("date-error-0")).toBeInTheDocument();
		fireEvent.change(input, { target: { value: "2019-04-02" } });
		expect(screen.queryByTestId("date-error-0")).toBeNull();
		expect(input).toHaveAttribute("aria-invalid", "false");
	});

	it("says nothing about an empty field", () => {
		render(<ChildrenCard {...baseProps} />);
		fireEvent.blur(screen.getByTestId("child-date-0"));
		expect(screen.queryByTestId("date-error-0")).toBeNull();
	});

	it("complains only about the row that is wrong", () => {
		render(
			<ChildrenCard {...baseProps} value={[{ dateOfBirth: "2019-04-02" }]} />,
		);
		fireEvent.click(screen.getByTestId("add-child"));
		const second = screen.getByTestId("child-date-1");
		fireEvent.change(second, { target: { value: "2099-02-11" } });
		fireEvent.blur(second);
		expect(screen.queryByTestId("date-error-0")).toBeNull();
		expect(screen.getByTestId("date-error-1")).toBeInTheDocument();
	});

	it("renders the rows it is given", () => {
		render(
			<ChildrenCard
				{...baseProps}
				value={[{ dateOfBirth: "2019-04-02" }, { dateOfBirth: "2021-06-11" }]}
			/>,
		);
		expect(screen.getAllByTestId(/^child-date-/)).toHaveLength(2);
		expect(screen.getByTestId("child-date-1")).toHaveValue("2021-06-11");
	});
});
