import { InternalServerError } from "../errors/Errors.js"

const BUNNY_IMAGE_HOST='sg.storage.bunnycdn.com'
const BUNNY_VIDEO_HOST='video.bunnycdn.com'
const BUNNY_STORAGE=process.env.BUNNY_STORAGE
const BUNNY_PULL_ZONE=process.env.BUNNY_PULL_ZONE
const BUNNY_API_KEY=process.env.BUNNY_API_KEY
const BUNNY_STREAM_LIBRARY_ID=process.env.BUNNY_STREAM_LIBRARY_ID
const BUNNY_STREAM_API_KEY=process.env.BUNNY_STREAM_API_KEY


const storageUrl=(path:string)=>{
    return `https://${BUNNY_IMAGE_HOST}/${BUNNY_STORAGE}/${path}`
}
export const cdnUrl=(path:string)=>`https://${BUNNY_PULL_ZONE}/${path}`




type UploadFile ={
    buffer:Buffer,
    mimetype:string,
    originalname:string
}

export const uploadImage=async(listiningId:string,file:UploadFile)=>{
    const safe=file.originalname.replace(/[^a-zA-Z0-9._-]/g,"_");
    const path=`properties/${listiningId}/images/${Date.now()}-${safe}`;
    const res=await fetch(storageUrl(path),{
        method:"PUT",
        headers:{AccessKey:BUNNY_API_KEY!,"Content-Type":file.mimetype},
        body:new Uint8Array(file.buffer),
        signal:AbortSignal.timeout(30_000)
    })
    if(!res.ok) throw new InternalServerError(`Bunny upload failed (${res.status})`)
    return path;
}

export const deleteImage=async(path:string)=>{
    const res=await fetch(storageUrl(path),{
        method:"DELETE",
        headers:{AccessKey:BUNNY_API_KEY!},
        signal:AbortSignal.timeout(30_000)
    });
    if(!res.ok && res.status!==404) throw new InternalServerError(`Bunny delete failed (${res.status})`)
};

export const deleteListingFiles=async(listingId:string)=>{
    const res=await fetch(storageUrl(`properties/${listingId}/`),{
        method:"DELETE",
        headers:{AccessKey: BUNNY_API_KEY!},
        signal:AbortSignal.timeout(30_000)
    });
    if(!res.ok && res.status!==404) throw new InternalServerError(`Bunny folder delete failed (${res.status})`);
}




const streamUrl=(id = "")=>`https://${BUNNY_VIDEO_HOST}/library/${BUNNY_STREAM_LIBRARY_ID}/videos/${id}`;
export const videoEmbedUrl=(videoId:string)=>`https://iframe.mediadelivery.net/embed/${BUNNY_STREAM_LIBRARY_ID}/${videoId}`

export const deleteVideo=async(videoId:string)=>{
    const res=await fetch(streamUrl(videoId),{
        method:"DELETE",
        headers:{AccessKey:BUNNY_STREAM_API_KEY!},
        signal:AbortSignal.timeout(30_000)
    });
    if(!res.ok && res.status!==404) throw new InternalServerError(`Bunny delete failed (${res.status})`)
};

export const uploadVideo=async(file:UploadFile)=>{
    const title=`${file.originalname}-${Date.now()}`
    const create=await fetch(streamUrl(),{
        method:"POST",
        headers:{AccessKey:BUNNY_STREAM_API_KEY!,"Content-Type":"application/json"},
        body: JSON.stringify({title}),
        signal:AbortSignal.timeout(120_000)
    })
    if(!create.ok) throw new InternalServerError(`Bunny createVideo failed (${create.status})`)
    const{guid}=await create.json()
    const upload=await fetch(streamUrl(guid),{
        method:"PUT",
        headers:{AccessKey:BUNNY_STREAM_API_KEY!},
        body:new Uint8Array(file.buffer),
        signal:AbortSignal.timeout(120_000)
    })
    if(!upload.ok){
        await deleteVideo(guid).catch(()=>{});
        throw new InternalServerError(`Bunny upload video failed (${upload.status})`)
    }
    return guid;
}