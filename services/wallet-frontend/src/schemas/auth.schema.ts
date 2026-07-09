import { z } from "zod";

/**
 * Validates international phone numbers.
 * Allows leading + followed by 7-15 digits.
 */
export const PhoneNumberSchema = z
	.string()
	.min(7, { message: "error.phone_too_short" })
	.max(16, { message: "error.phone_too_long" })
	.regex(/^\+?[1-9]\d{1,14}$/, { message: "error.invalid_phone_format" });

/**
 * Validates 6-digit OTP codes.
 */
export const OTPSchema = z
	.string()
	.length(6, { message: "error.otp_invalid_length" })
	.regex(/^\d+$/, { message: "error.otp_only_digits" });

export type PhoneNumber = z.infer<typeof PhoneNumberSchema>;
export type OTP = z.infer<typeof OTPSchema>;
