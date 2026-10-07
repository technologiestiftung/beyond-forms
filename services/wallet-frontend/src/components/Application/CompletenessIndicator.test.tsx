import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CompletenessIndicator } from "./CompletenessIndicator";

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (_key: string, defaultVal: string) => defaultVal,
	}),
}));

describe("CompletenessIndicator", () => {
	it.each([
		[0, "Gestartet", "bg-slate-300"],
		[1, "Gestartet", "bg-slate-300"],
		[2, "Fehlt noch etwas", "bg-secondary-orange-500"],
		[3, "Komplett", "bg-green-600"],
	] as const)(
		"shows level %i as '%s' with the profile dot color",
		(level, label, dotClass) => {
			render(<CompletenessIndicator level={level} />);

			const badge = screen.getByTestId("completeness-indicator");
			expect(badge).toHaveTextContent(label);
			expect(badge.querySelector("[aria-hidden='true']")).toHaveClass(dotClass);
		},
	);
});
