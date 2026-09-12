import type { UseFormRegister, FieldErrors } from "react-hook-form";
import type { TFunction } from "i18next";
import type { ProfileEditForm } from "../../../schemas/profile.schema";

export type CombinedWizardFormValues = ProfileEditForm;

export interface SectionProps {
	register: UseFormRegister<CombinedWizardFormValues>;
	formErrors: FieldErrors<CombinedWizardFormValues>;
	handleFieldBlur: (fieldName: keyof CombinedWizardFormValues & string) => void;
	t: TFunction;
}
