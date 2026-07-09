import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProfileSectionCard } from "./ProfileSectionCard";
import { User } from "lucide-react";

// Mock translations
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (_key: string, defaultVal: string) => defaultVal,
	}),
}));

describe("ProfileSectionCard", () => {
	it("renders title, description, and custom icon box without legacy status text", () => {
		render(
			<ProfileSectionCard
				title="Persönliche Angaben"
				description="Name, Geburtsdatum"
				status="COMPLETE"
				icon={<User data-testid="custom-section-icon" />}
				onClick={() => {}}
			/>,
		);

		expect(screen.getByText("Persönliche Angaben")).toBeInTheDocument();
		expect(screen.getByText("Name, Geburtsdatum")).toBeInTheDocument();

		expect(screen.getByTestId("custom-section-icon")).toBeInTheDocument();

		// This should fail before implementation because the status indicator is not rendered
		expect(screen.getByTestId("status-indicator")).toBeInTheDocument();

		// Legacy text should be absent
		expect(screen.queryByText("Complete")).not.toBeInTheDocument();
	});
});
