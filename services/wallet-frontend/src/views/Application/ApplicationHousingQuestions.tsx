import React, { useEffect, useState, useRef } from "react";
/* eslint-disable complexity */
import { useNavigate, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import type { UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { useProfile } from "../../hooks/useProfile";
import type { Profile } from "../../schemas/profile.schema";
import {
	AlertCircle,
	CheckCircle2,
	Loader2,
	Pencil,
	Calendar,
} from "lucide-react";
import { AppRoutes } from "../../constants/routes";
import { PageContainer } from "../../components/Layout/PageContainer";
import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { useScrollToTop, scrollToTop } from "../../utils/scroll";
import { OptionCard as SharedOptionCard } from "../../components/ui/OptionCard";

const OptionCard: React.FC<{
	id: string;
	title: string;
	hinweis?: string;
	selected: boolean;
	onClick: () => void;
}> = (props) => (
	<SharedOptionCard {...props} dataTestId={`housing-option-${props.id}`} />
);

interface FieldProps {
	id: string;
	label: string;
	type?: string;
	placeholder?: string;
	register: UseFormRegisterReturn;
	onBlur?: () => void;
	error?: string;
}

const FormField: React.FC<FieldProps> = ({
	id,
	label,
	type = "text",
	placeholder,
	register,
	onBlur,
	error,
}) => {
	return (
		<div className="flex flex-col gap-1 text-left relative pb-3 border-b border-slate-100 last:border-b-0 focus-within:border-primary-green-300 transition-all">
			<label
				htmlFor={id}
				className="text-xs font-bold text-slate-600 uppercase tracking-wide"
			>
				{label}
			</label>
			<div className="relative flex items-center w-full mt-0.5">
				<input
					id={id}
					type={type}
					placeholder={placeholder}
					{...register}
					onChange={(e) => {
						if (type === "number") {
							e.target.value = e.target.value.replace(/[^0-9.,]/g, "");
						}
						void register.onChange(e);
					}}
					onBlur={(e) => {
						void register.onBlur(e);
						onBlur?.();
					}}
					data-testid={`field-${id}-input`}
					className="w-full pr-14 bg-transparent border-none focus:outline-none font-bold text-slate-900 text-base placeholder:font-normal placeholder:text-brand-grey"
				/>
				<button
					type="button"
					aria-label={`${label} bearbeiten`}
					onClick={() => document.getElementById(id)?.focus()}
					className="absolute right-0 min-w-[44px] min-h-[44px] size-11 bg-slate-50 border border-slate-200 rounded-full flex items-center justify-center text-slate-600 hover:text-slate-900 hover:border-slate-300 cursor-pointer transition-all active:scale-95 shadow-sm shrink-0 focus-visible:outline-2 focus-visible:outline-brand-primary"
				>
					<Pencil className="size-4" />
				</button>
			</div>
			{error && (
				<span className="text-xs text-rose-600 font-medium mt-1">{error}</span>
			)}
		</div>
	);
};

const CombinedFormSchema = z.object({
	street: z.string().optional().nullable(),
	houseNumber: z.string().optional().nullable(),
	zipCode: z.string().optional().nullable(),
	city: z.string().optional().nullable(),
	noFixedAddress: z.boolean().optional(),
	lastFixedAddress: z.string().optional().nullable(),
	accomodationType: z.string().optional(),
	tenancyStatus: z.string().optional().nullable(),
	landlordName: z.string().optional().nullable(),
	freeHousingRightHolder: z.string().optional().nullable(),
	subletRoomCount: z.number().optional().nullable(),
	subletRentIncome: z.number().optional().nullable(),
	rentPaidUntil: z.string().optional().nullable(),
	rentTotal: z.number().optional().nullable(),
	heatingCosts: z.number().optional().nullable(),
	hotWaterCosts: z.number().optional().nullable(),
	cableTvCosts: z.number().optional().nullable(),
	livingArea: z.number().optional().nullable(),
	numberOfRooms: z.number().optional().nullable(),
	heatingType: z.string().optional().nullable(),
});
type FormState = z.infer<typeof CombinedFormSchema>;

export const ApplicationHousingQuestions: React.FC = () => {
	const { t } = useTranslation(["profile", "common"]);
	const navigate = useNavigate();
	const location = useLocation();
	const { profileData, updateSection, isUpdating, refetch, isLoading } =
		useProfile();

	const [currentPage, setCurrentPage] = useState<number>(1);
	const [saveSuccess, setSaveSuccess] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);
	const isInitializedRef = useRef(false);

	useScrollToTop([currentPage]);

	const { register, reset, setValue, getValues, watch } = useForm<FormState>({
		resolver: zodResolver(CombinedFormSchema),
		mode: "onBlur",
		defaultValues: {
			street: "",
			houseNumber: "",
			zipCode: "",
			city: "",
			noFixedAddress: false,
			lastFixedAddress: "",
			accomodationType: "Rental Apartment",
			tenancyStatus: "Main Tenant",
			landlordName: "",
			freeHousingRightHolder: "",
			subletRoomCount: null,
			subletRentIncome: null,
			rentPaidUntil: "",
			rentTotal: null,
			heatingCosts: null,
			hotWaterCosts: null,
			cableTvCosts: null,
			livingArea: null,
			numberOfRooms: null,
			heatingType: "",
		},
	});

	// Check route state for document-extracted initial values
	useEffect(() => {
		const state = location.state as {
			extractedData?: Record<string, string | number | null>;
		} | null;
		const extracted = state?.extractedData;
		if (extracted && !isInitializedRef.current) {
			if (extracted.rent_total) {
				setValue("rentTotal", Number(extracted.rent_total));
			}
			if (extracted.heating_costs) {
				setValue("heatingCosts", Number(extracted.heating_costs));
			}
			if (extracted.living_area) {
				setValue("livingArea", Number(extracted.living_area));
			}
			if (extracted.number_of_rooms) {
				setValue("numberOfRooms", Number(extracted.number_of_rooms));
			}
			if (extracted.landlord_name) {
				setValue("landlordName", String(extracted.landlord_name));
			}
			if (extracted.cable_tv_costs) {
				setValue("cableTvCosts", Number(extracted.cable_tv_costs));
			}
			if (extracted.hot_water_costs) {
				setValue("hotWaterCosts", Number(extracted.hot_water_costs));
			}
			if (extracted.heating_type) {
				setValue("heatingType", String(extracted.heating_type));
			}
			if (extracted.accomodation_type) {
				setValue("accomodationType", String(extracted.accomodation_type));
			}
			if (extracted.tenancy_status) {
				setValue("tenancyStatus", String(extracted.tenancy_status));
			}
		}
	}, [location.state, setValue]);

	// Initialize values from profile store db
	useEffect(() => {
		if (profileData && !isInitializedRef.current) {
			const hasNoFixed = profileData.address?.street === "ohne feste Adresse";
			reset({
				street: hasNoFixed ? "" : (profileData.address?.street ?? ""),
				houseNumber: profileData.address?.houseNumber ?? "",
				zipCode: profileData.address?.zipCode ?? "",
				city: profileData.address?.city ?? "",
				noFixedAddress: hasNoFixed,
				lastFixedAddress: profileData.address?.state ?? "", // Map lastFixedAddress to state

				accomodationType:
					profileData.housing?.accomodationType ?? "Rental Apartment",
				tenancyStatus: profileData.housing?.tenancyStatus ?? "Main Tenant",
				landlordName: profileData.housing?.landlordName ?? "",
				freeHousingRightHolder:
					profileData.housing?.freeHousingRightHolder ?? "",
				subletRoomCount: profileData.housing?.subletRoomCount ?? null,
				subletRentIncome: profileData.housing?.subletRentIncome ?? null,
				rentPaidUntil: profileData.housing?.rentPaidUntil ?? "",
				rentTotal: profileData.housing?.rentTotal ?? null,
				heatingCosts: profileData.housing?.heatingCosts ?? null,
				hotWaterCosts: profileData.housing?.hotWaterCosts ?? null,
				cableTvCosts: profileData.housing?.cableTvCosts ?? null,
				livingArea: profileData.housing?.livingArea ?? null,
				numberOfRooms: profileData.housing?.numberOfRooms ?? null,
				heatingType: profileData.housing?.heatingType ?? "",
			});
			isInitializedRef.current = true;
		}
	}, [profileData, reset]);

	// Keep data fresh
	useEffect(() => {
		void refetch();
	}, [refetch]);

	const values = watch();

	// Navigation flow state machine
	const getNextPage = (page: number, currentValues: FormState): number => {
		if (page === 1) {
			return currentValues.noFixedAddress ? 1.5 : 2;
		}
		if (page === 1.5) {
			return 2;
		}
		if (page === 2) {
			if (currentValues.accomodationType === "Rental Apartment") {
				return 3;
			}
			if (currentValues.accomodationType === "Own Home") {
				return 4;
			}
			return 9; // Skip pages
		}
		if (page === 3) {
			if (currentValues.tenancyStatus === "Main Tenant") {
				return 4;
			}
			if (currentValues.tenancyStatus === "Subtenant") {
				return 5;
			}
			return 9; // Exit for Free lodging
		}
		if (page === 4) {
			if (currentValues.accomodationType === "Own Home") {
				return 6;
			} // Bypass Page 5 (Arrears) for Homeowners
			return 5;
		}
		if (page === 5) {
			return 6;
		}
		if (page === 6) {
			return 7;
		}
		if (page === 7) {
			return 8;
		}
		return 9;
	};

	const getPreviousPage = (page: number, currentValues: FormState): number => {
		if (page === 8) {
			return 7;
		}
		if (page === 7) {
			return 6;
		}
		if (page === 6) {
			if (currentValues.accomodationType === "Own Home") {
				return 4;
			}
			return 5;
		}
		if (page === 5) {
			if (
				currentValues.accomodationType === "Rental Apartment" &&
				currentValues.tenancyStatus === "Main Tenant"
			) {
				return 4;
			}
			return 3;
		}
		if (page === 4) {
			if (currentValues.accomodationType === "Own Home") {
				return 2;
			}
			return 3;
		}
		if (page === 3) {
			return 2;
		}
		if (page === 2) {
			return currentValues.noFixedAddress ? 1.5 : 1;
		}
		if (page === 1.5) {
			return 1;
		}
		return 0; // Exit to overview
	};

	const totalPages = 8;
	const calculatedProgress = currentPage > 1.5 ? Math.floor(currentPage) : 1;

	const handleSaveField = async (
		_section: "address" | "housing",
		_key: string,
		_val: string | number | boolean | null | undefined,
	) => {
		// Stub out auto-saving on blur. All saving is handled on page transitions in savePageData.
	};

	const savePageData = async (
		page: number,
		currentValues: FormState,
	): Promise<{ success: boolean; message?: string }> => {
		if (page === 1) {
			if (currentValues.noFixedAddress) {
				return await updateSection({
					section: "address",
					data: {
						street: "ohne feste Adresse",
						houseNumber: "",
						zipCode: "",
						city: "",
						state: currentValues.lastFixedAddress || "",
						validateEntireForm: false,
					},
				});
			}
			return await updateSection({
				section: "address",
				data: {
					street: currentValues.street || "",
					houseNumber: currentValues.houseNumber || "",
					zipCode: currentValues.zipCode || "",
					city: currentValues.city || "",
					state: "Berlin",
					validateEntireForm: false,
				},
			});
		}

		if (page === 1.5) {
			return await updateSection({
				section: "address",
				data: {
					state: currentValues.lastFixedAddress || "",
					validateEntireForm: false,
				},
			});
		}

		const housingData: Partial<Profile["housing"]> & {
			validateEntireForm: boolean;
		} = { validateEntireForm: false };

		if (page === 2) {
			housingData.accomodationType =
				currentValues.accomodationType as Profile["housing"]["accomodationType"];
		} else if (page === 3) {
			housingData.tenancyStatus =
				currentValues.tenancyStatus as Profile["housing"]["tenancyStatus"];
			if (
				currentValues.tenancyStatus === "Main Tenant" ||
				currentValues.tenancyStatus === "Subtenant"
			) {
				housingData.landlordName = currentValues.landlordName || "";
				housingData.freeHousingRightHolder = "";
			} else if (
				currentValues.tenancyStatus === null &&
				currentValues.freeHousingRightHolder === "Ja"
			) {
				housingData.landlordName = "";
				housingData.freeHousingRightHolder = "Ja";
			} else {
				housingData.landlordName = "";
				housingData.freeHousingRightHolder = "";
			}
		} else if (page === 4) {
			housingData.subletRoomCount = currentValues.subletRoomCount;
			housingData.subletRentIncome = currentValues.subletRentIncome;
		} else if (page === 5) {
			housingData.rentPaidUntil = currentValues.rentPaidUntil;
		} else if (page === 6) {
			housingData.rentTotal = currentValues.rentTotal;
			housingData.heatingCosts = currentValues.heatingCosts;
			housingData.hotWaterCosts = currentValues.hotWaterCosts;
			housingData.cableTvCosts = currentValues.cableTvCosts;
		} else if (page === 7) {
			housingData.livingArea = currentValues.livingArea;
			housingData.numberOfRooms = currentValues.numberOfRooms;
		} else if (page === 8) {
			housingData.heatingType = currentValues.heatingType;
		}

		if (Object.keys(housingData).length > 1) {
			return await updateSection({
				section: "housing",
				data: housingData,
			});
		}

		return { success: true };
	};

	const onNextPage = async () => {
		const currentValues = getValues();
		const result = await savePageData(currentPage, currentValues);

		if (!result.success) {
			setSaveError(result.message || t("errors.save_failed"));
			scrollToTop("smooth");
			return;
		}
		setSaveError(null);
		setSaveSuccess(true);
		setTimeout(() => setSaveSuccess(false), 1500);

		const next = getNextPage(currentPage, currentValues);
		if (next >= 9) {
			navigate(AppRoutes.ApplicationHouseholdQuestions);
		} else {
			setCurrentPage(next);
		}
	};

	const onPreviousPage = async () => {
		const currentValues = getValues();
		const result = await savePageData(currentPage, currentValues);

		if (!result.success) {
			setSaveError(result.message || t("errors.save_failed"));
			scrollToTop("smooth");
			return;
		}
		setSaveError(null);

		const prev = getPreviousPage(currentPage, currentValues);
		if (prev <= 0) {
			navigate(AppRoutes.ApplicationOverview);
		} else {
			setCurrentPage(prev);
		}
	};

	// Page renderer sections
	const renderPageContent = () => {
		switch (currentPage) {
			case 1:
				return (
					<div className="w-full max-w-md flex flex-col gap-5 animate-fadeIn">
						<div className="text-left flex flex-col gap-2 px-1">
							<h1 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">
								{t(
									"housing.questions.address_title",
									"Wie lautet Deine aktuelle Wohnadresse?",
								)}
							</h1>
						</div>

						<div className="flex flex-col gap-4 bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
							<div className="flex flex-row items-center gap-3 pb-3 border-b border-slate-100">
								<input
									id="noFixedAddress"
									type="checkbox"
									{...register("noFixedAddress")}
									onChange={(e) => {
										setValue("noFixedAddress", e.target.checked);
										void handleSaveField(
											"address",
											"street",
											e.target.checked ? "ohne feste Adresse" : "",
										);
									}}
									className="size-5 rounded border-slate-300 text-primary-green-600 focus:ring-primary-green-500"
								/>
								<label
									htmlFor="noFixedAddress"
									className="text-sm font-bold text-slate-700"
								>
									{t(
										"housing.labels.no_fixed_address",
										"Ich habe aktuell keine feste Adresse",
									)}
								</label>
							</div>

							{!values.noFixedAddress && (
								<>
									<FormField
										id="street"
										label={t("housing.labels.street", "Straße")}
										register={register("street")}
										onBlur={() =>
											handleSaveField(
												"address",
												"street",
												getValues("street") ?? null,
											)
										}
									/>
									<FormField
										id="houseNumber"
										label={t("housing.labels.houseNumber", "Hausnummer")}
										register={register("houseNumber")}
										onBlur={() =>
											handleSaveField(
												"address",
												"houseNumber",
												getValues("houseNumber") ?? null,
											)
										}
									/>
									<FormField
										id="zipCode"
										label={t("housing.labels.zipCode", "Postleitzahl")}
										register={register("zipCode")}
										onBlur={() =>
											handleSaveField(
												"address",
												"zipCode",
												getValues("zipCode") ?? null,
											)
										}
									/>
									<FormField
										id="city"
										label={t("housing.labels.city", "Stadt")}
										register={register("city")}
										onBlur={() =>
											handleSaveField(
												"address",
												"city",
												getValues("city") ?? null,
											)
										}
									/>
								</>
							)}
						</div>
					</div>
				);

			case 1.5:
				return (
					<div className="w-full max-w-md flex flex-col gap-5 animate-fadeIn">
						<div className="text-left flex flex-col gap-2 px-1">
							<h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
								{t(
									"housing.questions.last_fixed_address_title",
									"Wo hast Du zuletzt fest gewohnt?",
								)}
							</h1>
						</div>

						<div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
							<FormField
								id="lastFixedAddress"
								label={t(
									"housing.labels.last_fixed_address",
									"Letzter fester Wohnort",
								)}
								register={register("lastFixedAddress")}
								onBlur={() =>
									handleSaveField(
										"address",
										"state",
										getValues("lastFixedAddress") ?? null,
									)
								}
							/>
						</div>
					</div>
				);

			case 2:
				return (
					<div className="w-full max-w-md flex flex-col gap-5 animate-fadeIn">
						<div className="text-left flex flex-col gap-2 px-1">
							<h1 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">
								{t(
									"housing.questions.accomodation_type_title",
									"Wie wohnst Du zurzeit?",
								)}
							</h1>
						</div>

						<div className="flex flex-col gap-4">
							<OptionCard
								id="Rental Apartment"
								title={t(
									"housing.options.accomodation_rental",
									"Ich lebe in einer Mietwohnung",
								)}
								selected={values.accomodationType === "Rental Apartment"}
								onClick={() => {
									setValue("accomodationType", "Rental Apartment");
									void handleSaveField(
										"housing",
										"accomodationType",
										"Rental Apartment",
									);
								}}
							/>
							<OptionCard
								id="Own Home"
								title={t(
									"housing.options.accomodation_own",
									"Ich lebe in meinem Eigenheim / Eigentumswohnung",
								)}
								selected={values.accomodationType === "Own Home"}
								onClick={() => {
									setValue("accomodationType", "Own Home");
									void handleSaveField(
										"housing",
										"accomodationType",
										"Own Home",
									);
								}}
							/>
							<OptionCard
								id="Shared Household"
								title={t(
									"housing.options.accomodation_care",
									"Ich wohne in einer Pflegeeinrichtung",
								)}
								selected={values.accomodationType === "Shared Household"}
								onClick={() => {
									setValue("accomodationType", "Shared Household");
									void handleSaveField(
										"housing",
										"accomodationType",
										"Shared Household",
									);
								}}
							/>
							<OptionCard
								id="Relative"
								title={t(
									"housing.options.accomodation_relative",
									"Ich lebe bei Verwandten / Bekannten",
								)}
								selected={values.accomodationType === "Relative"}
								onClick={() => {
									setValue("accomodationType", "Relative");
									void handleSaveField(
										"housing",
										"accomodationType",
										"Relative",
									);
								}}
							/>
						</div>
					</div>
				);

			case 3:
				return (
					<div className="w-full max-w-md flex flex-col gap-5 animate-fadeIn">
						<div className="text-left flex flex-col gap-2 px-1">
							<h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
								{t(
									"housing.questions.tenancy_status_title",
									"Bist Du Haupt- oder Untermieter?",
								)}
							</h1>
						</div>

						<div className="flex flex-col gap-4">
							<OptionCard
								id="Main Tenant"
								title={t("housing.options.tenancy_main", "Ich bin Hauptmieter")}
								selected={values.tenancyStatus === "Main Tenant"}
								onClick={() => {
									setValue("tenancyStatus", "Main Tenant");
									void handleSaveField(
										"housing",
										"tenancyStatus",
										"Main Tenant",
									);
								}}
							/>
							<OptionCard
								id="Subtenant"
								title={t("housing.options.tenancy_sub", "Ich bin Untermieter")}
								selected={values.tenancyStatus === "Subtenant"}
								onClick={() => {
									setValue("tenancyStatus", "Subtenant");
									void handleSaveField("housing", "tenancyStatus", "Subtenant");
								}}
							/>
							<OptionCard
								id="FreeLodging"
								title={t(
									"housing.options.tenancy_free",
									"Ich habe freies Wohnrecht",
								)}
								selected={
									values.tenancyStatus === null &&
									!!values.freeHousingRightHolder
								}
								onClick={() => {
									setValue("tenancyStatus", null);
									setValue("freeHousingRightHolder", "Ja");
									void handleSaveField("housing", "tenancyStatus", null);
									void handleSaveField(
										"housing",
										"freeHousingRightHolder",
										"Ja",
									);
								}}
							/>

							{values.tenancyStatus === "Subtenant" && (
								<div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm mt-2 animate-fadeIn">
									<FormField
										id="landlordName"
										label={t(
											"housing.labels.landlord_name",
											"Name des Vermieters",
										)}
										register={register("landlordName")}
										onBlur={() =>
											handleSaveField(
												"housing",
												"landlordName",
												getValues("landlordName"),
											)
										}
									/>
								</div>
							)}

							{values.tenancyStatus === null &&
								!!values.freeHousingRightHolder && (
									<div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm mt-2 animate-fadeIn">
										<FormField
											id="freeHousingRightHolder"
											label={t(
												"housing.labels.free_housing_right_holder",
												"Freies Wohnrecht bei (Name der Person)",
											)}
											register={register("freeHousingRightHolder")}
											onBlur={() =>
												handleSaveField(
													"housing",
													"freeHousingRightHolder",
													getValues("freeHousingRightHolder"),
												)
											}
										/>
									</div>
								)}
						</div>
					</div>
				);

			case 4: {
				const isJaSublet = (values.subletRoomCount ?? 0) > 0;
				return (
					<div className="w-full max-w-md flex flex-col gap-5 animate-fadeIn">
						<div className="text-left flex flex-col gap-2 px-1">
							<h1 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">
								{t(
									"housing.questions.sublet_title",
									"Vermietest Du Zimmer unter?",
								)}
							</h1>
						</div>

						<div className="flex flex-col gap-4">
							<OptionCard
								id="sublet-no"
								title={t("common.no", "Nein")}
								selected={
									values.subletRoomCount === null ||
									values.subletRoomCount === 0
								}
								onClick={() => {
									setValue("subletRoomCount", 0);
									void handleSaveField("housing", "subletRoomCount", 0);
								}}
							/>
							<OptionCard
								id="sublet-yes"
								title={t("common.yes", "Ja")}
								selected={isJaSublet}
								onClick={() => {
									setValue("subletRoomCount", 1);
									void handleSaveField("housing", "subletRoomCount", 1);
								}}
							/>

							{isJaSublet && (
								<div className="px-1 animate-fadeIn">
									<FormField
										id="subletRoomCount"
										label={t(
											"housing.labels.sublet_room_count",
											"Wie viele Zimmer vermietest Du unter?",
										)}
										type="number"
										register={register("subletRoomCount", {
											valueAsNumber: true,
										})}
										onBlur={() =>
											handleSaveField(
												"housing",
												"subletRoomCount",
												getValues("subletRoomCount"),
											)
										}
									/>
									<FormField
										id="subletRentIncome"
										label={t(
											"housing.labels.sublet_rent_income",
											"Miete (Warm) in EUR",
										)}
										type="number"
										register={register("subletRentIncome", {
											valueAsNumber: true,
										})}
										onBlur={() =>
											handleSaveField(
												"housing",
												"subletRentIncome",
												getValues("subletRentIncome"),
											)
										}
									/>
								</div>
							)}
						</div>
					</div>
				);
			}

			case 5: {
				const isArrears = !!values.rentPaidUntil;
				return (
					<div className="w-full max-w-md flex flex-col gap-5 animate-fadeIn">
						<div className="text-left flex flex-col gap-2 px-1">
							<h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
								{t(
									"housing.questions.arrears_title",
									"Hast Du Mietrückstände?",
								)}
							</h1>
						</div>

						<div className="flex flex-col gap-4">
							<OptionCard
								id="arrears-no"
								title={t("common.no", "Nein")}
								selected={!isArrears}
								onClick={() => {
									setValue("rentPaidUntil", null);
									void handleSaveField("housing", "rentPaidUntil", null);
								}}
							/>
							<OptionCard
								id="arrears-yes"
								title={t("common.yes", "Ja")}
								selected={isArrears}
								onClick={() => {
									const today = new Date().toISOString().split("T")[0];
									setValue("rentPaidUntil", today);
									void handleSaveField("housing", "rentPaidUntil", today);
								}}
							/>

							{isArrears && (
								<div className="flex flex-col gap-4 px-1 animate-fadeIn">
									<div className="flex flex-col gap-1.5">
										<label
											htmlFor="rentPaidUntil"
											className="text-sm font-semibold text-slate-700 text-left flex items-center gap-1.5"
										>
											<Calendar className="size-4 text-slate-500" />
											{t(
												"housing.labels.rent_paid_until",
												"Miete gezahlt bis (Datum)",
											)}
										</label>
										<input
											id="rentPaidUntil"
											type="date"
											className="w-full h-12 px-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 text-left"
											{...register("rentPaidUntil")}
											onBlur={() =>
												handleSaveField(
													"housing",
													"rentPaidUntil",
													getValues("rentPaidUntil"),
												)
											}
										/>
									</div>
								</div>
							)}
						</div>
					</div>
				);
			}

			case 6:
				return (
					<div className="w-full max-w-md flex flex-col gap-5 animate-fadeIn">
						<div className="text-left flex flex-col gap-2 px-1">
							<h1 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">
								{t(
									"housing.questions.costs_title",
									"Wie hoch sind Deine monatlichen Wohnkosten?",
								)}
							</h1>
						</div>

						<div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-4">
							<FormField
								id="rentTotal"
								label={t(
									"housing.labels.rent_total",
									"Miete insgesamt (Warmmiete) in EUR",
								)}
								type="number"
								register={register("rentTotal", { valueAsNumber: true })}
								onBlur={() =>
									handleSaveField(
										"housing",
										"rentTotal",
										getValues("rentTotal"),
									)
								}
							/>
							<FormField
								id="heatingCosts"
								label={t("housing.labels.heating_costs", "Heizkosten (€)")}
								type="number"
								register={register("heatingCosts", { valueAsNumber: true })}
								onBlur={() =>
									handleSaveField(
										"housing",
										"heatingCosts",
										getValues("heatingCosts"),
									)
								}
							/>
							<FormField
								id="hotWaterCosts"
								label={t(
									"housing.labels.hot_water_costs",
									"Warmwasserkosten (€)",
								)}
								type="number"
								register={register("hotWaterCosts", { valueAsNumber: true })}
								onBlur={() =>
									handleSaveField(
										"housing",
										"hotWaterCosts",
										getValues("hotWaterCosts"),
									)
								}
							/>
							<FormField
								id="cableTvCosts"
								label={t("housing.labels.cable_tv_costs", "Kabelfernsehen (€)")}
								type="number"
								register={register("cableTvCosts", { valueAsNumber: true })}
								onBlur={() =>
									handleSaveField(
										"housing",
										"cableTvCosts",
										getValues("cableTvCosts"),
									)
								}
							/>
						</div>
					</div>
				);

			case 7:
				return (
					<div className="w-full max-w-md flex flex-col gap-5 animate-fadeIn">
						<div className="text-left flex flex-col gap-2 px-1">
							<h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
								{t(
									"housing.questions.size_title",
									"Wie groß ist Deine Wohnung/Haus?",
								)}
							</h1>
						</div>

						<div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-4">
							<FormField
								id="livingArea"
								label={t(
									"housing.labels.living_area",
									"Fläche in Quadratmetern",
								)}
								type="number"
								register={register("livingArea", { valueAsNumber: true })}
								onBlur={() =>
									handleSaveField(
										"housing",
										"livingArea",
										getValues("livingArea"),
									)
								}
							/>
							<FormField
								id="numberOfRooms"
								label={t(
									"housing.labels.number_of_rooms",
									"Anzahl der Räume (ohne Küche/Bad)",
								)}
								type="number"
								register={register("numberOfRooms", { valueAsNumber: true })}
								onBlur={() =>
									handleSaveField(
										"housing",
										"numberOfRooms",
										getValues("numberOfRooms"),
									)
								}
							/>
						</div>
					</div>
				);

			case 8: {
				const heatingTypes = [
					"Sammelheizung",
					"Zentrale Warmwasserversorgung",
					"Gasheizung",
					"Nachtstromspeicher",
					"Ofenheizung",
				];
				const heatingTypeKeys: Record<string, string> = {
					Sammelheizung: "heating_sammelheizung",
					"Zentrale Warmwasserversorgung": "heating_warmwasser",
					Gasheizung: "heating_gasheizung",
					Nachtstromspeicher: "heating_nachtstrom",
					Ofenheizung: "heating_ofenheizung",
				};
				return (
					<div className="w-full max-w-md flex flex-col gap-5 animate-fadeIn">
						<div className="text-left flex flex-col gap-2 px-1">
							<h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
								{t(
									"housing.questions.heating_type_title",
									"Wie wird Deine Wohnung beheizt?",
								)}
							</h1>
						</div>

						<div className="flex flex-col gap-4">
							{heatingTypes.map((ht) => (
								<OptionCard
									key={ht}
									id={`heating-${ht}`}
									title={t(`housing.options.${heatingTypeKeys[ht]}`, ht)}
									selected={values.heatingType === ht}
									onClick={() => {
										setValue("heatingType", ht);
										void handleSaveField("housing", "heatingType", ht);
									}}
								/>
							))}
						</div>
					</div>
				);
			}

			default:
				return null;
		}
	};

	// Standard Rule 8.14 Centered Loader Spinner during Initial Fetching
	if (isLoading && !profileData) {
		return (
			<PageContainer>
				<div className="flex items-center justify-center min-h-[50vh]">
					<Loader2 className="w-8 h-8 animate-spin text-slate-500" />
				</div>
			</PageContainer>
		);
	}

	return (
		<PageContainer
			topBarProps={{ onBack: onPreviousPage, showLanguageSwitcher: true }}
		>
			{(isUpdating || saveSuccess) && (
				<div
					role="status"
					className="fixed top-6 z-50 flex items-center gap-2.5 bg-white px-5 py-2.5 rounded-full shadow-xl border border-slate-100"
				>
					{isUpdating ? (
						<>
							<Loader2 className="w-4 h-4 animate-spin text-slate-800" />
							<span className="text-xs font-bold text-slate-800">
								{t("personal.actions.saving", "Speichern...")}
							</span>
						</>
					) : (
						<>
							<CheckCircle2 className="w-4 h-4 text-green-600" />
							<span className="text-xs font-bold text-slate-800">
								{t("personal.actions.saved", "Gespeichert")}
							</span>
						</>
					)}
				</div>
			)}

			<ProgressBar
				current={calculatedProgress}
				total={totalPages}
				colorVariant="green"
				ariaLabel={t("common:step_page", {
					current: calculatedProgress,
					total: totalPages,
					defaultValue: `${calculatedProgress} von ${totalPages} Seiten`,
				})}
			/>
			<div className="w-full max-w-md flex flex-col gap-1.5 mb-6 -mt-4">
				<div className="text-left text-[10px] font-bold text-slate-600 tracking-wider uppercase">
					{t("common:step_page", {
						current: calculatedProgress,
						total: totalPages,
						defaultValue: `${calculatedProgress} von ${totalPages} Seiten`,
					})}
				</div>
			</div>

			{saveError && (
				<div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-900 font-medium w-full max-w-md mb-4 text-sm">
					<AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />
					<p>{saveError}</p>
				</div>
			)}

			{renderPageContent()}

			<div className="pt-6 w-full max-w-md">
				<PrimaryButton
					data-testid="next-button"
					type="button"
					onClick={onNextPage}
				>
					{currentPage >= 8
						? t("common.done", "Geschafft!")
						: t("common.save_and_continue", "Speichern und weiter")}
				</PrimaryButton>
			</div>
		</PageContainer>
	);
};
