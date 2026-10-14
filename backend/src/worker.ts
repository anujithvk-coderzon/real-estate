import "dotenv/config.js"
import { emailWorker } from "./queues/email.worker.js";
import { mediaWorker } from "./queues/media.worker.js";

let closing=false;

const shutdown=async(signal:string)=>{
    if(closing) return;
    closing=true;
    console.log(`[worker] ${signal} received, finishing current Jobs...`)
    const forceExit=setTimeout(() => {
        console.error("[Worker] shutdown timed out, forcing exit")
        process.exit(1);
    }, 8000);
    forceExit.unref()
    await Promise.all([emailWorker.close(),mediaWorker.close()])
    clearTimeout(forceExit)
    console.log("[worker] closed cleanly");
    process.exit(0)
}

process.on("SIGTERM",()=>void shutdown("SIGTERM"));
process.on("SIGINT",()=>void shutdown("SIGINT"));
