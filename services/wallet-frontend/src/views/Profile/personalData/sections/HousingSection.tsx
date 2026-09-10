import React from "react";
import { FormField, SelectField, CheckboxField } from "../fields";
import { emptyStringToUndefinedNumber } from "../formDefaults";
import type { SectionProps } from "../types";

const ACCOMODATION_TYPE_OPTIONS = [
	"Rental Apartment",
	"Own Home",
	"Condominium",
	"Relative",
	"Shared Household",
] as const;

export const HousingSection: React.FC<SectionProps> = ({
	register,
	handleFieldBlur,
	t,
}) => {
	return (
		<div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-5 w-full">
			<h2 className="text-sm font-extrabold text-slate-950 tracking-wide uppercase mb-1">
				{t("personal.groups.housing", "Wohnsituation")}
			</h2>
			<SelectField
				id="accomodationType"
				label={t("personal.fields.accomodationType", "Wohnform")}
				register={register("accomodationType")}
				onBlur={() => handleFieldBlur("accomodationType")}
				placeholderText={`-- ${t("common.please_select", "Bitte auswählen")} --`}
				options={ACCOMODATION_TYPE_OPTIONS.map((code) => ({
					code,
					name: t(`personal.accomodationType.${code}`, code),
				}))}
			/>
			<SelectField
				id="tenancyStatus"
				label={t("housing.fields.tenancyStatus")}
				register={register("tenancyStatus")}
				onBlur={() => handleFieldBlur("tenancyStatus")}
				placeholderText={`-- ${t("common.please_select", "Bitte auswählen")} --`}
				options={[
					{
						code: "Main Tenant",
						name: t("housing.tenancyStatus.Main Tenant"),
					},
					{ code: "Subtenant", name: t("housing.tenancyStatus.Subtenant") },
				]}
			/>
			<FormField
				id="rentTotal"
				label={t("housing.fields.rentTotal")}
				type="number"
				register={register("rentTotal", {
					setValueAs: emptyStringToUndefinedNumber,
				})}
				onBlur={() => handleFieldBlur("rentTotal")}
			/>
			<FormField
				id="heatingCosts"
				label={t("housing.fields.heatingCosts")}
				type="number"
				register={register("heatingCosts", {
					setValueAs: emptyStringToUndefinedNumber,
				})}
				onBlur={() => handleFieldBlur("heatingCosts")}
			/>
			<FormField
				id="hotWaterCosts"
				label={t("personal.fields.hotWaterCosts", "Warmwasserkosten (€)")}
				type="number"
				register={register("hotWaterCosts", {
					setValueAs: emptyStringToUndefinedNumber,
				})}
				onBlur={() => handleFieldBlur("hotWaterCosts")}
			/>
			<FormField
				id="cableTvCosts"
				label={t("personal.fields.cableTvCosts", "Kabel-/TV-Kosten (€)")}
				type="number"
				register={register("cableTvCosts", {
					setValueAs: emptyStringToUndefinedNumber,
				})}
				onBlur={() => handleFieldBlur("cableTvCosts")}
			/>
			<FormField
				id="livingArea"
				label={t("housing.fields.livingArea")}
				type="number"
				register={register("livingArea", {
					setValueAs: emptyStringToUndefinedNumber,
				})}
				onBlur={() => handleFieldBlur("livingArea")}
			/>
			<FormField
				id="numberOfRooms"
				label={t("housing.fields.numberOfRooms")}
				type="number"
				register={register("numberOfRooms", {
					setValueAs: emptyStringToUndefinedNumber,
				})}
				onBlur={() => handleFieldBlur("numberOfRooms")}
			/>
			<FormField
				id="landlordName"
				label={t("personal.fields.landlordName", "Vermieter(in)")}
				register={register("landlordName")}
				onBlur={() => handleFieldBlur("landlordName")}
			/>
			<FormField
				id="heatingType"
				label={t("personal.fields.heatingType", "Heizungsart")}
				register={register("heatingType")}
				onBlur={() => handleFieldBlur("heatingType")}
			/>
			<FormField
				id="rentPaidUntil"
				label={t("personal.fields.rentPaidUntil", "Miete bezahlt bis")}
				type="date"
				register={register("rentPaidUntil")}
				onBlur={() => handleFieldBlur("rentPaidUntil")}
			/>
			<FormField
				id="subletRoomCount"
				label={t("personal.fields.subletRoomCount", "Untervermietete Zimmer")}
				type="number"
				register={register("subletRoomCount", {
					setValueAs: emptyStringToUndefinedNumber,
				})}
				onBlur={() => handleFieldBlur("subletRoomCount")}
			/>
			<FormField
				id="subletRentIncome"
				label={t(
					"personal.fields.subletRentIncome",
					"Einnahmen aus Untervermietung (€)",
				)}
				type="number"
				register={register("subletRentIncome", {
					setValueAs: emptyStringToUndefinedNumber,
				})}
				onBlur={() => handleFieldBlur("subletRentIncome")}
			/>
			<FormField
				id="freeHousingRightHolder"
				label={t(
					"personal.fields.freeHousingRightHolder",
					"Inhaber(in) des freien Wohnrechts",
				)}
				register={register("freeHousingRightHolder")}
				onBlur={() => handleFieldBlur("freeHousingRightHolder")}
			/>
			<CheckboxField
				id="isSubsidizedHousing"
				label={t(
					"personal.fields.isSubsidizedHousing",
					"Ich wohne in einer öffentlich geförderten Wohnung",
				)}
				register={register("isSubsidizedHousing")}
				onBlur={() => handleFieldBlur("isSubsidizedHousing")}
			/>
			<CheckboxField
				id="hasOtherResidence"
				label={t(
					"personal.fields.hasOtherResidence",
					"Ich habe eine weitere Unterkunft",
				)}
				register={register("hasOtherResidence")}
				onBlur={() => handleFieldBlur("hasOtherResidence")}
			/>
			<CheckboxField
				id="hasSecondaryResidence"
				label={t(
					"personal.fields.hasSecondaryResidence",
					"Ich habe einen Zweitwohnsitz",
				)}
				register={register("hasSecondaryResidence")}
				onBlur={() => handleFieldBlur("hasSecondaryResidence")}
			/>
			<CheckboxField
				id="hasGarageCosts"
				label={t(
					"personal.fields.hasGarageCosts",
					"Ich zahle Kosten für eine Garage/einen Stellplatz",
				)}
				register={register("hasGarageCosts")}
				onBlur={() => handleFieldBlur("hasGarageCosts")}
			/>
			<FormField
				id="garageCosts"
				label={t("personal.fields.garageCosts", "Garagenkosten (€)")}
				type="number"
				register={register("garageCosts", {
					setValueAs: emptyStringToUndefinedNumber,
				})}
				onBlur={() => handleFieldBlur("garageCosts")}
			/>
			<CheckboxField
				id="hasHouseholdEnergyCosts"
				label={t(
					"personal.fields.hasHouseholdEnergyCosts",
					"Ich zahle Haushaltsenergiekosten",
				)}
				register={register("hasHouseholdEnergyCosts")}
				onBlur={() => handleFieldBlur("hasHouseholdEnergyCosts")}
			/>
			<FormField
				id="householdEnergyCosts"
				label={t(
					"personal.fields.householdEnergyCosts",
					"Haushaltsenergiekosten (€)",
				)}
				type="number"
				register={register("householdEnergyCosts", {
					setValueAs: emptyStringToUndefinedNumber,
				})}
				onBlur={() => handleFieldBlur("householdEnergyCosts")}
			/>
			<CheckboxField
				id="isLivingAreaUsedCommercially"
				label={t(
					"personal.fields.isLivingAreaUsedCommercially",
					"Ein Teil der Wohnfläche wird gewerblich genutzt",
				)}
				register={register("isLivingAreaUsedCommercially")}
				onBlur={() => handleFieldBlur("isLivingAreaUsedCommercially")}
			/>
			<FormField
				id="commerciallyUsedAreaSqm"
				label={t(
					"personal.fields.commerciallyUsedAreaSqm",
					"Gewerblich genutzte Fläche (m²)",
				)}
				type="number"
				register={register("commerciallyUsedAreaSqm", {
					setValueAs: emptyStringToUndefinedNumber,
				})}
				onBlur={() => handleFieldBlur("commerciallyUsedAreaSqm")}
			/>
		</div>
	);
};
