import { Queue } from "bullmq";
import { MEDIA_QUEUE, type MediaCleanupJob } from "./media.contract.js";

export const mediaQueue=new Queue<MediaCleanupJob>(MEDIA_QUEUE,{
    connection:{
        url:process.env.REDIS!
    },
    defaultJobOptions:{
        attempts:5,
        backoff:{type:"exponential",delay:10_000},
        removeOnComplete:{age:3600,count:100},
        removeOnFail:{age:30*86400}
    }
})

export const queueMediaCleanup=(data:MediaCleanupJob)=>mediaQueue.add("cleanup",data)