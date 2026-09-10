import { BadRequestError, NotFoundError } from "../../errors/Errors.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { toSQFT } from "../../lib/area.js";
import { cdnUrl, deleteImage, deleteListingFiles, deleteVideo, uploadImage, uploadVideo, videoEmbedUrl } from "../../lib/bunny.js";
import { prisma } from "../../lib/prisma.js";
import type { CreateListingInput, UpdateListingInput } from "./listing.validation.js";

export const createListingService=async(userId:string,data:CreateListingInput)=>{
const user=await prisma.user.findUnique({where:{id:userId}})
if(!user) throw new BadRequestError("Invalid Token")
const post=await prisma.listing.create({data:{
    title:data.title,
    ownerId:userId,
    description:data.description,
    propertyType:data.propertyType,
    listingType:data.listingType,
    postedBy:data.postedBy,
    price:data.price,
    isNegotiable:data.isNegotiable,
    securityDeposit:data.securityDeposit ?? null,
    maintenance:data.maintenance ?? null,
    areaValue:data.areaValue,
    areaUnit:data.areaUnit,
    areaSqft:toSQFT(data.areaValue,data.areaUnit),
    bedrooms:data.bedrooms??null,
    bathrooms:data.bathrooms??null,
    balconies:data.balconies??null,
    furnishing:data.furnishing??null,
    floorNumber:data.floorNumber??null,
    totalFloors:data.totalFloors??null,
    propertyStatus:data.propertyStatus??null,
    availableFrom:data.availableFrom??null,
    addressLine:data.addressLine,
    landmark:data.landmark??null,
    locality:data.locality,
    city:data.city,
    state:data.state,
    pincode:data.pincode,
    latitude:data.latitude??null,
    longitude:data.longitude??null,
    contactName:data.contactName??null,
    contactPhone:data.contactPhone??null,
    ...(data.amenityIds?.length && 
    {amenities: {connect:data.amenityIds.map((id)=>({id}))}})
    },
    select:{id:true,title:true,description:true}
})
return post
}

export const updateListingService=async(userId:string,listingId:string,newData:UpdateListingInput)=>{
 const user=await prisma.user.findUnique({where:{id:userId}})
 if(!user) throw new BadRequestError("Invalid Token")
 const listing=await prisma.listing.findUnique({where:{id:listingId,ownerId:userId}})
 if(!listing) throw new NotFoundError("Listing not found")
 const areaValue=newData.areaValue ?? Number(listing.areaValue);
 const areaUnit=newData.areaUnit ?? listing.areaUnit;
 const {amenityIds,...fields}=newData
 const updated=await prisma.listing.update({
  where:{id:listingId},
  data:{
    ...fields,
    ...(newData.areaValue!==undefined || newData.areaUnit!==undefined
      ? {areaSqft:toSQFT(areaValue,areaUnit) }:{}),
    ...(amenityIds&&{
      amenities:{set:amenityIds.map((id)=>({id}))},
    }),
  } as Prisma.ListingUpdateInput,
  select:{id:true,title:true,description:true}
 })
 return updated
}

export const fetchAmenitiesService=async(userId:string)=>{
    const user=await prisma.user.findUnique({where:{id:userId}})
    if(!user) throw new BadRequestError("Invalid Token")
    const amenities=await prisma.amenity.findMany({select:{id:true,name:true,category:true}})
    return amenities
}

export const imageUploadService=async(userId:string,listingId:string,images:Express.Multer.File[])=>{
 const user=await prisma.user.findUnique({where:{id:userId}})
 if(!user) throw new BadRequestError("Invalid Token")
 const listing=await prisma.listing.findUnique({where:{id:listingId}})
 if(!listing) throw new NotFoundError("listing not found")
 if(listing.ownerId !== userId) throw new BadRequestError("You can only add images to your own listings")
 const listingVideo=await prisma.listingVideos.findFirst({where:{listingId}})
 const existingCount = await prisma.listingImages.count({ where: { listingId } });
 const maxImages = listingVideo ? 9 : 10;
 const remaining = maxImages - existingCount;
if (images.length > remaining) {
  throw new BadRequestError(
    remaining <= 0
      ? listingVideo
        ? "This listing already has 1 video and 9 images — the 10 media limit is reached."
        : "This listing already has 10 images — the limit is reached."
      : listingVideo
        ? `A listing allows 10 media items in total. You have 1 video and ${existingCount} image(s), so you can add ${remaining} more.`
        : `A listing allows up to 10 images. You have ${existingCount}, so you can add ${remaining} more.`,
  );
}
 const lastImage = await prisma.listingImages.findFirst({
    where: { listingId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  let position = (lastImage?.position ?? -1) + 1;

 for(const image of images){
 const url=await uploadImage(listingId,image)
 await prisma.listingImages.create({data:{path:url,listingId,position}})
 position++;
}
return `images uploaded successfully`
}

export const videoUploadService=async(userId:string,listingId:string,video:Express.Multer.File)=>{
 const user=await prisma.user.findUnique({where:{id:userId}})
 if(!user) throw new BadRequestError("Invalid Token")
 const listing=await prisma.listing.findUnique({where:{id:listingId}})
 if(!listing) throw new NotFoundError("Listing not found")
 if(listing.ownerId !== userId) throw new BadRequestError("You can only add images to your own listings")
 const id=await uploadVideo(video)
 await prisma.listingVideos.create({data:{videoId:id,listingId}})
return `video uploaded successfully`
}

export const listsFetchingService=async()=>{
const lists=await prisma.listing.findMany({orderBy:{createdAt:'desc'}})
return lists
}

export const SpecificListFetchingService=async(id:string)=>{
const listing=await prisma.listing.findUnique({where:{id},include:{amenities:{select:{id:true,name:true,category:true}},listingImages:{orderBy:{position:"asc"},select:{id:true,path:true,position:true}},listingVideo:{select:{id:true,videoId:true}},owner:{select:{id:true,name:true}}}})
if(!listing) throw new NotFoundError("Listing not found")
return {
    ...listing,
    listingImages:listing.listingImages.map((img)=>({
        id:img.id,
        position:img.position,
        path:cdnUrl(img.path),
    })),
    listingVideo:listing.listingVideo ? {id:listing.listingVideo.id,url:videoEmbedUrl(listing.listingVideo?.videoId)} : null
}
}

export const listingImageDeleteService=async(userId:string,imageId:string)=>{
  const user=await prisma.user.findUnique({where:{id:userId}})
 if(!user) throw new BadRequestError("Invalid Token")
  const listingImage=await prisma.listingImages.findUnique({where:{id:imageId,listing:{ownerId:userId}}})
  if(!listingImage) throw new NotFoundError("Image not found")
  await prisma.listingImages.delete({where:{id:imageId}})
  await deleteImage(listingImage.path)
  return 'Image deleted successfully'
}

export const listingVideoDeleteService=async(userId:string,videoId:string)=>{
   const user=await prisma.user.findUnique({where:{id:userId}})
 if(!user) throw new BadRequestError("Invalid Token")
  const listingVideo=await prisma.listingVideos.findUnique({where:{id:videoId,listing:{ownerId:userId}}})
  if(!listingVideo) throw new NotFoundError("Video not found")
  await prisma.listingVideos.delete({where:{id:videoId}})
  await deleteVideo(listingVideo.videoId)
  return 'Video deleted successfully'
}

export const deleteListingService=async(userId:string,listingId:string)=>{
   const user=await prisma.user.findUnique({where:{id:userId}})
   if(!user) throw new BadRequestError("Invalid Token")
   const listing=await prisma.listing.findUnique({where:{id:listingId,ownerId:userId},include:{listingVideo:{select:{videoId:true}}}})
   if(!listing) throw new NotFoundError("Listing not found") 
   await prisma.listing.delete({where:{id:listingId}})
   await deleteListingFiles(listing.id)
   if(listing.listingVideo?.videoId){
     await deleteVideo(listing.listingVideo.videoId)
   }
   return 'Listing deleted successfully'
}
