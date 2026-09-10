import type { Request, Response } from "express";
import { registeringValidation, updateValidation } from "./listing.validation.js";
import { BadRequestError} from "../../errors/Errors.js";
import { createListingService, deleteListingService, fetchAmenitiesService, imageUploadService, listingImageDeleteService, listingVideoDeleteService, listsFetchingService, SpecificListFetchingService, updateListingService, videoUploadService } from "./listing.service.js";


export const createListingPost=async(req:Request,res:Response)=>{
  const userId=req.user?.id as string;
  const validated=registeringValidation.safeParse(req.body)
  if(!validated.success) throw validated.error;
  const post=await createListingService(userId,validated.data)
  return res.status(201).json({message:"Post created successfully",post})
}

export const getAmentites=async(req:Request,res:Response)=>{
  const userId=req.user?.id as string;
  const amenities=await fetchAmenitiesService(userId)
  return res.status(200).json({message:"Amenities fetched successfully",amenities})
}

export const uploadListingImages=async(req:Request,res:Response)=>{
    const userId=req.user?.id as string;
    const listingId=req.params?.id as string;
    if(!listingId) throw new BadRequestError("listingId required")
    const images=req.files as Express.Multer.File[]
    if(images?.length===0) throw new BadRequestError("No Images to upload")
    const response=await imageUploadService(userId,listingId,images)
    return res.status(200).json({message:response})
}

export const uploadListingVideo=async(req:Request,res:Response)=>{
    const userId=req.user?.id as string;
    const listingId=req.params?.id as string;
    if(!listingId) throw new BadRequestError("listingId required")
    const video=req.file as Express.Multer.File;
    if(!video) throw new BadRequestError("No Video to upload")
    const response=await videoUploadService(userId,listingId,video)
    return res.status(200).json({message:response})
}

export const fetchListings=async(req:Request,res:Response)=>{
    const lists=await listsFetchingService()
    return res.status(200).json({message:"Listings fetched successfully",lists})
}

export const fetchSpecificListings=async(req:Request,res:Response)=>{
    const listId=req.params?.id as string
    if(!listId) throw new BadRequestError("listingId required")
    const lists=await SpecificListFetchingService(listId)
    return res.status(200).json({message:"Listings fetched successfully",lists})
}

export const deleteListingImage=async(req:Request,res:Response)=>{
    const userId=req.user?.id as string;
    const imageId=req.params.imageId as string;
    if(!imageId) throw new BadRequestError("Image Id required")
    const response=await listingImageDeleteService(userId,imageId)
    return res.status(200).json({message:response})
}

export const deleteListingVideo=async(req:Request,res:Response)=>{
    const userId=req.user?.id as string;
    const videoId=req.params.videoId as string;
    if(!videoId) throw new BadRequestError("Video Id required")
    const response=await listingVideoDeleteService(userId,videoId)
    return res.status(200).json({message:response})
}

export const deleteListing=async(req:Request,res:Response)=>{
    const userId=req.user?.id as string;
    const listingId=req.params.listingId as string;
    if(!listingId) throw new BadRequestError("Listing Id required")
    const response=await deleteListingService(userId,listingId)
    return res.status(200).json({message:response})
}

export const updateListing=async(req:Request,res:Response)=>{
    const userId=req.user?.id as string;
    const listingId=req.params.listingId as string;
    if(!listingId) throw new BadRequestError("Listing Id required")
    const validated=updateValidation.safeParse(req.body)
    if(!validated.success) throw validated.error
    const response=await updateListingService(userId,listingId,validated.data)
    return res.status(200).json({message:response})
}