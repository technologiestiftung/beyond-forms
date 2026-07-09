/** @vitest-environment jsdom */
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { CheckCircleIcon } from "./Icons";

describe("CheckCircleIcon", () => {
	it("renders successfully with base SVG architecture", () => {
		const { container } = render(<CheckCircleIcon />);
		const svg = container.querySelector("svg");
		expect(svg).not.toBeNull();
		expect(svg?.getAttribute("aria-hidden")).toBe("true");

		const circle = svg?.querySelector("circle");
		expect(circle).not.toBeNull();
		expect(circle?.getAttribute("fill")).toBe("currentColor");

		const path = svg?.querySelector("path");
		expect(path).not.toBeNull();
		expect(path?.getAttribute("stroke")).toBe("white");
		expect(path?.getAttribute("stroke-width")).toBe("3");
	});

	it("flawlessly appends custom className and checkStroke", () => {
		const { container } = render(
			<CheckCircleIcon
				className="size-10 text-primary-blue-500 shrink-0"
				checkStroke="#16a34a"
			/>,
		);
		const svg = container.querySelector("svg");
		expect(svg?.getAttribute("class")).toContain(
			"size-10 text-primary-blue-500 shrink-0",
		);

		const path = svg?.querySelector("path");
		expect(path?.getAttribute("stroke")).toBe("#16a34a");
	});
});
