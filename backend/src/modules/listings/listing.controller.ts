import {  type Request, type Response } from "express";
import { registeringValidation, updateValidation } from "./listing.validation.js";
import { BadRequestError, UnauthorizedError} from "../../errors/Errors.js";
import { createListingService, deleteListingService, fetchAmenitiesService, geoCodingService, imageFetchingService, imageUploadService, listingImageDeleteService, listingPublishingService, listingVideoDeleteService, listsFetchingService, OwnerListsFetchingService, OwnerSpecificListFetchingService, reverseGeoCodingService, searchService, SpecificListFetchingService, updateListingService, videoFetchingService, videoUploadService } from "./listing.service.js";
import type { ListingOrderBy } from "./listing.type.js";
import { accessTokenVerification } from "../../middlewares/jwtTokens.js";
import type { ListingType, PropertyType } from "../../generated/prisma/enums.js";
// import { parseSearch} from "../../lib/searchProcessing.js";


export const createListingPost=async(req:Request,res:Response)=>{
  const userId=req.user?.id as string;
  const validated=registeringValidation.safeParse(req.body)
  if(!validated.success) throw validated.error;
  const post=await createListingService(userId,validated.data)
  return res.status(201).json({message:"Post created successfully",post})
}
export const publishListing=async(req:Request,res:Response)=>{
     const userId=req.user?.id as string;
     const listingId=req.params?.id as string;
     if(!listingId) throw new BadRequestError("Listing Id required")
     const response=await listingPublishingService(userId,listingId)
    return res.status(200).json({message:response})
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

export const fetchListingImages=async(req:Request,res:Response)=>{
    const userId=req.user?.id as string;
    const listingId=req.params?.id as string;
    if(!listingId) throw new BadRequestError("listingId required")  
    const response=await imageFetchingService(userId,listingId)
    return res.status(200).json({message:"Images fetched Successfully",response})
}
export const fetchListingVideo=async(req:Request,res:Response)=>{
    const userId=req.user?.id as string;
    const listingId=req.params?.id as string;
    if(!listingId) throw new BadRequestError("listingId required")
    const response=await videoFetchingService(userId,listingId)
    return res.status(200).json({message:"Video fetched successfully",response})
}

export const fetchListings=async(req:Request,res:Response)=>{
    const page=Number(req.query?.page)|| 1;
    const { lists, total } = await listsFetchingService(page);
   return res.status(200).json({ message: "Listings fetched successfully", lists, total });
}

export const fetchOwnerListings=async(req:Request,res:Response)=>{
    const userId=req.user?.id as string;
    const price=req.query.price as string
    const status = req.query.status as string;
    const search=req.query.search as string
      const orderBy:ListingOrderBy=
     price === "asc"
      ? { price: "asc" }
      : price === "desc"
        ? { price: "desc" }
        : { updatedAt: "desc" };
    const page=Number(req.query.page) || 1
    const {response,total}=await OwnerListsFetchingService(userId,page,orderBy,status,search)
    return res.status(200).json({message:"Lists fetched successfully",lists: response, total})
}

// Public route: works for everyone. A valid token only adds the contact details.
export const fetchSpecificListings=async(req:Request,res:Response)=>{
    const slug=req.params?.id as string
    if(!slug) throw new BadRequestError("Listing Id required")
    const token=req.headers.authorization?.split(" ")[1]
    let userId:string|undefined
    if(token){
            userId=(await accessTokenVerification(token)).id as string
    }
    const lists=await SpecificListFetchingService(slug,userId)
    return res.status(200).json({message:"Listings fetched successfully",lists})
}
export const fetchOwnerSpecificListing=async(req:Request,res:Response)=>{
        const userId=req.user?.id as string;
        const listId=req.params?.id as string
        if(!userId) throw new UnauthorizedError("Unauthorized")
        if(!listId) throw new BadRequestError("Listing Id required")
        const response=await OwnerSpecificListFetchingService(userId,listId)
    return res.status(200).json({message:"List Fetched Successfully",response})
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

export const geoCode=async(req:Request,res:Response)=>{
    const street=req.query.street as string||undefined
    const city=req.query.city as string
    const state=req.query.state as string
    const country=req.query.country as string
    const postalcode=req.query.postalcode as string
 const response=await geoCodingService(street,city,state,country,postalcode)
 return res.status(200).json({message:"geoCoded Successfully",response})
}

export const reverseGeoCode=async(req:Request,res:Response)=>{
const lat=Number(req.query.lat);
const lon=Number(req.query.lon);
const response=await reverseGeoCodingService(lat,lon)
return res.status(200).json({message:"reverseGeoCoded successfully",response})
}

export const userSearch=async(req:Request,res:Response)=>{
    const listingType=req.query.listingType as ListingType;
    const propertyType=req.query.propertyType as PropertyType;
    const location=req.query.location as string;
    if(!location) throw new BadRequestError("Location required")
    console.log(listingType,propertyType,location);
    const result=await searchService(location,listingType,propertyType)
    return res.status(200).json({message:"Search results fetched successfully",lists:result})
}