import { Job, Worker } from "bullmq";
import { EMAIL_QUEUE, type EmailJob } from "./email.queue.js";
import { sendEmail } from "../lib/email.js";


export const emailWorker= new Worker<EmailJob>(
EMAIL_QUEUE,
async(job:Job<EmailJob>)=>{
    await sendEmail(job.data.to,job.data.subject,job.data.html);
},
{connection:{url:process.env.REDIS!},concurrency:5}
);

emailWorker.on("completed",(job)=>console.log(`[email] sent job ${job.id} to ${job.data.to}`))

emailWorker.on("failed",(job, err)=>console.error(`[email] job ${job?.id} failed on attempt ${job?.attemptsMade}:${err.message}`))