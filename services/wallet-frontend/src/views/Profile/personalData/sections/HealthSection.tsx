import React from "react";
import { FormField, SelectField, CheckboxField } from "../fields";
import type { SectionProps } from "../types";

const ABILITY_TO_WORK_OPTIONS = [
	"Fully able",
	"Temporarily disabled",
	"Permanently disabled",
] as const;

const MERKZEICHEN_OPTIONS = [
	"G",
	"aG",
	"H",
	"B",
	"Bl",
	"Gl",
	"TBl",
	"RF",
	"1 Kl",
	"EB",
	"VB",
	"T",
] as const;

export const HealthSection: React.FC<SectionProps> = ({
	register,
	handleFieldBlur,
	t,
}) => {
	return (
		<div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-5 w-full">
			<h2 className="text-sm font-extrabold text-slate-950 tracking-wide uppercase mb-1">
				{t("personal.groups.health", "Gesundheit und Pflege")}
			</h2>
			<SelectField
				id="abilityToWork"
				label={t("personal.fields.abilityToWork", "Erwerbsfähigkeit")}
				register={register("abilityToWork")}
				onBlur={() => handleFieldBlur("abilityToWork")}
				placeholderText={`-- ${t("common.please_select", "Bitte auswählen")} --`}
				options={ABILITY_TO_WORK_OPTIONS.map((code) => ({
					code,
					name: t(`personal.abilityToWork.${code}`, code),
				}))}
			/>
			<FormField
				id="reducedWorkCapacityStartDate"
				label={t(
					"personal.fields.reducedWorkCapacityStartDate",
					"Beginn der Erwerbsminderung",
				)}
				type="date"
				register={register("reducedWorkCapacityStartDate")}
				onBlur={() => handleFieldBlur("reducedWorkCapacityStartDate")}
			/>
			<FormField
				id="reducedWorkCapacityEndDate"
				label={t(
					"personal.fields.reducedWorkCapacityEndDate",
					"Voraussichtliches Ende der Erwerbsminderung",
				)}
				type="date"
				register={register("reducedWorkCapacityEndDate")}
				onBlur={() => handleFieldBlur("reducedWorkCapacityEndDate")}
			/>
			<FormField
				id="reducedWorkCapacityReason"
				label={t(
					"personal.fields.reducedWorkCapacityReason",
					"Grund der Erwerbsminderung",
				)}
				register={register("reducedWorkCapacityReason")}
				onBlur={() => handleFieldBlur("reducedWorkCapacityReason")}
			/>
			<CheckboxField
				id="hasPermanentReductionInEarningCapacity"
				label={t(
					"personal.fields.hasPermanentReductionInEarningCapacity",
					"Ich habe eine dauerhafte Erwerbsminderung",
				)}
				register={register("hasPermanentReductionInEarningCapacity")}
				onBlur={() => handleFieldBlur("hasPermanentReductionInEarningCapacity")}
			/>
			<CheckboxField
				id="hasDisabilityId"
				label={t(
					"personal.fields.hasDisabilityId",
					"Ich habe einen Schwerbehindertenausweis",
				)}
				register={register("hasDisabilityId")}
				onBlur={() => handleFieldBlur("hasDisabilityId")}
			/>
			<FormField
				id="disabilityValidUntil"
				label={t("health.disability.valid_until")}
				type="date"
				register={register("disabilityValidUntil")}
				onBlur={() => handleFieldBlur("disabilityValidUntil")}
			/>
			<SelectField
				id="merkzeichen"
				label={t("personal.fields.merkzeichen", "Merkzeichen")}
				register={register("merkzeichen")}
				onBlur={() => handleFieldBlur("merkzeichen")}
				placeholderText={`-- ${t("common.please_select", "Bitte auswählen")} --`}
				options={MERKZEICHEN_OPTIONS.map((code) => ({
					code,
					name: t(`health.marks.${code}`, code),
				}))}
			/>
			<CheckboxField
				id="disabilityApplicationPending"
				label={t(
					"personal.fields.disabilityApplicationPending",
					"Der Antrag auf einen Schwerbehindertenausweis läuft noch",
				)}
				register={register("disabilityApplicationPending")}
				onBlur={() => handleFieldBlur("disabilityApplicationPending")}
			/>
			<CheckboxField
				id="hasCostlyMedicalNutrition"
				label={t(
					"personal.fields.hasCostlyMedicalNutrition",
					"Ich benötige eine kostenaufwändige Ernährung",
				)}
				register={register("hasCostlyMedicalNutrition")}
				onBlur={() => handleFieldBlur("hasCostlyMedicalNutrition")}
			/>
			<CheckboxField
				id="isCareDependent"
				label={t("health.care_dependency.title")}
				register={register("isCareDependent")}
				onBlur={() => handleFieldBlur("isCareDependent")}
			/>
			<CheckboxField
				id="hasInpatientFacilityAccommodation"
				label={t(
					"personal.fields.hasInpatientFacilityAccommodation",
					"Ich lebe in einer stationären Einrichtung",
				)}
				register={register("hasInpatientFacilityAccommodation")}
				onBlur={() => handleFieldBlur("hasInpatientFacilityAccommodation")}
			/>
			<FormField
				id="inpatientFacilityMoveInDate"
				label={t("health.inpatient_details.move_in_date")}
				type="date"
				register={register("inpatientFacilityMoveInDate")}
				onBlur={() => handleFieldBlur("inpatientFacilityMoveInDate")}
			/>
			<FormField
				id="inpatientFacilityLastResidence"
				label={t(
					"personal.fields.inpatientFacilityLastResidence",
					"Letzter Wohnort vor dem Einzug",
				)}
				register={register("inpatientFacilityLastResidence")}
				onBlur={() => handleFieldBlur("inpatientFacilityLastResidence")}
			/>
		</div>
	);
};
