export const EMAIL_QUEUE = "email";
export type EmailJob = { to: string; subject: string; html: string };