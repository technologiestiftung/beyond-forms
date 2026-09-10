import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { BenefitAssessmentCard } from "./BenefitAssessmentCard";
import {
	BenefitId,
	BenefitStatus,
	ReasonCode,
} from "../../schemas/benefitCheck.schema";
import type { BenefitAssessment } from "../../schemas/benefitCheck.schema";

const APPLY_PATH = "/profile?origin=eligibility";

const renderCard = (assessment: BenefitAssessment) =>
	render(
		<MemoryRouter>
			<BenefitAssessmentCard assessment={assessment} applyPath={APPLY_PATH} />
		</MemoryRouter>,
	);

describe("BenefitAssessmentCard", () => {
	it("names the benefit and the status", () => {
		renderCard({
			benefit: BenefitId.HOUSING_BENEFIT,
			status: BenefitStatus.CHECK_ADVISED,
			reasons: [ReasonCode.RENT_BURDEN_HIGH],
		});
		// The global i18n mock returns keys, so these assert the lookups happen.
		expect(
			screen.getByText("result.benefit.HOUSING_BENEFIT"),
		).toBeInTheDocument();
		expect(screen.getByText("result.status.CHECK_ADVISED")).toBeInTheDocument();
	});

	it("keeps the reasons hidden until the card is opened", () => {
		renderCard({
			benefit: BenefitId.HOUSING_BENEFIT,
			status: BenefitStatus.CHECK_ADVISED,
			reasons: [
				ReasonCode.RENT_BURDEN_HIGH,
				ReasonCode.EDUCATION_PACKAGE_FOLLOWS_BASE_BENEFIT,
			],
		});
		expect(screen.queryByText("result.reason.RENT_BURDEN_HIGH")).toBeNull();

		fireEvent.click(screen.getByTestId("toggle-HOUSING_BENEFIT"));

		expect(
			screen.getByText("result.reason.RENT_BURDEN_HIGH"),
		).toBeInTheDocument();
		expect(
			screen.getByText("result.reason.EDUCATION_PACKAGE_FOLLOWS_BASE_BENEFIT"),
		).toBeInTheDocument();
	});

	it("reports its open state so a screen reader can follow", () => {
		renderCard({
			benefit: BenefitId.HOUSING_BENEFIT,
			status: BenefitStatus.CHECK_ADVISED,
			reasons: [ReasonCode.RENT_BURDEN_HIGH],
		});
		const toggle = screen.getByTestId("toggle-HOUSING_BENEFIT");
		expect(toggle).toHaveAttribute("aria-expanded", "false");
		fireEvent.click(toggle);
		expect(toggle).toHaveAttribute("aria-expanded", "true");
	});

	it("offers no toggle when there is nothing to reveal", () => {
		renderCard({
			benefit: BenefitId.CHILD_SUPPLEMENT,
			status: BenefitStatus.LIKELY_NO,
			reasons: [],
		});
		expect(screen.queryByTestId("toggle-CHILD_SUPPLEMENT")).toBeNull();
		expect(screen.getByText("result.status.LIKELY_NO")).toBeInTheDocument();
	});

	it("gives the three decided statuses an icon", () => {
		for (const status of [
			BenefitStatus.LIKELY_YES,
			BenefitStatus.CHECK_ADVISED,
			BenefitStatus.LIKELY_NO,
		]) {
			const { unmount } = renderCard({
				benefit: BenefitId.HOUSING_BENEFIT,
				status,
				reasons: [],
			});
			expect(screen.getByTestId("status-icon"), status).toBeInTheDocument();
			unmount();
		}
	});

	it("gives no icon to a benefit that does not concern the applicant", () => {
		renderCard({
			benefit: BenefitId.SGB_XII_SUBSISTENCE_AID,
			status: BenefitStatus.NOT_APPLICABLE,
			reasons: [ReasonCode.NOT_IN_CAPACITY_GAP],
		});
		expect(screen.queryByTestId("status-icon")).toBeNull();
		expect(
			screen.getByTestId("assessment-SGB_XII_SUBSISTENCE_AID"),
		).toHaveAttribute("data-muted", "true");
	});

	it("sends a likely benefit to the application", () => {
		renderCard({
			benefit: BenefitId.ADVANCE_MAINTENANCE,
			status: BenefitStatus.LIKELY_YES,
			reasons: [ReasonCode.CHILD_SUPPORT_INCOMPLETE],
		});
		const action = screen.getByTestId("apply-ADVANCE_MAINTENANCE");
		expect(action).toHaveAttribute("href", APPLY_PATH);
		expect(action).toHaveTextContent("result.apply");
	});

	it("offers an uncertain benefit the check instead", () => {
		renderCard({
			benefit: BenefitId.HOUSING_BENEFIT,
			status: BenefitStatus.CHECK_ADVISED,
			reasons: [ReasonCode.RENT_BURDEN_HIGH],
		});
		const action = screen.getByTestId("apply-HOUSING_BENEFIT");
		expect(action).toHaveAttribute("href", APPLY_PATH);
		expect(action).toHaveTextContent("result.check_now");
	});

	it("offers no action for the two statuses that lead nowhere", () => {
		for (const status of [
			BenefitStatus.LIKELY_NO,
			BenefitStatus.NOT_APPLICABLE,
		]) {
			const { unmount } = renderCard({
				benefit: BenefitId.HOUSING_BENEFIT,
				status,
				reasons: [],
			});
			expect(screen.queryByTestId("apply-HOUSING_BENEFIT"), status).toBeNull();
			unmount();
		}
	});
});
