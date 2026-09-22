import axios from "axios";
import { AlreadyExistError, BadRequestError, NotFoundError } from "../../errors/Errors.js";
import type { ListingType, Prisma, PropertyType } from "../../generated/prisma/client.js";
import { toSQFT } from "../../lib/area.js";
import { cdnUrl, deleteImage, deleteListingFiles, deleteVideo, uploadImage, uploadVideo, videoEmbedUrl } from "../../lib/bunny.js";
import { prisma } from "../../lib/prisma.js";
import type { CreateListingInput, UpdateListingInput } from "./listing.validation.js";
import redis from "../../lib/redis.js";
import { ListingStatus, type ListingOrderBy } from "./listing.type.js";
import type { ListingWhereInput } from "../../generated/prisma/models.js";
import { listNameSluggify } from "../../lib/slug.js";
import { boxAround, distanceKm } from "../../lib/geo.js";

export const createListingService=async(userId:string,data:CreateListingInput)=>{
const user=await prisma.user.findUnique({where:{id:userId}})
if(!user) throw new BadRequestError("Invalid Token")
const post=await prisma.listing.create({data:{
    title:data.title,
    slug:listNameSluggify(data.title),
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
    district:data.district,
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
export const listingPublishingService=async(userId:string,listingId:string)=>{
  const existingUser=await prisma.user.findUnique({where:{id:userId}})
  if(!existingUser) throw new BadRequestError("Invalid Token")
  const listing=await prisma.listing.findUnique({where:{id:listingId,ownerId:userId}})
  if(!listing) throw new NotFoundError("Listing not found")
  if(listing.status==='ACTIVE') throw new BadRequestError("Already Published")
  await prisma.listing.update({where:{id:listingId},data:{status:'ACTIVE'}})
  return 'Published successfully'
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
const listingVideo=await prisma.listingVideos.findUnique({where:{listingId}})
 if(listingVideo) throw new AlreadyExistError("This listing already has a video. Remove it first to upload a new one.")
 const id=await uploadVideo(video)
 await prisma.listingVideos.create({data:{videoId:id,listingId}})
return `video uploaded successfully`
}

export const imageFetchingService=async(userId:string,listingId:string)=>{
 const user=await prisma.user.findUnique({where:{id:userId}})
 if(!user) throw new BadRequestError("Invalid Token")
 const listing=await prisma.listing.findUnique({where:{id:listingId}})
 if(!listing) throw new NotFoundError("listing not found")
 if(listing.ownerId !== userId) return
 const response=await prisma.listingImages.findMany({where:{listingId,listing:{ownerId:userId}},select:{id:true,path:true,position:true}})
  response.forEach((img) => {
    img.path = cdnUrl(img.path);
  });
 return response;
}

export const videoFetchingService=async(userId:string,listingId:string)=>{
  const user=await prisma.user.findUnique({where:{id:userId}})
 if(!user) throw new BadRequestError("Invalid Token")
 const listing=await prisma.listing.findUnique({where:{id:listingId}})
 if(!listing) throw new NotFoundError("listing not found")
 if(listing.ownerId !== userId) return
 const response=await prisma.listingVideos.findMany({where:{listingId,listing:{ownerId:userId}},select:{id:true,videoId:true}})
 response.forEach((vid)=>{
  vid.videoId =videoEmbedUrl(vid.videoId)
 })
 return response
}

export const listsFetchingService = async (page: number) => {
  const take = 20;
  const where = { status: "ACTIVE" as const };   // only published listings are public

  const [lists, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take,
      skip: (page - 1) * take,
      select: {                                   // only what a card shows, nothing private
        slug:true, title: true, listingType: true, propertyType: true, price: true,
        locality: true, city: true, district: true, bedrooms: true, bathrooms: true,
        areaValue: true, areaUnit: true, createdAt: true, updatedAt: true, status: true,
        listingImages: { orderBy: { position: "asc" }, take: 1, select: { path: true } },
      },
    }),
    prisma.listing.count({ where }),
  ]);

  return {
    total,
    lists: lists.map((listing) => ({
      ...listing,
      listingImages: listing.listingImages.map((image) => ({ path: cdnUrl(image.path) })),
    })),
  };
};

export const OwnerListsFetchingService=async(userId:string,page:number,orderBy:ListingOrderBy,status?:string,search?:string)=>{
  const take=10;
  const skip=(page-1)*take
  const existingUser=await prisma.user.findUnique({where:{id:userId}})
  if(!existingUser) throw new BadRequestError("Invalid Token")
  const where:ListingWhereInput={
   ownerId:userId,
   ...(status && {
    status:status as ListingStatus
   }),
   ...(search && {
    OR:[
      {
        title:{
          contains:search,
          mode:"insensitive",
        }
      },
      {
        description: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        addressLine: {
          contains: search,
          mode: "insensitive",
        },
      },
      { locality: { contains: search, mode: "insensitive" } },
{ city: { contains: search, mode: "insensitive" } },
{ district: { contains: search, mode: "insensitive" } },
    ]
   })

  }
  const[response,total]=await Promise.all([
   prisma.listing.findMany({where,include:{listingImages:{where:{position:0},select:{path:true,position:true}}},take,skip,orderBy}),
   prisma.listing.count({where})
  ])
     response.forEach((res)=>{
    res.listingImages.forEach((img)=>{
        img.path=cdnUrl(img.path)
    })
  })
return {response,total}
}

export const SpecificListFetchingService=async(slug:string,userId?:string)=>{
const signedIn=userId ? Boolean(await prisma.user.findUnique({where:{id:userId},select:{id:true}})) : false
const listing=await prisma.listing.findUnique({
    where:{slug,status:'ACTIVE'},
    omit:{id:true,ownerId:true},
    include:{
        amenities:{select:{name:true,category:true}},
        listingImages:{orderBy:{position:"asc"},select:{path:true,position:true}},
        listingVideo:{select:{videoId:true}},
        owner:{select:{name:true}},
    },
})
if(!listing) throw new NotFoundError("Listing not found")
const {contactName,contactPhone,...publicFields}=listing
return {
    ...publicFields,
    ...(signedIn && {contactName,contactPhone}),
    listingImages:listing.listingImages.map((img)=>({
        position:img.position,
        path:cdnUrl(img.path),
    })),
    listingVideo:listing.listingVideo ? {url:videoEmbedUrl(listing.listingVideo.videoId)} : null
}
}
export const OwnerSpecificListFetchingService=async(userId:string,listingId:string)=>{
 const existingUSer=await prisma.user.findUnique({where:{id:userId}})
 if(!existingUSer) throw new BadRequestError("Invalid Token")
 const listing=await prisma.listing.findUnique({where:{id:listingId,ownerId:userId},include:{amenities:{select:{id:true,name:true,category:true}},listingImages:{orderBy:{position:"asc"},select:{id:true,path:true,position:true}},listingVideo:{select:{id:true,videoId:true}},owner:{select:{id:true,name:true}}}})
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


export const coordinates=(response:any[],postalcode:string)=>{
  if (response.length === 0) return null
    const matching = response.filter((result: any) => {
  return result.display_name.includes(postalcode);
});
if (matching.length>0) {
  return {
    lat: Number(matching[0].lat),
    lon: Number(matching[0].lon),
  };
}
else{
  return{
    lat:Number(response[0].lat),
    lon:Number(response[0].lon)
  }
}
}

export const geoCodingService=async(street:string|undefined,city:string,state:string,country:string,postalcode:string)=>{
   let response;
   const cached=await redis.get(`geoLocation:${street}|${city}|${state}|${postalcode}`)
   if(cached){
    console.log(JSON.parse(cached));
    
    return JSON.parse(cached)
   }
    response=await axios.get(process.env.NOMINATIM_SEARCH_API!,{
    headers:{"User-Agent":`real-estate-app/1.0(${process.env.NOMINATIM_CONTACT_EMAIL})`},
    timeout:5000,
    params:{street,city,state,country,postalcode,
    format:"jsonv2"
    },
  })
 if(response.data.length>0){
  const result=coordinates(response.data,postalcode)
  await redis.set(`geoLocation:${street}|${city}|${state}|${postalcode}`,JSON.stringify(result),{expiration:{type:'EX',value:60*60*24}})
  return result
  }
  if(response.data.length===0){
    response=await axios.get(process.env.NOMINATIM_SEARCH_API!,{
    headers:{"User-Agent":`real-estate-app/1.0(${process.env.NOMINATIM_CONTACT_EMAIL})`},
    timeout:5000,
    params:{country,postalcode,
    format:"jsonv2"
    },
  })
const result=coordinates(response.data,postalcode)
await redis.set(`geoLocation:${street}|${city}|${state}|${postalcode}`,JSON.stringify(result),{expiration:{type:'EX',value:60*60*24*5}})
return result
  }
}

export const reverseGeoCodingService=async(lat:number,lon:number)=>{
  const cached=await redis.get(`reverseGeo:${lat}|${lon}`)
  if(cached){
    return JSON.parse(cached)
  }
  const response=await axios.get(process.env.NOMINATIM_REVERSE_API!,{
    headers:{"User-Agent":`real-estate-app/1.0(${process.env.NOMINATIM_CONTACT_EMAIL})`},
    params:{
      lat:lat,
      lon:lon,
      format:"jsonv2"
    }
  })
  await redis.set(`reverseGeo:${lat}|${lon}`,JSON.stringify(response.data.address),{expiration:{type:"EX",value:60*60*24
  }})
  return response.data.address
}

export const searchService=async(location:string,type?:ListingType,property?:PropertyType)=>{
const km=10
const response=await axios.get(process.env.NOMINATIM_SEARCH_API!,{
    headers:{"User-Agent":`real-estate-app/1.0(${process.env.NOMINATIM_CONTACT_EMAIL})`},
    timeout:5000,
    params:{q:location,
    format:"jsonv2"
}})
const result = response.data[0];
if (!result) return [];
const lat = Number(result.lat);
const long = Number(result.lon);

const where:ListingWhereInput=({
  status:ListingStatus.ACTIVE,
  ...(type && {
    listingType:type
  }),
  ...(property && {
    propertyType:property
  }),
  OR: [
  boxAround(lat, long, km),                                      
  { locality: { contains: location, mode: "insensitive" } },     
  { city: { contains: location, mode: "insensitive" } },
  { district: { contains: location, mode: "insensitive" } },
],
})

const listings=await prisma.listing.findMany({where,select: {
  slug: true,
  title: true,
  price: true,
  district:true,
  listingType: true,
  propertyType: true,
  locality: true,
  city: true,
  bedrooms: true,
  bathrooms: true,
  areaValue: true,
  areaUnit: true,
  latitude: true,
  longitude: true,
  listingImages: { orderBy: { position: "asc" }, take: 1, select: { path: true } },
}})
const final_result=listings.map((list)=>({
  ...list,
  distanceKm:distanceKm(lat,long,list.latitude!,list.longitude!),
  listingImages: list.listingImages.map((image) => ({ path: cdnUrl(image.path) })),
})).filter((list)=>list.distanceKm<=km)
   .sort((a,b)=>a.distanceKm - b.distanceKm)
return final_result
}