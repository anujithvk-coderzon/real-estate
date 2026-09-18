import { BrevoClient } from "@getbrevo/brevo";

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
    console.error("[email] Brevo rejected it", error);  
  }

}
