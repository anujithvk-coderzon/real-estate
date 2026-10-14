import { Job, Worker } from "bullmq";
import { MEDIA_QUEUE, type MediaCleanupJob } from "./media.contract.js";
import { deleteImage, deleteListingFiles, deleteVideo } from "../lib/bunny.js";

export const mediaWorker=new Worker<MediaCleanupJob>(
    MEDIA_QUEUE,
    async(job:Job<MediaCleanupJob>)=>{
        switch(job.data.kind){
            case "listingFolder":
                return deleteListingFiles(job.data.listingId);
            case "image":
                return deleteImage(job.data.path)
            case "video":
                return deleteVideo(job.data.videoId)
        }
    },
    {connection:{url:process.env.REDIS!},concurrency:3}
)

mediaWorker.on("failed",(job,err)=>console.error(`[media] ${job?.data.kind} failed on attempt ${job?.attemptsMade}:${err.message}`))