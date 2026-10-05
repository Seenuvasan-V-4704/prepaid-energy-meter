// Shared checks used by the Sign up and Profile forms.

// Example shown to the user in placeholders and error messages.
export const PHONE_EXAMPLE = '+919876543210'

// One message everywhere, so the wording never drifts.
export const PHONE_FORMAT_MESSAGE =
  `Phone must use E.164 format, for example ${PHONE_EXAMPLE}.`

// E.164: a "+", then 8 to 15 digits, and the first digit is not 0.
export function isValidE164Phone(phone: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(phone)
}
