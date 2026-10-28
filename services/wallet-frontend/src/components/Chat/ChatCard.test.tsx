import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChatCard } from "./ChatCard";
import type { ChatCardMessage } from "../../store/useChatStore";

const message = (
	overrides: Partial<ChatCardMessage> = {},
): ChatCardMessage => ({
	id: "msg-1",
	role: "card",
	toolCallId: "call_1",
	card: {
		card_id: "step_marital_status",
		question: "Wie ist Ihr Familienstand?",
		hint: "So steht es im Antrag.",
		inputs: [
			{
				field: "marital_status",
				kind: "choice",
				label: "Familienstand",
				options: [
					{ value: "Single", label: "Ledig" },
					{ value: "Married", label: "Verheiratet" },
				],
			},
			{
				field: "married_since",
				kind: "date",
				label: "Verheiratet seit",
				optional: true,
			},
		],
	},
	...overrides,
});

const submit = () => screen.getByRole("button", { name: "card.submit" });

describe("ChatCard", () => {
	it("shows the question, hint and options from the backend", () => {
		render(
			<ChatCard message={message()} disabled={false} onSubmit={vi.fn()} />,
		);

		expect(screen.getByText("Wie ist Ihr Familienstand?")).toBeInTheDocument();
		expect(screen.getByText("So steht es im Antrag.")).toBeInTheDocument();
		expect(screen.getByText("Ledig")).toBeInTheDocument();
		expect(submit()).toBeDisabled();
	});

	it("submits only the inputs the user filled in", async () => {
		const onSubmit = vi.fn();
		render(
			<ChatCard message={message()} disabled={false} onSubmit={onSubmit} />,
		);

		fireEvent.click(screen.getByTestId("chat-card-marital_status-Single"));
		fireEvent.click(submit());

		await waitFor(() =>
			expect(onSubmit).toHaveBeenCalledWith({ marital_status: "Single" }),
		);
	});

	it("waits until every required input is filled in", () => {
		render(
			<ChatCard
				message={message({
					card: {
						card_id: "step_applicant_name",
						question: "Wie heißen Sie?",
						inputs: [
							{ field: "first_name", kind: "text", label: "Vorname" },
							{ field: "last_name", kind: "text", label: "Nachname" },
						],
					},
				})}
				disabled={false}
				onSubmit={vi.fn()}
			/>,
		);

		fireEvent.change(screen.getByLabelText("Vorname"), {
			target: { value: "Anna" },
		});
		expect(submit()).toBeDisabled();
		fireEvent.change(screen.getByLabelText("Nachname"), {
			target: { value: "Klar" },
		});
		expect(submit()).toBeEnabled();
	});

	it("offers every country for a select fed by the country list", async () => {
		const onSubmit = vi.fn();
		render(
			<ChatCard
				message={message({
					card: {
						card_id: "step_applicant_nationality",
						question: "Welche Staatsangehörigkeit haben Sie?",
						inputs: [
							{
								field: "nationality",
								kind: "select",
								label: "Staatsangehörigkeit",
								options_source: "countries",
							},
						],
					},
				})}
				disabled={false}
				onSubmit={onSubmit}
			/>,
		);

		expect(
			screen.getByRole("option", { name: "profile:personal.countries.PL" }),
		).toBeInTheDocument();
		fireEvent.change(screen.getByLabelText("Staatsangehörigkeit"), {
			target: { value: "PL" },
		});
		fireEvent.click(submit());

		await waitFor(() =>
			expect(onSubmit).toHaveBeenCalledWith({ nationality: "PL" }),
		);
	});

	it("converts amounts and keeps boolean choices", async () => {
		const onSubmit = vi.fn();
		render(
			<ChatCard
				message={message({
					card: {
						card_id: "step_applicant_legal_support",
						question: "Vermieten Sie unter?",
						inputs: [
							{
								field: "has_custodian",
								kind: "choice",
								label: "Betreuer",
								options: [
									{ value: true, label: "Ja" },
									{ value: false, label: "Nein" },
								],
							},
							{ field: "rent_total", kind: "amount", label: "Miete" },
						],
					},
				})}
				disabled={false}
				onSubmit={onSubmit}
			/>,
		);

		fireEvent.click(screen.getByTestId("chat-card-has_custodian-false"));
		fireEvent.change(screen.getByLabelText("Miete"), {
			target: { value: "520.5" },
		});
		fireEvent.click(submit());

		await waitFor(() =>
			expect(onSubmit).toHaveBeenCalledWith({
				has_custodian: false,
				rent_total: 520.5,
			}),
		);
	});

	it("shows an answered card read-only with its values", () => {
		render(
			<ChatCard
				message={message({
					answer: { marital_status: "Married", married_since: "2001-05-12" },
				})}
				disabled={false}
				onSubmit={vi.fn()}
			/>,
		);

		expect(
			screen.queryByRole("button", { name: "card.submit" }),
		).not.toBeInTheDocument();
		expect(screen.getByText("card.saved")).toBeInTheDocument();
		expect(screen.getByLabelText("Verheiratet seit")).toHaveValue("2001-05-12");
		expect(
			screen.getByTestId("chat-card-marital_status-Married"),
		).toBeDisabled();
	});
});
