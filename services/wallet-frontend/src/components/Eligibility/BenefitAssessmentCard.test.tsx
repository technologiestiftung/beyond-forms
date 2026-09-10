import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BenefitAssessmentCard } from "./BenefitAssessmentCard";
import {
	BenefitId,
	BenefitStatus,
	ReasonCode,
} from "../../schemas/benefitCheck.schema";

describe("BenefitAssessmentCard", () => {
	it("names the benefit, the status and every reason", () => {
		render(
			<BenefitAssessmentCard
				assessment={{
					benefit: BenefitId.HOUSING_BENEFIT,
					status: BenefitStatus.CHECK_ADVISED,
					reasons: [
						ReasonCode.RENT_BURDEN_HIGH,
						ReasonCode.EXACT_AMOUNT_NEEDS_OFFICIAL_FORMULA,
					],
				}}
			/>,
		);
		// The global i18n mock returns keys, so these assert the lookups happen.
		expect(
			screen.getByText("result.benefit.HOUSING_BENEFIT"),
		).toBeInTheDocument();
		expect(screen.getByText("result.status.CHECK_ADVISED")).toBeInTheDocument();
		expect(
			screen.getByText("result.reason.RENT_BURDEN_HIGH"),
		).toBeInTheDocument();
		expect(
			screen.getByText("result.reason.EXACT_AMOUNT_NEEDS_OFFICIAL_FORMULA"),
		).toBeInTheDocument();
	});

	it("marks a likely benefit with an icon", () => {
		render(
			<BenefitAssessmentCard
				assessment={{
					benefit: BenefitId.ADVANCE_MAINTENANCE,
					status: BenefitStatus.LIKELY_YES,
					reasons: [ReasonCode.CHILD_SUPPORT_INCOMPLETE],
				}}
			/>,
		);
		expect(screen.getByTestId("status-icon")).toBeInTheDocument();
	});

	it("gives no icon to any other status", () => {
		for (const status of [
			BenefitStatus.CHECK_ADVISED,
			BenefitStatus.LIKELY_NO,
			BenefitStatus.NOT_APPLICABLE,
		]) {
			const { unmount } = render(
				<BenefitAssessmentCard
					assessment={{
						benefit: BenefitId.HOUSING_BENEFIT,
						status,
						reasons: [],
					}}
				/>,
			);
			expect(screen.queryByTestId("status-icon"), status).toBeNull();
			unmount();
		}
	});

	it("mutes a benefit that does not concern the applicant", () => {
		render(
			<BenefitAssessmentCard
				assessment={{
					benefit: BenefitId.SGB_XII_SUBSISTENCE_AID,
					status: BenefitStatus.NOT_APPLICABLE,
					reasons: [ReasonCode.NOT_IN_CAPACITY_GAP],
				}}
			/>,
		);
		expect(
			screen.getByTestId("assessment-SGB_XII_SUBSISTENCE_AID"),
		).toHaveAttribute("data-muted", "true");
	});

	it("does not mute the other statuses", () => {
		render(
			<BenefitAssessmentCard
				assessment={{
					benefit: BenefitId.SGB_II_BASIC_INCOME,
					status: BenefitStatus.LIKELY_NO,
					reasons: [ReasonCode.INCOME_COVERS_NEEDS],
				}}
			/>,
		);
		expect(screen.getByTestId("assessment-SGB_II_BASIC_INCOME")).toHaveAttribute(
			"data-muted",
			"false",
		);
	});

	it("still names the status when there are no reasons", () => {
		render(
			<BenefitAssessmentCard
				assessment={{
					benefit: BenefitId.CHILD_SUPPLEMENT,
					status: BenefitStatus.LIKELY_NO,
					reasons: [],
				}}
			/>,
		);
		expect(screen.getByText("result.status.LIKELY_NO")).toBeInTheDocument();
	});
});
