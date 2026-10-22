import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { useChatStore } from "../../store/useChatStore";
import type { ViewComponent } from "../../schemas/generatedView.schema";
import { ChatCard, ChipButton } from "./GuidedCheck/ChatCard";

const TEXT_STYLES = {
	eyebrow: "text-[13px] text-brand-grey",
	title: "text-[16px] font-bold text-brand-black leading-snug",
	body: "text-[14px] text-brand-black leading-[22px]",
	muted: "text-[14px] text-brand-grey",
} as const;

const Children: React.FC<{ components: ViewComponent[] }> = ({
	components,
}) => (
	<>
		{components.map((component, index) => (
			<ViewPart key={index} component={component} />
		))}
	</>
);

const SendChip: React.FC<{
	label: string;
	sendText: string;
	variant?: "solid" | "outline";
}> = ({ label, sendText, variant }) => {
	const isLoading = useChatStore((s) => s.isLoading);
	return (
		<ChipButton
			variant={variant}
			disabled={isLoading}
			onClick={() => void useChatStore.getState().sendMessage(sendText)}
		>
			{label}
		</ChipButton>
	);
};

const Table: React.FC<{ columns: string[]; rows: string[][] }> = ({
	columns,
	rows,
}) => (
	<div className="w-full overflow-x-auto [contain:inline-size]">
		<table className="w-full border-collapse text-left text-[13px]">
			<thead>
				<tr>
					{columns.map((column) => (
						<th
							key={column}
							scope="col"
							className="border-b border-brand-border-subtle bg-brand-bg px-3 py-2 font-semibold"
						>
							{column}
						</th>
					))}
				</tr>
			</thead>
			<tbody>
				{rows.map((row, rowIndex) => (
					<tr key={rowIndex}>
						{row.map((cell, cellIndex) => (
							<td
								key={cellIndex}
								className="border-b border-brand-border-subtle px-3 py-2 align-top"
							>
								{cell}
							</td>
						))}
					</tr>
				))}
			</tbody>
		</table>
	</div>
);

/** Ticks are only for the user's own overview and are not sent anywhere. */
const Checklist: React.FC<{ items: { label: string; hint?: string }[] }> = ({
	items,
}) => {
	const [checked, setChecked] = useState<ReadonlySet<number>>(new Set());
	const toggle = (index: number) =>
		setChecked((current) => {
			const next = new Set(current);
			if (!next.delete(index)) {
				next.add(index);
			}
			return next;
		});

	return (
		<ul className="flex flex-col gap-2">
			{items.map((item, index) => (
				<li key={index}>
					<label className="flex cursor-pointer items-start gap-3 text-[14px]">
						<input
							type="checkbox"
							className="peer sr-only"
							checked={checked.has(index)}
							onChange={() => toggle(index)}
						/>
						<span
							aria-hidden="true"
							className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border-2 border-brand-border bg-white text-white peer-checked:border-primary-blue-500 peer-checked:bg-primary-blue-500 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary-blue-500"
						>
							<Check className="size-3.5" />
						</span>
						<span className="flex flex-col">
							<span
								className={
									checked.has(index) ? "line-through text-brand-grey" : ""
								}
							>
								{item.label}
							</span>
							{item.hint && (
								<span className="text-[13px] text-brand-grey">{item.hint}</span>
							)}
						</span>
					</label>
				</li>
			))}
		</ul>
	);
};

const ViewPart: React.FC<{ component: ViewComponent }> = ({ component }) => {
	switch (component.component) {
		case "Column":
			return (
				<div
					className={`flex flex-col ${component.spacing === "tight" ? "gap-1" : "gap-4"}`}
				>
					<Children components={component.children} />
				</div>
			);
		case "Row":
			return (
				<div className="flex flex-wrap gap-2">
					<Children components={component.children} />
				</div>
			);
		case "Text":
			return (
				<p className={TEXT_STYLES[component.variant ?? "body"]}>
					{component.text}
				</p>
			);
		case "Fact":
			return (
				<div className="text-[14px] leading-[22px]">
					<p className="font-semibold">{component.label}</p>
					<p>{component.text}</p>
				</div>
			);
		case "Note":
			return (
				<p className="w-fit rounded-full bg-primary-green-200 px-3 py-1 text-[13px] text-primary-blue-500">
					{component.text}
				</p>
			);
		case "DefinitionRow":
			return (
				<div className="flex justify-between gap-4 text-[14px]">
					<span className="text-brand-grey">{component.label}</span>
					<span className="font-semibold text-right">{component.value}</span>
				</div>
			);
		case "Table":
			return <Table columns={component.columns} rows={component.rows} />;
		case "Checklist":
			return <Checklist items={component.items} />;
		case "Chip":
			return (
				<SendChip
					label={component.label}
					sendText={component.sendText}
					variant={component.variant}
				/>
			);
		default:
			return (
				<Link
					to={component.href}
					className="w-fit text-[14px] text-primary-blue-400 underline"
				>
					{component.label}
				</Link>
			);
	}
};

/** A card the model composed with the `show_view` tool. */
export const GeneratedView: React.FC<{ components: ViewComponent[] }> = ({
	components,
}) => (
	<ChatCard testId="generated-view">
		<Children components={components} />
	</ChatCard>
);
