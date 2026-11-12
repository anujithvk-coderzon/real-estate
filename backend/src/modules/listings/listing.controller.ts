import {  type Request, type Response } from "express";
import { availabilityValidation, listTake, registeringValidation, searchPoint, searchRadius, updateValidation } from "./listing.validation.js";
import { BadRequestError, NotFoundError, UnauthorizedError} from "../../errors/Errors.js";
import { listingAvailabilityService, sellerListsFetchingService, createListingService, deleteListingService, fetchAmenitiesService, geoCodingService, imageFetchingService, imageUploadService, listingImageDeleteService, listingPublishingService, listingVideoDeleteService, listsFetchingService, OwnerListsFetchingService, OwnerSpecificListFetchingService, reverseGeoCodingService, searchService, SpecificListFetchingService, updateListingService, videoFetchingService, videoUploadService, similarListingService, complaintListingService, contactFetchingService } from "./listing.service.js";
import type { ListingOrderBy } from "./listing.type.js";
import { accessTokenVerification } from "../../middlewares/jwtTokens.js";
import type { ListingType, PostedBy, PropertyType } from "../../generated/prisma/enums.js";
import { validateSize } from "../../lib/multer.js";
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
export const setListingAvailability=async(req:Request,res:Response)=>{
     const userId=req.user?.id as string;
     const listingId=req.params?.id as string;
     if(!listingId) throw new BadRequestError("Listing Id required")
     const validated=availabilityValidation.safeParse(req.body)
     if(!validated.success) throw validated.error;
     const response=await listingAvailabilityService(userId,listingId,validated.data.status)
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
    const images=req.files as Express.Multer.File[] | undefined
    if(!images || images.length===0) throw new BadRequestError("No Images to upload")
    validateSize(images)
    const response=await imageUploadService(userId,listingId,images)
    return res.status(200).json({message:response})
}

export const uploadListingVideo=async(req:Request,res:Response)=>{
    const userId=req.user?.id as string;
    const listingId=req.params?.id as string;
    if(!listingId) throw new BadRequestError("listingId required")
    const video=req.file as Express.Multer.File;
    if(!video) throw new BadRequestError("No Video to upload")
    validateSize([video])
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
    // Not a cast: this is the one parameter that makes the query bigger rather
    // than smaller, so an unparsed value is a table scan.
    const take=listTake.safeParse(req.query.take)
    if(!take.success) throw take.error
    const filters = {
    listingType: req.query.listingType as ListingType | undefined,
    propertyType: req.query.propertyType as PropertyType | undefined,
    postedBy: req.query.postedBy as PostedBy | undefined,
    maxPrice: req.query.maxPrice ? Number(req.query.maxPrice) : undefined,
    beds: req.query.beds ? Number(req.query.beds) : undefined,
    sort: req.query.sort as string | undefined,
    take: take.data,
  };
    const { lists, total } = await listsFetchingService(page,filters);
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
    const postalcode=req.query.postalcode as string
 const response=await geoCodingService(street,city,state,postalcode)
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
    const radius=searchRadius.safeParse(req.query.radius)
    if(!radius.success) throw radius.error

    // lat/lon come from the visitor's own device, and when they are here they
    // win: a coordinate is the position, a place name is only a description of
    // it. Geocoding the name instead measured every distance from the named
    // area's centroid, which is how a listing 25 km away came back as 2.4 km.
    //
    // Both or neither — one alone is not a point. A name is still required when
    // there is no point, so every link that worked before this still works.
    const given=req.query.lat!==undefined && req.query.lon!==undefined
    const point=given
      ? searchPoint.parse({lat:req.query.lat,lon:req.query.lon})
      : undefined
    if(!point && !location) throw new BadRequestError("Location required")

    const {listings,center}=await searchService(location,radius.data,listingType,propertyType,point)
    return res.status(200).json({message:"Search results fetched successfully",lists:listings,center})
}

export const fetchSellerListings=async(req:Request,res:Response)=>{
    const slug=req.params?.slug as string
    if(!slug) throw new BadRequestError("Profile not found")
    const page=Number(req.query.page) || 1;
    const {lists,total}=await sellerListsFetchingService(slug,page)
    return res.status(200).json({message:"Listings fetched successfully",lists,total})
}

export const similarListings=async(req:Request,res:Response)=>{
    const slug=req.params.slug as string
    const page=Number(req.query.page)||1
    const result=await similarListingService(slug,page)
    res.status(200).json({message:"Similar listings fetched ",result})
}
export const complaintListing=async(req:Request,res:Response)=>{
    const userId=req.user?.id as string;
    const slug=req.params.slug as string;
    if(!slug) throw new BadRequestError("Listing not found")
    const title=typeof req.body?.title==="string" ? req.body.title.trim() : ""
    const body=typeof req.body?.body==="string" ? req.body.body.trim() : ""
    if(!title || !body) throw new BadRequestError("Say what is wrong, and give us the detail")
    if(title.length>120) throw new BadRequestError("That reason is too long")
    if(body.length<15) throw new BadRequestError("Tell us a little more — one line at least")
    if(body.length>1000) throw new BadRequestError("Keep it under 1000 characters")
    const response=await complaintListingService(userId,slug,title,body)
    return res.status(201).json({message:response})
}

export const contactFetching=async(req:Request,res:Response)=>{
    const userId=req.user?.id as string;
    const slug=req.params.slug as string;
    if(!slug) throw new NotFoundError("Slug required")
    const number=await contactFetchingService(userId,slug)
    return res.status(200).json({message:"Contact fetched",number})
}