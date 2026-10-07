import React from "react";
import { OutcomeCard, type Outcome } from "./OutcomeCard";

interface OutcomeListProps {
	outcomes: Outcome[];
}

export const OutcomeList: React.FC<OutcomeListProps> = ({ outcomes }) => {
	return (
		<ul
			data-testid="outcome-list"
			className="w-full flex flex-col gap-9 lg:gap-6"
		>
			{outcomes.map((outcome) => (
				<li key={outcome.translationKey} className="w-full">
					<OutcomeCard {...outcome} />
				</li>
			))}
		</ul>
	);
};
