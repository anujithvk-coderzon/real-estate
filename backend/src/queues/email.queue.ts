import { Queue } from 'bullmq';
import { EMAIL_QUEUE, type EmailJob } from './email.contract.js';



const emailQueue=new Queue<EmailJob>(EMAIL_QUEUE, {
    connection:{
        url:process.env.REDIS!
    },
    defaultJobOptions:{
        attempts:4,
        backoff:{type:'exponential',delay:5000},
        removeOnComplete:{age:86400,count:1000},
        removeOnFail:{age:7*86400}
    }
})

export const queueEmail=(data:EmailJob)=>emailQueue.add("send",data)
