import z from "zod";

export const registerSchema = z.object({
  email: z.email().min(1, "Email is required").toLowerCase(),
  name: z.string().min(1, "Name is required"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(
      /[^A-Za-z0-9]/,
      "Password must contain at least one special character",
    ),
});

export const loginSchema = z.object({
  email: z.email().min(1, "Email required").toLowerCase(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(
      /[^A-Za-z0-9]/,
      "Password must contain at least one special character",
    ),
});


export const forgotSchema=z.object({
        email:z.email().min(1,"Email required").toLowerCase()
})

// The strength rules every new password must meet (kept in step with frontend/lib/validation/auth.ts).
const strongPassword = z
  .string()
  .min(8, "Password must be at least 8 characters long")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");

// Reset from the email link: one field; the page has a Show button instead of a confirm field.
export const resetSchema = z.object({
  password: strongPassword,
})

export const changePasswordSchema=z.object({
  // Only "is it filled in": accounts created before the strength rules existed
  // must still be able to type their old password here.
  current_password:z.string().min(1,"Enter your current password"),
  new_password:z.string()
                    .min(8, "Password must be at least 8 characters long")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(
      /[^A-Za-z0-9]/,
      "Password must contain at least one special character",
    ),
}).refine((data)=>data.current_password!==data.new_password,{
  message:"new password cannot be the current password",
  path:['new_password']
})

// Google accounts adding their first password.
export const setPasswordSchema = z.object({
  new_password: strongPassword,
});

// Settings → Profile.
export const profileSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(60, "Name is too long"),
});
