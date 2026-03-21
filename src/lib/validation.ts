/**
 * Input validation helpers.
 * Simple schema validation without Zod dependency — keeps the bundle small.
 */

export interface ValidationError {
  field: string;
  message: string;
}

export function validateUrl(url: string): string | null {
  if (!url || typeof url !== "string") return "URL is required";
  const trimmed = url.trim();
  if (trimmed.length < 4) return "URL is too short";
  if (trimmed.length > 2000) return "URL is too long";

  // Add protocol if missing
  const withProtocol = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return "URL must use http or https";
    }
    if (!parsed.hostname.includes(".")) {
      return "URL must include a valid domain";
    }
    // Block local/private IPs
    const hostname = parsed.hostname;
    if (
      hostname === "localhost" ||
      hostname.startsWith("127.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("0.")
    ) {
      return "Cannot analyze local or private URLs";
    }
    return null;
  } catch {
    return "Invalid URL format";
  }
}

export function validateString(
  value: unknown,
  fieldName: string,
  opts: { required?: boolean; minLength?: number; maxLength?: number } = {}
): string | null {
  const { required = false, minLength = 0, maxLength = 10000 } = opts;

  if (value === undefined || value === null || value === "") {
    return required ? `${fieldName} is required` : null;
  }

  if (typeof value !== "string") {
    return `${fieldName} must be a string`;
  }

  if (value.length < minLength) {
    return `${fieldName} must be at least ${minLength} characters`;
  }

  if (value.length > maxLength) {
    return `${fieldName} must be at most ${maxLength} characters`;
  }

  return null;
}

export function validateArray(
  value: unknown,
  fieldName: string,
  opts: { required?: boolean; minLength?: number; maxLength?: number } = {}
): string | null {
  const { required = false, minLength = 0, maxLength = 50 } = opts;

  if (value === undefined || value === null) {
    return required ? `${fieldName} is required` : null;
  }

  if (!Array.isArray(value)) {
    return `${fieldName} must be an array`;
  }

  if (value.length < minLength) {
    return `${fieldName} must have at least ${minLength} items`;
  }

  if (value.length > maxLength) {
    return `${fieldName} must have at most ${maxLength} items`;
  }

  return null;
}

export function validateEmail(email: string): string | null {
  if (!email || typeof email !== "string") return "Email is required";
  const trimmed = email.trim();
  if (trimmed.length > 320) return "Email is too long";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return "Invalid email format";
  return null;
}

/**
 * Sanitize user input to prevent XSS in stored content
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .trim();
}

/**
 * Validate a batch of fields, return first error or null
 */
export function validateFields(
  validations: (() => string | null)[]
): string | null {
  for (const validate of validations) {
    const error = validate();
    if (error) return error;
  }
  return null;
}
