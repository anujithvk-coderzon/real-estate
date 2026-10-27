import type { Request, Response } from "express";
import { BadRequestError } from "../../errors/Errors.js";
import { allPromotionService, myPromotionsService, promotionCreationService } from "./promotion.service.js";

const BANNER_TYPE=["image/jpeg","image/png","image/webp"]
const MAX_BANNER_BYTES=10*1024*1024
type FeaturedTarget=| {type:'ListingId',id:string}| {type:'ProjectId',id:string}

export const createPromotion=async(req:Request,res:Response)=>{
    const userId=req.user?.id as string;
    const image=req.file;
    let id:FeaturedTarget
    const listingId=req.query.listingId as string;
    const projectId=req.query.projectId as string;
    if (!listingId && !projectId) throw new BadRequestError("listingId or projectId is required")
    if (listingId && projectId)  throw new BadRequestError("Give one of listingId or projectId")
    if(listingId){
        id={
            type:'ListingId',
            id:listingId
        }
    }
    else{
        id={
            type:'ProjectId',
            id:projectId
        }
    }
    if(!image) throw new BadRequestError("Image required")
    if(!BANNER_TYPE.includes(image?.mimetype)) throw new BadRequestError("Banner photo must be JPG, PNG or WebP")
    if(image.size>MAX_BANNER_BYTES) throw new BadRequestError("Banner photo must be under 10 MB")
    const response=await promotionCreationService(userId,image,id)
    return res.status(201).json({message:response})
}

export const myPromotions=async(req:Request,res:Response)=>{
    const userId=req.user?.id as string
    const promotions=await myPromotionsService(userId)
    return res.status(200).json({message:"successfull",promotions})
}

export const allPromotions=async(req:Request,res:Response)=>{
    const type=req.query.type
   if (typeof type !== "string") {
     throw new BadRequestError("type required")
     } 
   if (type !== "true" && type !== "false") { 
    throw new BadRequestError("type must be true or false")
     }
    const promotions=await allPromotionService(type === "true")
    return res.status(200).json({message:"promotions fetched",promotions})
}