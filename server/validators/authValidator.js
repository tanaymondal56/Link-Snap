import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string()
    .email({ message: "Invalid email address" })
    .max(255, { message: "Email is too long" }),
  password: z.string()
    .min(8, { message: "Password must be at least 8 characters long" })
    .max(128, { message: "Password is too long" })
    .regex(/[a-z]/, { message: "Password must contain at least one lowercase letter" })
    .regex(/[A-Z]/, { message: "Password must contain at least one uppercase letter" })
    .regex(/[0-9]/, { message: "Password must contain at least one number" }),
  firstName: z.string()
    .min(1, { message: "First name is required" })
    .max(50, { message: "First name is too long" })
    .regex(/^[a-zA-Z\s'-]+$/, { message: "First name can only contain letters, spaces, hyphens, and apostrophes" }),
  lastName: z.string()
    .max(50, { message: "Last name is too long" })
    .regex(/^[a-zA-Z\s'-]*$/, { message: "Last name can only contain letters, spaces, hyphens, and apostrophes" })
    .optional()
    .or(z.literal('')),
  phone: z.string()
    .max(20, { message: "Phone number is too long" })
    .regex(/^[\d\s\-+()]*$/, { message: "Invalid phone number format" })
    .optional()
    .or(z.literal('')),
  company: z.string()
    .max(100, { message: "Company name is too long" })
    .optional()
    .or(z.literal('')),
  website: z.string()
    .max(200, { message: "Website URL is too long" })
    .url({ message: "Invalid website URL" })
    .optional()
    .or(z.literal('')),
  username: z.string()
    .min(3, { message: "Username must be at least 3 characters" })
    .max(30, { message: "Username is too long" })
    .regex(/^[a-z0-9_-]+$/, { message: "Username can only contain lowercase letters, numbers, underscores, and dashes" }),
});

export const loginSchema = z.object({
  identifier: z.string()
    .min(1, { message: "Email or username is required" })
    .max(255, { message: "Identifier is too long" }),
  password: z.string()
    .min(1, { message: "Password is required" })
    .max(128, { message: "Password is too long" }),
});

export const updateProfileSchema = z.object({
  firstName: z.string()
    .min(1, { message: "First name is required" })
    .max(50, { message: "First name is too long" })
    .regex(/^[a-zA-Z\s'-]+$/, { message: "First name can only contain letters, spaces, hyphens, and apostrophes" })
    .optional(),
  lastName: z.string()
    .max(50, { message: "Last name is too long" })
    .regex(/^[a-zA-Z\s'-]*$/, { message: "Last name can only contain letters, spaces, hyphens, and apostrophes" })
    .optional(),
  phone: z.string()
    .max(20, { message: "Phone number is too long" })
    .regex(/^[\d\s\-+()]*$/, { message: "Invalid phone number format" })
    .optional(),
  company: z.string().max(100).optional(),
  website: z.string()
    .max(200, { message: "Website URL is too long" })
    .url({ message: "Invalid website URL" })
    .optional()
    .or(z.literal('')),
  bio: z.string().max(500).optional(),
  username: z.string()
    .min(3, { message: "Username must be at least 3 characters" })
    .max(30, { message: "Username is too long" })
    .regex(/^[a-z0-9_-]+$/, { message: "Username can only contain lowercase letters, numbers, underscores, and dashes" })
    .optional(),
});

export const verifyOtpSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  otp: z.string().length(6, { message: "OTP must be exactly 6 digits" }).regex(/^\d+$/, { message: "OTP must contain only numbers" }),
});

export const forgotPasswordSchema = z.object({
  email: z.string()
    .email({ message: "Invalid email address" })
    .max(255, { message: "Email is too long" }),
});

export const resetPasswordSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }).optional(),
  token: z.string().min(20, { message: "Invalid reset token" }).optional(),
  otp: z.string().length(6, { message: "OTP must be exactly 6 digits" }).regex(/^\d+$/, { message: "OTP must contain only numbers" }).optional(),
  newPassword: z.string()
    .min(8, { message: "Password must be at least 8 characters long" })
    .max(128, { message: "Password is too long" })
    .regex(/[a-z]/, { message: "Password must contain at least one lowercase letter" })
    .regex(/[A-Z]/, { message: "Password must contain at least one uppercase letter" })
    .regex(/[0-9]/, { message: "Password must contain at least one number" }),
}).refine(data => data.token || (data.otp && data.email), {
  message: "Provide either reset token or email + OTP",
});
