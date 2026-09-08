import multer from 'multer'
import { BadRequestError } from '../errors/Errors.js'
const ALLOWED_IMAGES=["image/jpeg","image/png","image/webp"]
const ALLOWED_VIDEOS=["video/mp4","video/webm"]

const ALLOWED=[...ALLOWED_IMAGES,...ALLOWED_VIDEOS]

export const upload=multer({
    storage:multer.memoryStorage(),
    limits:{
        fileSize:30*1024*1024,//10MB
        files:10
    },
    fileFilter:(_req,file,cb)=>{
        if(!ALLOWED.includes(file.mimetype)){
             return cb(new BadRequestError("Only JPEG, PNG and WebP images and MP4/WebM videos are allowed"))
        }
        cb(null,true)
    }

})
const ALLOWED_IMAGE_SIZE=10*1024*1024
const MAX_ALLOWED_PER_PROPERTY=60*1024*1024
export const validateSize=(files:Express.Multer.File[])=>{
    let videoCount=0;
    let maxAllowed=0;
    for(const file of files){
        maxAllowed+=file.size;
        if(ALLOWED_IMAGES.includes(file.mimetype)){
            if(file.size>ALLOWED_IMAGE_SIZE){
                throw new BadRequestError(`${file.originalname} exceeds 10 Mb`)
            }
            continue
        }
        if(ALLOWED_VIDEOS.includes(file.mimetype)){
            videoCount++;
            if(videoCount>1){
                throw new BadRequestError('Only one video is allowed')
            }
            continue
        }
        throw new BadRequestError(`Unsupported file type:${file.mimetype}`)
    }
    if(maxAllowed>MAX_ALLOWED_PER_PROPERTY) throw new BadRequestError("Total upload size exceeds 60MB")
}
