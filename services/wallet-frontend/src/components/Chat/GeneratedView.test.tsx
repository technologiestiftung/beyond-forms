import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { GeneratedView } from "./GeneratedView";
import { useChatStore } from "../../store/useChatStore";

describe("GeneratedView", () => {
	beforeEach(() => {
		useChatStore.setState({ isLoading: false });
	});

	it("renders the components the model composed", () => {
		render(
			<MemoryRouter>
				<GeneratedView
					components={[
						{ component: "Text", variant: "title", text: "Unterlagen" },
						{ component: "Checklist", items: [{ label: "Mietvertrag" }] },
						{
							component: "Table",
							columns: ["Leistung"],
							rows: [["Wohngeld"]],
						},
						{ component: "Link", label: "Dokumente", href: "/profile" },
					]}
				/>
			</MemoryRouter>,
		);

		expect(screen.getByText("Unterlagen")).toBeInTheDocument();
		expect(
			screen.getByRole("checkbox", { name: "Mietvertrag" }),
		).toBeInTheDocument();
		expect(screen.getByRole("cell", { name: "Wohngeld" })).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Dokumente" })).toHaveAttribute(
			"href",
			"/profile",
		);
	});

	it("sends the chip text as the user's message", () => {
		const sendMessage = vi.fn();
		useChatStore.setState({ sendMessage });

		render(
			<MemoryRouter>
				<GeneratedView
					components={[
						{
							component: "Row",
							children: [
								{ component: "Chip", label: "Mehr", sendText: "Mehr dazu" },
							],
						},
					]}
				/>
			</MemoryRouter>,
		);
		fireEvent.click(screen.getByRole("button", { name: "Mehr" }));

		expect(sendMessage).toHaveBeenCalledWith("Mehr dazu");
	});
});
