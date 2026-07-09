import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useProfile } from "../../hooks/useProfile";
import { useAutoVerification } from "../../hooks/useAutoVerification";
import {
	AlertCircle,
	CheckCircle2,
	Loader2,
	User,
	MapPin,
	Calendar,
	Home,
} from "lucide-react";
import { AppRoutes } from "../../constants/routes";
import { COUNTRY_OPTIONS } from "../../constants/countries";
import { PageContainer } from "../../components/Layout/PageContainer";
import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { OptionCard as SharedOptionCard } from "../../components/ui/OptionCard";

const OptionCard: React.FC<React.ComponentProps<typeof SharedOptionCard>> = (
	props,
) => <SharedOptionCard {...props} dataTestId={`about-me-option-${props.id}`} />;
import { useScrollToTop, scrollToTop } from "../../utils/scroll";
import type {
	Profile,
	PersonalData,
	Address,
	GenderType,
	WalletDocument,
} from "../../schemas/profile.schema";
import type { ProfileResponse } from "../../services/profile/IProfileService";
import {
	parseAddressString,
	mapBackendDocTypeToSlotId,
} from "../../utils/profile";
import { authenticatedFetch } from "../../utils/apiClient";
import { env } from "../../config/env.config";

const GERMAN_COUNTRY_NAMES: Record<string, string> = {
	DE: "Deutschland",
	FR: "Frankreich",
	AT: "Österreich",
	CH: "Schweiz",
	PL: "Polen",
	CZ: "Tschechische Republik",
	NL: "Niederlande",
	GB: "Vereinigtes Königreich",
	UA: "Ukraine",
	TR: "Türkei",
	US: "Vereinigte Staaten",
	CA: "Kanada",
	PT: "Portugal",
};

const parseOcrGender = (
	gender?: string | null,
	sex?: string | null,
	legalGender?: string | null,
): string => {
	const ocrGender = gender || sex || legalGender || "";
	if (typeof ocrGender === "string" && ocrGender) {
		const lowerGender = ocrGender.toLowerCase();
		if (
			lowerGender === "m" ||
			lowerGender === "male" ||
			lowerGender === "männlich"
		) {
			return "Male";
		}
		if (
			lowerGender === "f" ||
			lowerGender === "female" ||
			lowerGender === "weiblich"
		) {
			return "Female";
		}
		if (
			lowerGender === "d" ||
			lowerGender === "diverse" ||
			lowerGender === "divers"
		) {
			return "Diverse";
		}
	}
	return "";
};

interface ParsedOcrAddress {
	street: string;
	houseNumber: string;
	zipCode: string;
	city: string;
}

const parseOcrAddress = (
	extracted: Record<string, string | null | undefined>,
): ParsedOcrAddress => {
	let street = extracted.street || extracted.street_name || "";
	let houseNumber = extracted.house_number || "";
	let zipCode = extracted.zip_code || extracted.postal_code || "";
	let city = extracted.city || "";

	if (extracted.address && !street && !zipCode) {
		const parsedAddr = parseAddressString(extracted.address);
		street = parsedAddr.street;
		houseNumber = parsedAddr.houseNumber;
		zipCode = parsedAddr.zipCode;
		city = parsedAddr.city;
	}

	return { street, houseNumber, zipCode, city };
};

const checkIsGerman = (
	nationality?: string | null,
	placeOfBirth?: string | null,
	ocrPlaceOfBirth?: string | null,
): boolean => {
	if (typeof nationality === "string" && nationality) {
		const lowerNat = nationality.toLowerCase().trim();
		if (lowerNat === "de" || lowerNat === "deutsch" || lowerNat === "german") {
			return true;
		}
	}

	const currentPlaceOfBirth = String(placeOfBirth || ocrPlaceOfBirth || "");
	if (
		currentPlaceOfBirth &&
		currentPlaceOfBirth !== "undefined" &&
		currentPlaceOfBirth !== "null"
	) {
		const lowerPlace = currentPlaceOfBirth.toLowerCase();
		if (
			lowerPlace.includes("berlin") ||
			lowerPlace.includes("deutschland") ||
			lowerPlace.includes("germany")
		) {
			return true;
		}
	}
	return false;
};

const getCorrectedDob = (
	personalDob?: string | null,
	ocrDob?: string | null,
): string => {
	let dobVal = personalDob || ocrDob || "";
	if (dobVal && /^\d{2}\.\d{2}\.\d{4}$/.test(dobVal)) {
		const parts = dobVal.split(".");
		dobVal = `${parts[2]}-${parts[1]}-${parts[0]}`;
	}
	return dobVal;
};

const getIsGermanCitizen = (
	personalIsGermanCitizen?: boolean | null,
	ocrIsGerman?: boolean,
): boolean | null => {
	if (
		personalIsGermanCitizen !== undefined &&
		personalIsGermanCitizen !== null
	) {
		return personalIsGermanCitizen;
	}
	return ocrIsGerman ? true : null;
};

const getStatusOption = (
	isGermanCitizen?: boolean | null,
	residenceStatus?: string | null,
): string => {
	if (isGermanCitizen) {
		return "german";
	}
	if (residenceStatus === "PermanentResident") {
		return "eu_5";
	}
	if (residenceStatus === "Other") {
		return "permit";
	}
	return "";
};

const buildFullAddress = (params: {
	streetVal?: string | null;
	houseVal?: string | null;
	zipVal?: string | null;
	cityVal?: string | null;
}): string => {
	const { streetVal, houseVal, zipVal, cityVal } = params;
	if (!streetVal || streetVal === "ohne feste Adresse") {
		return "";
	}
	return `${streetVal} ${houseVal || ""}, ${zipVal || ""} ${cityVal || ""}`
		.trim()
		.replace(/^,\s*/, "");
};

interface Page1NameProps {
	firstName: string;
	setFirstName: (val: string) => void;
	lastName: string;
	setLastName: (val: string) => void;
	fieldErrors: Record<string, string>;
	setFieldErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
	savePage1: () => void;
	t: (key: string, options?: Record<string, unknown>) => string;
}

const Page1Name: React.FC<Page1NameProps> = ({
	firstName,
	setFirstName,
	lastName,
	setLastName,
	fieldErrors,
	setFieldErrors,
	savePage1,
	t,
}) => (
	<div className="flex flex-col gap-5 text-left">
		<h1 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">
			{t("personal.questions.name_title")}
		</h1>

		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-1.5">
				<div
					className={`flex items-center gap-3 bg-white p-4 rounded-2xl border ${fieldErrors.firstName ? "border-rose-500 bg-rose-50/10" : "border-slate-200"} shadow-sm focus-within:border-primary-blue-300`}
				>
					<User className="text-brand-grey w-5 h-5 shrink-0" />
					<input
						type="text"
						placeholder={t("personal.placeholders.first_name")}
						value={firstName}
						onChange={(e) => {
							setFirstName(e.target.value);
							if (fieldErrors.firstName) {
								setFieldErrors((prev) => {
									const copy = { ...prev };
									delete copy.firstName;
									return copy;
								});
							}
						}}
						className="w-full text-base font-semibold text-slate-800 placeholder:text-brand-grey outline-none"
					/>
				</div>
				{fieldErrors.firstName && (
					<p className="text-xs font-semibold text-rose-600 px-1">
						{fieldErrors.firstName}
					</p>
				)}
			</div>
			<div className="flex flex-col gap-1.5">
				<div
					className={`flex items-center gap-3 bg-white p-4 rounded-2xl border ${fieldErrors.lastName ? "border-rose-500 bg-rose-50/10" : "border-slate-200"} shadow-sm focus-within:border-primary-blue-300`}
				>
					<User className="text-brand-grey w-5 h-5 shrink-0" />
					<input
						type="text"
						placeholder={t("personal.placeholders.last_name")}
						value={lastName}
						onChange={(e) => {
							setLastName(e.target.value);
							if (fieldErrors.lastName) {
								setFieldErrors((prev) => {
									const copy = { ...prev };
									delete copy.lastName;
									return copy;
								});
							}
						}}
						className="w-full text-base font-semibold text-slate-800 placeholder:text-brand-grey outline-none"
					/>
				</div>
				{fieldErrors.lastName && (
					<p className="text-xs font-semibold text-rose-600 px-1">
						{fieldErrors.lastName}
					</p>
				)}
			</div>
		</div>

		<PrimaryButton type="button" onClick={savePage1}>
			{t("common:next")}
		</PrimaryButton>
	</div>
);

interface Page2BirthProps {
	dateOfBirth: string;
	setDateOfBirth: (val: string) => void;
	placeOfBirth: string;
	setPlaceOfBirth: (val: string) => void;
	fieldErrors: Record<string, string>;
	setFieldErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
	savePage2: () => void;
	t: (key: string, options?: Record<string, unknown>) => string;
}

const Page2Birth: React.FC<Page2BirthProps> = ({
	dateOfBirth,
	setDateOfBirth,
	placeOfBirth,
	setPlaceOfBirth,
	fieldErrors,
	setFieldErrors,
	savePage2,
	t,
}) => (
	<div className="flex flex-col gap-5 text-left">
		<h1 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">
			{t("personal.questions.birth_title")}
		</h1>

		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-1.5">
				<div
					className={`flex items-center gap-3 bg-white p-4 rounded-2xl border ${fieldErrors.dateOfBirth ? "border-rose-500 bg-rose-50/10" : "border-slate-200"} shadow-sm`}
				>
					<Calendar className="text-brand-grey w-5 h-5 shrink-0" />
					<input
						type="date"
						value={dateOfBirth}
						onChange={(e) => {
							setDateOfBirth(e.target.value);
							if (fieldErrors.dateOfBirth) {
								setFieldErrors((prev) => {
									const copy = { ...prev };
									delete copy.dateOfBirth;
									return copy;
								});
							}
						}}
						className="w-full text-base font-semibold text-slate-800 outline-none"
					/>
				</div>
				{fieldErrors.dateOfBirth && (
					<p className="text-xs font-semibold text-rose-600 px-1">
						{fieldErrors.dateOfBirth}
					</p>
				)}
			</div>

			<div className="flex flex-col gap-1.5">
				<div
					className={`flex items-center gap-3 bg-white p-4 rounded-2xl border ${fieldErrors.placeOfBirth ? "border-rose-500 bg-rose-50/10" : "border-slate-200"} shadow-sm focus-within:border-primary-blue-300`}
				>
					<MapPin className="text-brand-grey w-5 h-5 shrink-0" />
					<input
						type="text"
						placeholder={t("personal.placeholders.birth_place")}
						value={placeOfBirth}
						onChange={(e) => {
							setPlaceOfBirth(e.target.value);
							if (fieldErrors.placeOfBirth) {
								setFieldErrors((prev) => {
									const copy = { ...prev };
									delete copy.placeOfBirth;
									return copy;
								});
							}
						}}
						className="w-full text-base font-semibold text-slate-800 placeholder:text-brand-grey outline-none"
					/>
				</div>
				{fieldErrors.placeOfBirth && (
					<p className="text-xs font-semibold text-rose-600 px-1">
						{fieldErrors.placeOfBirth}
					</p>
				)}
			</div>
		</div>

		<PrimaryButton type="button" onClick={savePage2}>
			{t("common:next")}
		</PrimaryButton>
	</div>
);

interface Page3GenderProps {
	t: (key: string) => string;
	legalGender: string;
	savePage3: (gender: "Male" | "Female" | "Diverse" | null | "") => void;
}

const Page3Gender: React.FC<Page3GenderProps> = ({
	t,
	legalGender,
	savePage3,
}) => (
	<div className="flex flex-col gap-5 text-left">
		<h1 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">
			{t("personal.questions.gender_title")}
		</h1>

		<div className="flex flex-col gap-3">
			<OptionCard
				id="Female"
				title={t("personal.options.female")}
				selected={legalGender === "Female"}
				onClick={() => savePage3("Female")}
			/>
			<OptionCard
				id="Male"
				title={t("personal.options.male")}
				selected={legalGender === "Male"}
				onClick={() => savePage3("Male")}
			/>
			<OptionCard
				id="Diverse"
				title={t("personal.options.diverse")}
				selected={legalGender === "Diverse"}
				onClick={() => savePage3("Diverse")}
			/>
		</div>

		<div className="mt-2 animate-in fade-in duration-300">
			<PrimaryButton
				type="button"
				onClick={() =>
					savePage3(legalGender as "Male" | "Female" | "Diverse" | null | "")
				}
			>
				{t("common:next")}
			</PrimaryButton>
		</div>
	</div>
);

interface Page4AddressProps {
	t: (key: string) => string;
	fieldErrors: Record<string, string>;
	setFieldErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
	noFixedAddress: boolean;
	setNoFixedAddress: (val: boolean) => void;
	addressInput: string;
	setAddressInput: (val: string) => void;
	setStreet: (val: string) => void;
	setHouseNumber: (val: string) => void;
	setZipCode: (val: string) => void;
	setCity: (val: string) => void;
	savePage4: () => void;
}

const Page4Address: React.FC<Page4AddressProps> = ({
	t,
	fieldErrors,
	setFieldErrors,
	noFixedAddress,
	setNoFixedAddress,
	addressInput,
	setAddressInput,
	setStreet,
	setHouseNumber,
	setZipCode,
	setCity,
	savePage4,
}) => (
	<div className="flex flex-col gap-5 text-left animate-in slide-in-from-right duration-300">
		<h1 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">
			{t("personal.questions.address_title")}
		</h1>

		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-1.5 text-left">
				<label
					htmlFor="address-search-input"
					className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-0.5 mb-0.5"
				>
					{t("personal.labels.address")}
				</label>
				<div
					className={`flex items-center gap-2 bg-white p-4 rounded-2xl border ${
						fieldErrors.street ||
						fieldErrors.houseNumber ||
						fieldErrors.zipCode ||
						fieldErrors.city
							? "border-rose-500 bg-rose-50/10"
							: "border-slate-200"
					} shadow-sm ${noFixedAddress ? "opacity-40 pointer-events-none" : ""}`}
				>
					<input
						id="address-search-input"
						type="text"
						placeholder={t("personal.placeholders.address")}
						disabled={noFixedAddress}
						value={addressInput}
						onChange={(e) => {
							setAddressInput(e.target.value);
							setFieldErrors((prev) => {
								const copy = { ...prev };
								delete copy.street;
								delete copy.houseNumber;
								delete copy.zipCode;
								delete copy.city;
								return copy;
							});
						}}
						className="w-full text-base font-semibold text-slate-800 placeholder:text-brand-grey outline-none"
					/>
				</div>
				{(fieldErrors.street ||
					fieldErrors.houseNumber ||
					fieldErrors.zipCode ||
					fieldErrors.city) && (
					<p className="text-xs font-semibold text-rose-600 px-1">
						{fieldErrors.street ||
							fieldErrors.houseNumber ||
							fieldErrors.zipCode ||
							fieldErrors.city}
					</p>
				)}
			</div>

			<div className="border-t border-slate-100 my-2" />

			<OptionCard
				id="no_fixed_address"
				title={t("personal.questions.no_fixed_address_label")}
				selected={noFixedAddress}
				onClick={() => {
					const newVal = !noFixedAddress;
					setNoFixedAddress(newVal);
					if (newVal) {
						setStreet("");
						setHouseNumber("");
						setZipCode("");
						setCity("");
					}
				}}
			/>
		</div>

		<PrimaryButton type="button" onClick={savePage4}>
			{t("common:next")}
		</PrimaryButton>
	</div>
);

interface Page5LastAddressProps {
	t: (key: string) => string;
	fieldErrors: Record<string, string>;
	setFieldErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
	lastFixedAddress: string;
	setLastFixedAddress: (val: string) => void;
	savePage5: () => void;
}

const Page5LastAddress: React.FC<Page5LastAddressProps> = ({
	t,
	fieldErrors,
	setFieldErrors,
	lastFixedAddress,
	setLastFixedAddress,
	savePage5,
}) => (
	<div className="flex flex-col gap-5 text-left animate-in slide-in-from-right duration-300">
		<h1 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">
			{t("personal.questions.last_fixed_address_title")}
		</h1>

		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-1.5">
				<div
					className={`flex items-center gap-3 bg-white p-4 rounded-2xl border ${fieldErrors.lastFixedAddress ? "border-rose-500 bg-rose-50/10" : "border-slate-200"} shadow-sm focus-within:border-primary-blue-300`}
				>
					<Home className="text-brand-grey w-5 h-5 shrink-0" />
					<input
						type="text"
						placeholder={t("personal.questions.last_fixed_address_placeholder")}
						value={lastFixedAddress}
						onChange={(e) => {
							setLastFixedAddress(e.target.value);
							if (fieldErrors.lastFixedAddress) {
								setFieldErrors((prev) => {
									const copy = { ...prev };
									delete copy.lastFixedAddress;
									return copy;
								});
							}
						}}
						className="w-full text-base font-semibold text-slate-800 placeholder:text-brand-grey outline-none"
					/>
				</div>
				{fieldErrors.lastFixedAddress && (
					<p className="text-xs font-semibold text-rose-600 px-1">
						{fieldErrors.lastFixedAddress}
					</p>
				)}
			</div>
		</div>

		<PrimaryButton type="button" onClick={savePage5}>
			{t("common:next")}
		</PrimaryButton>
	</div>
);

interface Page6CitizenshipProps {
	t: (key: string, options?: Record<string, unknown>) => string;
	statusOption: string;
	setStatusOption: (val: string) => void;
	selectedCountry: string;
	setSelectedCountry: (val: string) => void;
	setSaveError: (val: string | null) => void;
	savePage6: () => void;
	currentLanguage: string;
}

const Page6Citizenship: React.FC<Page6CitizenshipProps> = ({
	t,
	statusOption,
	setStatusOption,
	selectedCountry,
	setSelectedCountry,
	setSaveError,
	savePage6,
	currentLanguage,
}) => (
	<div className="flex flex-col gap-5 text-left animate-in slide-in-from-right duration-300">
		<h1 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">
			{t("personal.questions.citizenship_title")}
		</h1>

		<div className="flex flex-col gap-4">
			<OptionCard
				id="german"
				title={t("personal.options.german", {
					defaultValue: "Ich habe die deutsche Staatsangehörigkeit.",
				})}
				selected={statusOption === "german"}
				onClick={() => {
					setStatusOption("german");
					setSelectedCountry("DE");
					setSaveError(null);
				}}
			/>
			<OptionCard
				id="eu_5"
				title={t("personal.options.eu_5", {
					defaultValue:
						"Ich habe eine Staatsangehörigkeit von einem EU-Land. Seit mindestens 5 Jahren lebe ich in Deutschland.",
				})}
				selected={statusOption === "eu_5"}
				onClick={() => {
					setStatusOption("eu_5");
					setSelectedCountry("");
					setSaveError(null);
				}}
			/>
			{statusOption === "eu_5" && (
				<div className="flex items-center gap-2 bg-white p-4 rounded-2xl border border-slate-200 mt-[-8px] animate-in slide-in-from-top-2 duration-300 shadow-sm">
					<select
						value={selectedCountry}
						onChange={(e) => setSelectedCountry(e.target.value)}
						className="w-full text-base font-semibold text-slate-800 outline-none bg-transparent"
					>
						<option value="">
							{t("personal.dropdowns.select_eu_country")}
						</option>
						{COUNTRY_OPTIONS.filter((c) =>
							["FR", "PL", "AT", "NL", "PT", "CZ"].includes(c.code),
						).map((c) => (
							<option key={c.code} value={c.code}>
								{currentLanguage === "de"
									? GERMAN_COUNTRY_NAMES[c.code] || c.englishName
									: c.englishName}
							</option>
						))}
					</select>
				</div>
			)}

			<OptionCard
				id="permit"
				title={t("personal.options.permit", {
					defaultValue: "Mein Aufenthaltstitel für Deutschland ist gültig.",
				})}
				selected={statusOption === "permit"}
				onClick={() => {
					setStatusOption("permit");
					setSelectedCountry("");
					setSaveError(null);
				}}
			/>
			{statusOption === "permit" && (
				<div className="flex items-center gap-2 bg-white p-4 rounded-2xl border border-slate-200 mt-[-8px] animate-in slide-in-from-top-2 duration-300 shadow-sm">
					<select
						value={selectedCountry}
						onChange={(e) => setSelectedCountry(e.target.value)}
						className="w-full text-base font-semibold text-slate-800 outline-none bg-transparent"
					>
						<option value="">
							{t("personal.dropdowns.select_origin_country")}
						</option>
						{COUNTRY_OPTIONS.filter((c) => c.code !== "DE").map((c) => (
							<option key={c.code} value={c.code}>
								{currentLanguage === "de"
									? GERMAN_COUNTRY_NAMES[c.code] || c.englishName
									: c.englishName}
							</option>
						))}
					</select>
				</div>
			)}
		</div>

		<div className="mt-2 animate-in fade-in duration-300">
			<PrimaryButton
				type="button"
				onClick={savePage6}
				disabled={
					!statusOption ||
					((statusOption === "eu_5" || statusOption === "permit") &&
						!selectedCountry)
				}
			>
				{t("common:next")}
			</PrimaryButton>
		</div>
	</div>
);

export const ApplicationAboutMeQuestions: React.FC = () => {
	const { t, i18n } = useTranslation(["application", "profile", "common"]);
	const navigate = useNavigate();
	const location = useLocation();
	const { profileData, updateSection, isUpdating, isLoading, documents } =
		useProfile();
	const { autoVerifying } = useAutoVerification(["id_card"]);
	const isInitializedRef = useRef(false);
	const prevProfileDataRef = useRef<Profile | null>(null);

	const [currentPage, setCurrentPage] = useState<number>(1);
	const [saveSuccess, setSaveSuccess] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);
	const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

	const handleValidationErrors = (
		errors?: Array<{ field_path: string; message: string }>,
	) => {
		if (!errors) {
			setFieldErrors({});
			return;
		}
		const mappings: Record<string, string> = {
			first_name: "firstName",
			last_name: "lastName",
			date_of_birth: "dateOfBirth",
			place_of_birth: "placeOfBirth",
			legal_gender: "legalGender",
			street: "street",
			house_number: "houseNumber",
			zip_code: "zipCode",
			city: "city",
			state: "state",
			last_fixed_address: "lastFixedAddress",
		};
		const errs: Record<string, string> = {};
		errors.forEach((err) => {
			const mappedKey = mappings[err.field_path] || err.field_path;
			errs[mappedKey] = err.message;
		});
		setFieldErrors(errs);
	};

	const clearErrors = () => {
		setSaveError(null);
		setFieldErrors({});
	};

	// Page 1: Name
	const [firstName, setFirstName] = useState("");
	const [lastName, setLastName] = useState("");

	// Page 2: Birthday & Place
	const [dateOfBirth, setDateOfBirth] = useState("");
	const [placeOfBirth, setPlaceOfBirth] = useState("");

	// Page 3: Gender
	const [legalGender, setLegalGender] = useState("");

	// Page 4: Address
	const [addressInput, setAddressInput] = useState("");
	const [street, setStreet] = useState("");
	const [houseNumber, setHouseNumber] = useState("");
	const [zipCode, setZipCode] = useState("");
	const [city, setCity] = useState("");
	const [noFixedAddress, setNoFixedAddress] = useState(false);

	// Page 5: Last Fixed Address
	const [lastFixedAddress, setLastFixedAddress] = useState("");

	// Page 6: Citizenship
	const [statusOption, setStatusOption] = useState<string>("");
	const [selectedCountry, setSelectedCountry] = useState<string>("");

	useScrollToTop(currentPage);

	interface LocationState {
		extractedData?: {
			given_names?: string;
			first_name?: string;
			family_name?: string;
			last_name?: string;
			birth_date?: string;
			date_of_birth?: string;
			birth_place?: string;
			city_of_birth?: string;
			place_of_birth?: string;
			gender?: string;
			sex?: string;
			legal_gender?: string;
			street?: string;
			street_name?: string;
			house_number?: string;
			zip_code?: string;
			postal_code?: string;
			city?: string;
			address?: string;
			nationality?: string;
		};
	}

	interface SyncNameParams {
		personal: Partial<PersonalData>;
		prevPersonal: Partial<PersonalData>;
		shouldUpdate: (
			localVal: string | boolean | number | null | undefined,
			prevServerVal: string | boolean | number | null | undefined,
			_newServerVal?: string | boolean | number | null | undefined,
		) => boolean;
		ocrFirstName: string;
		ocrLastName: string;
	}

	const syncName = ({
		personal,
		prevPersonal,
		shouldUpdate,
		ocrFirstName,
		ocrLastName,
	}: SyncNameParams) => {
		if (shouldUpdate(firstName, prevPersonal.firstName, personal.firstName)) {
			setFirstName(personal.firstName || ocrFirstName || "");
		}
		if (shouldUpdate(lastName, prevPersonal.lastName, personal.lastName)) {
			setLastName(personal.lastName || ocrLastName || "");
		}
	};

	interface SyncBirthParams {
		personal: Partial<PersonalData>;
		prevPersonal: Partial<PersonalData>;
		shouldUpdate: (
			localVal: string | boolean | number | null | undefined,
			prevServerVal: string | boolean | number | null | undefined,
			_newServerVal?: string | boolean | number | null | undefined,
		) => boolean;
		ocrDateOfBirth: string;
		ocrPlaceOfBirth: string;
	}

	const syncBirth = ({
		personal,
		prevPersonal,
		shouldUpdate,
		ocrDateOfBirth,
		ocrPlaceOfBirth,
	}: SyncBirthParams) => {
		if (
			shouldUpdate(dateOfBirth, prevPersonal.dateOfBirth, personal.dateOfBirth)
		) {
			setDateOfBirth(getCorrectedDob(personal.dateOfBirth, ocrDateOfBirth));
		}
		if (
			shouldUpdate(
				placeOfBirth,
				prevPersonal.placeOfBirth,
				personal.placeOfBirth,
			)
		) {
			setPlaceOfBirth(personal.placeOfBirth || ocrPlaceOfBirth || "");
		}
	};

	interface SyncGenderParams {
		personal: Partial<PersonalData>;
		prevPersonal: Partial<PersonalData>;
		shouldUpdate: (
			localVal: string | boolean | number | null | undefined,
			prevServerVal: string | boolean | number | null | undefined,
			_newServerVal?: string | boolean | number | null | undefined,
		) => boolean;
		ocrGender: string;
	}

	const syncGender = ({
		personal,
		prevPersonal,
		shouldUpdate,
		ocrGender,
	}: SyncGenderParams) => {
		if (
			shouldUpdate(legalGender, prevPersonal.legalGender, personal.legalGender)
		) {
			setLegalGender(personal.legalGender || ocrGender || "");
		}
	};

	interface SyncAddressParams {
		addr: Partial<Address>;
		prevAddr: Partial<Address>;
		shouldUpdate: (
			localVal: string | boolean | number | null | undefined,
			prevServerVal: string | boolean | number | null | undefined,
			_newServerVal?: string | boolean | number | null | undefined,
		) => boolean;
		ocrStreet: string;
		ocrHouseNumber: string;
		ocrZipCode: string;
		ocrCity: string;
	}

	const syncAddressFields = ({
		addr,
		prevAddr,
		shouldUpdate,
		ocrStreet,
		ocrHouseNumber,
		ocrZipCode,
		ocrCity,
	}: SyncAddressParams) => {
		const streetVal = addr.street || ocrStreet || "";
		const houseVal = addr.houseNumber || ocrHouseNumber || "";
		const zipVal = addr.zipCode || ocrZipCode || "";
		const cityVal = addr.city || ocrCity || "";

		if (shouldUpdate(street, prevAddr.street, addr.street)) {
			setStreet(streetVal);
		}
		if (shouldUpdate(houseNumber, prevAddr.houseNumber, addr.houseNumber)) {
			setHouseNumber(houseVal);
		}
		if (shouldUpdate(zipCode, prevAddr.zipCode, addr.zipCode)) {
			setZipCode(zipVal);
		}
		if (shouldUpdate(city, prevAddr.city, addr.city)) {
			setCity(cityVal);
		}
	};

	const syncAddressFull = ({
		addr,
		prevAddr,
		shouldUpdate,
		ocrStreet,
		ocrHouseNumber,
		ocrZipCode,
		ocrCity,
	}: SyncAddressParams) => {
		const currentStreet = addr.street || ocrStreet || "";
		const currentHouseNumber = addr.houseNumber || ocrHouseNumber || "";
		const currentZipCode = addr.zipCode || ocrZipCode || "";
		const currentCity = addr.city || ocrCity || "";

		const full = buildFullAddress({
			streetVal: currentStreet,
			houseVal: currentHouseNumber,
			zipVal: currentZipCode,
			cityVal: currentCity,
		});
		const prevFull = buildFullAddress({
			streetVal: prevAddr.street,
			houseVal: prevAddr.houseNumber,
			zipVal: prevAddr.zipCode,
			cityVal: prevAddr.city,
		});

		if (shouldUpdate(addressInput, prevFull, full)) {
			setAddressInput(full);
		}

		const noAddr = currentStreet === "ohne feste Adresse";
		const prevNoAddr = prevAddr.street === "ohne feste Adresse";
		if (shouldUpdate(noFixedAddress, prevNoAddr, noAddr)) {
			setNoFixedAddress(noAddr);
		}
		if (noAddr && shouldUpdate(lastFixedAddress, prevAddr.state, addr.state)) {
			setLastFixedAddress(addr.state || "");
		}
	};

	interface SyncCitizenshipParams {
		personal: Partial<PersonalData>;
		prevPersonal: Partial<PersonalData>;
		shouldUpdate: (
			localVal: string | boolean | number | null | undefined,
			prevServerVal: string | boolean | number | null | undefined,
			_newServerVal?: string | boolean | number | null | undefined,
		) => boolean;
		ocrIsGerman: boolean;
	}

	const syncCitizenship = ({
		personal,
		prevPersonal,
		shouldUpdate,
		ocrIsGerman,
	}: SyncCitizenshipParams) => {
		const currentIsGermanCitizen = getIsGermanCitizen(
			personal.isGermanCitizen,
			ocrIsGerman,
		);
		const newStatusOption = getStatusOption(
			currentIsGermanCitizen,
			personal.residenceStatus,
		);
		const prevStatusOption = getStatusOption(
			prevPersonal.isGermanCitizen,
			prevPersonal.residenceStatus,
		);

		if (shouldUpdate(statusOption, prevStatusOption, newStatusOption)) {
			setStatusOption(newStatusOption);
		}

		const newNationality =
			personal.nationality || (currentIsGermanCitizen ? "DE" : "");
		const prevNationality =
			prevPersonal.nationality || (prevPersonal.isGermanCitizen ? "DE" : "");
		if (shouldUpdate(selectedCountry, prevNationality, newNationality)) {
			setSelectedCountry(newNationality);
		}
	};

	const syncProfileData = () => {
		if (!profileData) {
			return;
		}

		const personal = profileData.personalData || {};
		const addr = profileData.address || {};
		const prev = prevProfileDataRef.current;
		const prevPersonal = (prev?.personalData || {}) as Partial<PersonalData>;
		const prevAddr = (prev?.address || {}) as Partial<Address>;

		const shouldUpdate = (
			localVal: string | boolean | number | null | undefined,
			prevServerVal: string | boolean | number | null | undefined,
			newServerVal?: string | boolean | number | null | undefined,
		) => {
			const normLocal =
				localVal === "" || localVal === undefined || localVal === null
					? null
					: localVal;
			const normPrev =
				prevServerVal === "" ||
				prevServerVal === undefined ||
				prevServerVal === null
					? null
					: prevServerVal;
			const normNew =
				newServerVal === "" ||
				newServerVal === undefined ||
				newServerVal === null
					? null
					: newServerVal;

			if (!isInitializedRef.current) {
				return true;
			}

			// If the server value hasn't changed, don't overwrite local edits
			if (normNew === normPrev) {
				return false;
			}

			// If local value matches the old server value (user hasn't edited), sync new server val
			if (normLocal === normPrev) {
				return true;
			}

			// If local value matches the new server value (our save finished), keep in sync
			if (normLocal === normNew) {
				return true;
			}

			return false;
		};

		const extracted = (location.state as LocationState)?.extractedData || {};
		const ocrFirstName = extracted.given_names || extracted.first_name || "";
		const ocrLastName = extracted.family_name || extracted.last_name || "";
		const ocrDateOfBirth =
			extracted.birth_date || extracted.date_of_birth || "";
		const ocrPlaceOfBirth =
			extracted.birth_place ||
			extracted.city_of_birth ||
			extracted.place_of_birth ||
			"";

		const ocrGender = parseOcrGender(
			extracted.gender,
			extracted.sex,
			extracted.legal_gender,
		);
		const {
			street: ocrStreet,
			houseNumber: ocrHouseNumber,
			zipCode: ocrZipCode,
			city: ocrCity,
		} = parseOcrAddress(extracted);

		const ocrIsGerman = checkIsGerman(
			extracted.nationality,
			personal.placeOfBirth,
			ocrPlaceOfBirth,
		);

		syncName({
			personal,
			prevPersonal,
			shouldUpdate,
			ocrFirstName,
			ocrLastName,
		});
		syncBirth({
			personal,
			prevPersonal,
			shouldUpdate,
			ocrDateOfBirth,
			ocrPlaceOfBirth,
		});
		syncGender({ personal, prevPersonal, shouldUpdate, ocrGender });
		syncAddressFields({
			addr,
			prevAddr,
			shouldUpdate,
			ocrStreet,
			ocrHouseNumber,
			ocrZipCode,
			ocrCity,
		});
		syncAddressFull({
			addr,
			prevAddr,
			shouldUpdate,
			ocrStreet,
			ocrHouseNumber,
			ocrZipCode,
			ocrCity,
		});
		syncCitizenship({ personal, prevPersonal, shouldUpdate, ocrIsGerman });

		prevProfileDataRef.current = profileData;
		isInitializedRef.current = true;
	};

	const syncProfileDataRef = useRef(syncProfileData);
	useEffect(() => {
		syncProfileDataRef.current = syncProfileData;
	});

	useEffect(() => {
		if (profileData) {
			const timer = setTimeout(() => {
				syncProfileDataRef.current();
			}, 0);
			return () => clearTimeout(timer);
		}
		return undefined;
	}, [profileData, location.state]);

	useEffect(() => {
		if (saveError || Object.keys(fieldErrors).length > 0) {
			scrollToTop("smooth");
		}
	}, [saveError, fieldErrors]);

	const getNextPage = (
		result: ProfileResponse,
		fallbackPage: number,
	): number => {
		const nextStepId = result.data?.wizard_evaluation?.next_step;
		if (!nextStepId) {
			return fallbackPage;
		}

		const STEP_TO_PAGE_MAP: Record<string, number> = {
			step_applicant_name: 1,
			step_applicant_dob: 2,
			step_applicant_place_of_birth: 2,
			step_applicant_gender: 3,
			step_applicant_address: 4,
			step_applicant_last_resided_address: 5,
			step_applicant_nationality: 6,
		};

		return STEP_TO_PAGE_MAP[nextStepId] ?? -1;
	};

	const savePage1 = async () => {
		clearErrors();
		try {
			const result = await updateSection({
				section: "personalData",
				data: { firstName, lastName, validateEntireForm: false },
			});
			if (result.success) {
				triggerSuccess();
				setCurrentPage(getNextPage(result, 2));
			} else {
				handleValidationErrors(result.validationErrors);
				setSaveError(result.message || t("errors.save_failed"));
			}
		} catch {
			setSaveError(t("errors.save_failed"));
		}
	};

	const savePage2 = async () => {
		clearErrors();
		try {
			const result = await updateSection({
				section: "personalData",
				data: { dateOfBirth, placeOfBirth, validateEntireForm: false },
			});
			if (result.success) {
				triggerSuccess();
				setCurrentPage(getNextPage(result, 3));
			} else {
				handleValidationErrors(result.validationErrors);
				setSaveError(result.message || t("errors.save_failed"));
			}
		} catch {
			setSaveError(t("errors.save_failed"));
		}
	};

	const savePage3 = async (
		gender: "Male" | "Female" | "Diverse" | null | "",
	) => {
		clearErrors();
		const finalGender = gender === "" || gender === null ? null : gender;
		if (finalGender) {
			setLegalGender(finalGender);
		} else {
			setLegalGender("");
		}
		try {
			const result = await updateSection({
				section: "personalData",
				data: {
					legalGender: finalGender ? (finalGender as GenderType) : undefined,
					validateEntireForm: false,
				},
			});
			if (result.success) {
				triggerSuccess();
				setCurrentPage(getNextPage(result, 4));
			} else {
				handleValidationErrors(result.validationErrors);
				setSaveError(result.message || t("errors.save_failed"));
			}
		} catch {
			setSaveError(t("errors.save_failed"));
		}
	};

	const savePage4 = async () => {
		clearErrors();
		try {
			const parsed = parseAddressString(addressInput);
			const addressData = noFixedAddress
				? {
						street: "ohne feste Adresse",
						houseNumber: null,
						zipCode: null,
						city: null,
					}
				: {
						street: parsed.street.trim() || null,
						houseNumber: parsed.houseNumber.trim() || null,
						zipCode: parsed.zipCode.trim() || null,
						city: parsed.city.trim() || null,
						state: null,
					};

			const result = await updateSection({
				section: "address",
				data: { ...addressData, validateEntireForm: false },
			});
			if (result.success) {
				triggerSuccess();
				setCurrentPage(getNextPage(result, noFixedAddress ? 5 : 6));
			} else {
				handleValidationErrors(result.validationErrors);
				setSaveError(result.message || t("errors.save_failed"));
			}
		} catch {
			setSaveError(t("errors.save_failed"));
		}
	};

	const savePage5 = async () => {
		clearErrors();
		try {
			const result = await updateSection({
				section: "address",
				data: {
					street: "ohne feste Adresse",
					state: lastFixedAddress.trim() || null,
					validateEntireForm: false,
				},
			});
			if (result.success) {
				triggerSuccess();
				setCurrentPage(getNextPage(result, 6));
			} else {
				handleValidationErrors(result.validationErrors);
				setSaveError(result.message || t("errors.save_failed"));
			}
		} catch {
			setSaveError(t("errors.save_failed"));
		}
	};

	const savePage6 = async () => {
		let data: Record<string, string | boolean | null> = {};

		if (statusOption === "german") {
			data = {
				isGermanCitizen: true,
				nationality: "DE",
				residenceStatus: "Citizen",
			};
		} else if (statusOption === "eu_5") {
			if (!selectedCountry) {
				setSaveError("Bitte wähle ein EU-Land aus.");
				return;
			}
			data = {
				isGermanCitizen: false,
				nationality: selectedCountry,
				residenceStatus: "PermanentResident",
			};
		} else if (statusOption === "permit") {
			if (!selectedCountry) {
				setSaveError("Bitte wähle Dein Herkunftsland aus.");
				return;
			}
			data = {
				isGermanCitizen: false,
				nationality: selectedCountry,
				residenceStatus: "Other",
			};
		} else {
			data = {
				isGermanCitizen: null,
				nationality: null,
				residenceStatus: null,
			};
		}

		try {
			const result = await updateSection({
				section: "personalData",
				data: { ...data, validateEntireForm: false },
			});
			if (result.success) {
				triggerSuccess();
				const unverifiedIdCard = (documents || []).find(
					(d: WalletDocument) =>
						mapBackendDocTypeToSlotId(d.type) === "id_card" &&
						d.status === "READY_FOR_REVIEW",
				);
				if (unverifiedIdCard) {
					await autoVerifyIdCard(unverifiedIdCard);
				}
				navigate(AppRoutes.ApplicationOverview);
			} else {
				setSaveError(result.message || t("errors.save_failed"));
			}
		} catch {
			setSaveError(t("errors.save_failed"));
		}
	};

	const autoVerifyIdCard = async (unverifiedIdCard: WalletDocument) => {
		try {
			const personal = (profileData?.personalData ||
				{}) as Partial<PersonalData>;
			const addr = (profileData?.address || {}) as Partial<Address>;
			const correctedData: Record<string, string | null | undefined> = {
				given_names: personal.firstName || firstName,
				family_name: personal.lastName || lastName,
				birth_date: personal.dateOfBirth || dateOfBirth,
				birth_place: personal.placeOfBirth || placeOfBirth,
				sex: (() => {
					const gender = personal.legalGender || legalGender;
					if (gender === "Male") {
						return "MALE";
					}
					if (gender === "Female") {
						return "FEMALE";
					}
					return "NON_BINARY";
				})(),
				street_name: addr.street || street,
				house_number: addr.houseNumber || houseNumber,
				postal_code: addr.zipCode || zipCode,
				city: addr.city || city,
			};
			await authenticatedFetch(
				`${env.VITE_API_URL}/api/v1/documents/${unverifiedIdCard.id}/verify`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						corrected_data: correctedData,
						verified_fields: Object.keys(correctedData),
						document_type: "id_card",
					}),
				},
			);
		} catch (err) {
			console.error(
				"Failed to auto-verify document at wizard completion:",
				err,
			);
		}
	};

	const triggerSuccess = () => {
		setSaveSuccess(true);
		setSaveError(null);
		setTimeout(() => setSaveSuccess(false), 1000);
	};

	const handleBack = () => {
		if (currentPage === 6 && !noFixedAddress) {
			setCurrentPage(4); // Skip Page 5 back to Address
		} else if (currentPage === 6 && noFixedAddress) {
			setCurrentPage(5);
		} else if (currentPage === 5) {
			setCurrentPage(4);
		} else if (currentPage > 1) {
			setCurrentPage(currentPage - 1);
			setSaveError(null);
		} else {
			navigate(AppRoutes.ApplicationAboutMeIntro);
		}
	};

	const getActiveStep = () => {
		if (noFixedAddress) {
			return currentPage;
		}
		if (currentPage > 4) {
			return currentPage - 1;
		}
		return currentPage;
	};
	const activeStep = getActiveStep();

	const totalSteps = noFixedAddress ? 6 : 5;

	if ((isLoading && !profileData) || autoVerifying) {
		return (
			<PageContainer topBarProps={{ showLanguageSwitcher: true }}>
				<div className="flex items-center justify-center min-h-[50vh]">
					<Loader2 className="w-8 h-8 animate-spin text-slate-500" />
				</div>
			</PageContainer>
		);
	}

	return (
		<PageContainer
			topBarProps={{
				onBack: handleBack,
				showLanguageSwitcher: true,
				colorVariant: "green",
			}}
		>
			{(isUpdating || saveSuccess) && (
				<div
					role="status"
					className="fixed top-6 z-50 flex items-center gap-2.5 bg-white px-5 py-2.5 rounded-full shadow-xl border border-slate-100 animate-in fade-in duration-300"
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

			{saveError && (
				<div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-900 font-medium w-full max-w-md mb-4 text-sm mx-auto text-left shadow-sm">
					<AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />
					<p>{saveError}</p>
				</div>
			)}

			<ProgressBar
				current={activeStep}
				total={totalSteps}
				colorVariant="blue"
				ariaLabel={t("step_page", {
					current: activeStep,
					total: totalSteps,
					defaultValue: `${activeStep} von ${totalSteps} Seiten`,
				})}
			/>

			<div className="w-full max-w-md flex flex-col gap-6 mx-auto -mt-2">
				{/* Step Progress Badge */}
				<div className="text-left">
					<span className="text-xs font-semibold text-brand-grey mb-1 block">
						{t("personal.steps.step_x_of_y", {
							current: activeStep,
							total: totalSteps,
						})}
					</span>
				</div>

				{/* Page 1: Name */}
				{currentPage === 1 && (
					<Page1Name
						firstName={firstName}
						setFirstName={setFirstName}
						lastName={lastName}
						setLastName={setLastName}
						fieldErrors={fieldErrors}
						setFieldErrors={setFieldErrors}
						savePage1={savePage1}
						t={t}
					/>
				)}

				{/* Page 2: Birthday & birthplace */}
				{currentPage === 2 && (
					<Page2Birth
						dateOfBirth={dateOfBirth}
						setDateOfBirth={setDateOfBirth}
						placeOfBirth={placeOfBirth}
						setPlaceOfBirth={setPlaceOfBirth}
						fieldErrors={fieldErrors}
						setFieldErrors={setFieldErrors}
						savePage2={savePage2}
						t={t}
					/>
				)}

				{/* Page 3: Gender */}
				{currentPage === 3 && (
					<Page3Gender t={t} legalGender={legalGender} savePage3={savePage3} />
				)}

				{/* Page 4: Current Address */}
				{currentPage === 4 && (
					<Page4Address
						t={t}
						fieldErrors={fieldErrors}
						setFieldErrors={setFieldErrors}
						noFixedAddress={noFixedAddress}
						setNoFixedAddress={setNoFixedAddress}
						addressInput={addressInput}
						setAddressInput={setAddressInput}
						setStreet={setStreet}
						setHouseNumber={setHouseNumber}
						setZipCode={setZipCode}
						setCity={setCity}
						savePage4={savePage4}
					/>
				)}

				{/* Page 5: Last Fixed Address */}
				{currentPage === 5 && (
					<Page5LastAddress
						t={t}
						fieldErrors={fieldErrors}
						setFieldErrors={setFieldErrors}
						lastFixedAddress={lastFixedAddress}
						setLastFixedAddress={setLastFixedAddress}
						savePage5={savePage5}
					/>
				)}

				{/* Page 6: Citizenship status */}
				{currentPage === 6 && (
					<Page6Citizenship
						t={t}
						statusOption={statusOption}
						setStatusOption={setStatusOption}
						selectedCountry={selectedCountry}
						setSelectedCountry={setSelectedCountry}
						setSaveError={setSaveError}
						savePage6={savePage6}
						currentLanguage={i18n.language}
					/>
				)}
			</div>
		</PageContainer>
	);
};
