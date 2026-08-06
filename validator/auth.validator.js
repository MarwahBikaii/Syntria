import { z } from "zod";

const nameSchema = z
  .string()
  .trim()
  .min(2, "Name must contain at least 2 characters.")
  .max(80, "Name cannot exceed 80 characters.");

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address.")
  .max(255, "Email cannot exceed 255 characters.");

const passwordSchema = z
  .string()
  .min(8, "Password must contain at least 8 characters.")
  .max(72, "Password cannot exceed 72 characters.")
  .regex(/[a-z]/, "Password must contain a lowercase letter.")
  .regex(/[A-Z]/, "Password must contain an uppercase letter.")
  .regex(/[0-9]/, "Password must contain a number.")
  .regex(
    /[^A-Za-z0-9]/,
    "Password must contain a special character.",
  );

export const registerSchema = z
  .object({
    firstName: nameSchema,
    lastName: nameSchema,
    email: emailSchema,
    password: passwordSchema,

    confirmPassword: z.string(),

    phone: z
      .string()
      .trim()
      .max(30, "Phone number cannot exceed 30 characters.")
      .optional()
      .nullable(),
  })
  .strict()
  .refine(
    (data) => data.password === data.confirmPassword,
    {
      path: ["confirmPassword"],
      message: "Passwords do not match.",
    },
  );

export const loginSchema = z
  .object({
    email: emailSchema,

    password: z
      .string()
      .min(1, "Password is required.")
      .max(72, "Password is invalid."),
  })
  .strict();

export const refreshTokenSchema = z
  .object({
    refreshToken: z.string().min(1).optional(),
  })
  .strict()
  .optional();