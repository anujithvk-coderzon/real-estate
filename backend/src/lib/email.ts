import { BrevoClient } from "@getbrevo/brevo";
import { InternalServerError } from "../errors/Errors.js";

export const brevo=new BrevoClient({
    apiKey:process.env.BREVO_API_KEY!
  })

export async function sendEmail(to:string,subject:string,html:string) {
  const sender = { email: process.env.BREVO_SENDER, name: process.env.BREVO_SENDER_NAME };
  try {
    await brevo.transactionalEmails.sendTransacEmail({
    htmlContent:html,
    sender:{
      email:sender.email,
      name:sender.name
    },
    to:[{
      email:to
    }],
    subject
  })
  } catch (error) {
   throw new InternalServerError(
    error instanceof Error ? error.message : "Email provider failed",
  );}

}
