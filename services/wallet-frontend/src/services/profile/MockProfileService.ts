import { DEFAULT_LOCALE } from "../../constants/locale";
import type {
	Profile,
	ProfileUpdatePayload,
	GenderType,
	MaritalStatusType,
	PersonalData,
	Address,
} from "../../schemas/profile.schema";
import type { IProfileService, ProfileResponse } from "./IProfileService";
import { useAuthStore } from "../../store/useAuthStore";
import { getMockProfileStorageKey } from "../../utils/profile";

export class MockProfileService implements IProfileService {
	private getEmptyProfile(): Profile {
		return {
			personalData: {
				firstName: " ", // Using a space to avoid validation errors if schema requires min(1)
				lastName: " ",
				dateOfBirth: "1970-01-01", // Standard default date
				placeOfBirth: " ",
				legalGender: "Diverse",
			},
			address: {},
			contact: {},
			financial: {
				bankDetails: {},
			},
			household: {},
			housing: {},
			health: {},
			vehicle: {},
			documents: [],
			settings: {
				language: DEFAULT_LOCALE,
				notificationsEnabled: true,
				personaAddress: "Informal",
			},
		};
	}

	private getInitialProfile(): Profile {
		return {
			personalData: {
				firstName: "Sandor",
				lastName: "Miller",
				dateOfBirth: "1955-05-12",
				placeOfBirth: "Berlin",
				legalGender: "Male",
				nationality: "Deutsch",
				maritalStatus: "Married",
			},
			address: {
				street: "Sonnenallee",
				houseNumber: "124",
				zipCode: "10820",
				city: "Berlin",
				district: "Tempelhof-Schöneberg",
			},
			contact: {
				email: "sandor.miller@example.com",
				phoneNumber: "+49 176 12345678",
			},
			financial: {
				monthlyIncome: 1250,
				hasAssets: false,
				bankDetails: {
					bankName: "Berliner Sparkasse",
					accountHolder: "Sandor Miller",
					iban: "DE12 3456 7890 1234 5678 90",
				},
			},
			household: {
				personsInHouseholdCount: 2,
				maritalStatus: "Married",
			},
			housing: {
				accomodationType: "Rental Apartment",
				tenancyStatus: "Main Tenant",
				rentTotal: 600,
				heatingCosts: 100,
				livingArea: 65,
				numberOfRooms: 3,
			},
			health: {},
			vehicle: {},
			documents: [
				{
					id: "doc-1",
					name: "Personalausweis_Sandor.pdf",
					type: "ID_CARD",
					status: "COMPLETED",
					confidence: 0.98,
					uploadDate: new Date().toISOString(),
				},
			],
			settings: {
				language: DEFAULT_LOCALE,
				notificationsEnabled: true,
				personaAddress: "Formal",
			},
		};
	}

	private getStorageKey(): string {
		const authStore = useAuthStore.getState();
		let phone = authStore.phoneNumber;

		// Fallback for tests: when initializing before auth hydration
		if (!phone && typeof window !== "undefined") {
			const persisted = sessionStorage.getItem("beyond-forms-auth-session");
			if (persisted) {
				try {
					const parsed = JSON.parse(persisted);
					phone = parsed.state?.phoneNumber;
				} catch (_e) {
					// Ignore parse errors
				}
			}
		}

		phone = phone || "default";
		return getMockProfileStorageKey(phone);
	}

	async getProfile(): Promise<Profile> {
		const authStore = useAuthStore.getState();
		const isNewUser = authStore.status === "SUCCESS_NEW";
		const key = this.getStorageKey();

		const stored = localStorage.getItem(key);
		if (stored) {
			// Allow stored data to be used even for new users if it exists (so they see saves)
			return JSON.parse(stored);
		}

		const initial = isNewUser
			? this.getEmptyProfile()
			: this.getInitialProfile();
		localStorage.setItem(key, JSON.stringify(initial));
		return initial;
	}

	async updateProfileSection<K extends keyof Profile>(
		section: K,
		data: Partial<Profile[K]> & { validateEntireForm?: boolean },
	): Promise<ProfileResponse> {
		const currentProfile = await this.getProfile();
		const { validateEntireForm: _validate, ...restData } = data;
		const payloadData = { ...restData };

		if (section === "address") {
			const addressData = payloadData as Record<string, unknown>;
			if (
				typeof addressData.zipCode === "string" ||
				addressData.zipCode === null ||
				addressData.zipCode === undefined
			) {
				addressData.district = this.resolveDistrict(
					addressData.zipCode as string | null | undefined,
				);
			}
		}

		let updatedProfile: Profile;
		if (section === "documents") {
			updatedProfile = {
				...currentProfile,
				documents: payloadData as unknown as Profile["documents"],
			};
		} else {
			updatedProfile = {
				...currentProfile,
				[section]: {
					...(currentProfile[section] as object),
					...(payloadData as object),
				},
			};
		}

		const key = this.getStorageKey();
		localStorage.setItem(key, JSON.stringify(updatedProfile));
		// Longer delay to ensure "Saving..." indicator is visible in tests
		await new Promise((resolve) => setTimeout(resolve, 800));
		return { success: true, data: { profile: updatedProfile } };
	}

	private mergePersonal(
		personal: Partial<PersonalData>,
		data: ProfileUpdatePayload,
	): PersonalData {
		return {
			firstName: (data.firstName as string) ?? personal.firstName,
			lastName: (data.lastName as string) ?? personal.lastName,
			dateOfBirth: (data.dateOfBirth as string) ?? personal.dateOfBirth,
			placeOfBirth: (data.placeOfBirth as string) ?? personal.placeOfBirth,
			legalGender: (data.legalGender as GenderType) ?? personal.legalGender,
			nationality: (data.nationality as string) ?? personal.nationality,
			secondNationality:
				(data.secondNationality as string) ?? personal.secondNationality,
			maritalStatus:
				(data.maritalStatus as MaritalStatusType) ?? personal.maritalStatus,
			birthName: (data.birthName as string) ?? personal.birthName,
			residenceStatus:
				(data.residenceStatus as string) ?? personal.residenceStatus,
			identificationNumbers:
				(data.identificationNumbers as string) ??
				personal.identificationNumbers,
			taxId: (data.taxId as string) ?? personal.taxId,
		};
	}

	private resolveDistrict(zipCode: string | null | undefined): string | null {
		if (!zipCode) {
			return null;
		}
		const zip = zipCode.trim();
		if (zip === "12101" || zip === "10820") {
			return "Tempelhof-Schöneberg";
		}
		if (zip === "12045") {
			return "Neukölln";
		}
		return null;
	}

	private mergeAddress(
		address: Partial<Address>,
		data: ProfileUpdatePayload,
	): Address {
		const zipCode = (data.zipCode as string) ?? address.zipCode;
		return {
			street: (data.street as string) ?? address.street,
			houseNumber: (data.houseNumber as string) ?? address.houseNumber,
			zipCode,
			city: (data.city as string) ?? address.city,
			state: (data.state as string) ?? address.state,
			district: this.resolveDistrict(zipCode),
		};
	}

	async submitProfile(data: ProfileUpdatePayload): Promise<ProfileResponse> {
		const currentProfile = await this.getProfile();
		const personal = currentProfile.personalData || {};
		const address = currentProfile.address || {};
		const updatedProfile: Profile = {
			...currentProfile,
			personalData: {
				...personal,
				...this.mergePersonal(personal, data),
			},
			address: {
				...address,
				...this.mergeAddress(address, data),
			},
		};

		const key = this.getStorageKey();
		localStorage.setItem(key, JSON.stringify(updatedProfile));
		return { success: true, data: { profile: updatedProfile } };
	}

	async deleteProfile(): Promise<void> {
		localStorage.removeItem(this.getStorageKey());
	}
}
