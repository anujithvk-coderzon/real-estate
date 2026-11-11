import axios from "axios";
import { AlreadyExistError, BadRequestError, NotFoundError } from "../../errors/Errors.js";
import { PropertyType, type ListingType, type PostedBy, type Prisma, type ProjectReraAbsence, type VerificationStatus } from "../../generated/prisma/client.js";
import { toSQFT } from "../../lib/area.js";
import { avatarPublicUrl, cdnUrl, uploadImage, uploadVideo, videoEmbedUrl } from "../../lib/bunny.js";
import { prisma } from "../../lib/prisma.js";
import type { CreateListingInput, SearchPoint, UpdateListingInput } from "./listing.validation.js";
import redis from "../../lib/redis.js";
import { ListingStatus, type ListingOrderBy } from "./listing.type.js";
import type { ListingWhereInput } from "../../generated/prisma/models.js";
import { listNameSluggify } from "../../lib/slug.js";
import { boxAround, distanceKm } from "../../lib/geo.js";
import { queueMediaCleanup } from "../../queues/media.queue.js";

export const createListingService=async(userId:string,data:CreateListingInput)=>{
const user=await prisma.user.findUnique({where:{id:userId}})
if(!user) throw new BadRequestError("Invalid Token")
const sellerSale=(data.postedBy==="BUILDER" || data.postedBy==="BROKER") && data.listingType==="SALE"
const offPlan=sellerSale && data.propertyStatus==="UNDER_CONSTRUCTION"
if(data.projectId && data.projectNameText){
  throw new BadRequestError("Choose the project from our records, or type its name, not both")
}
if(data.projectId){
  const where=user.accountType==="BUILDER"
    ? {id:data.projectId,builderId:userId}
    : {id:data.projectId}
  const project=await prisma.project.findFirst({where,select:{reraNumber:true,isReraExempt:true}})
  if(!project) throw new NotFoundError("Project not found")
  if(offPlan && !project.reraNumber && !project.isReraExempt){
    throw new BadRequestError("This project has no RERA registration number. Add it to the project before advertising a unit under construction.")
  }
}

if(data.projectNameText && !data.projectReraText && !data.projectReraAbsence){
  throw new BadRequestError("Give the project's RERA registration number, or say why it does not have one")
}
// Off-plan is the case the Act forbids advertising without a registration, so
// here a stated reason is not an answer — only the number is.
if(offPlan && data.projectNameText && !data.projectReraText){
  throw new BadRequestError("An under-construction project must be registered with RERA, and the advertisement has to carry its number")
}
if(data.projectNameText && !data.builderNameText){
  throw new BadRequestError("Give the name of the builder of this project")
}

if(offPlan && !data.projectId && !data.projectNameText){
  throw new BadRequestError("An under-construction unit must name its project. Choose it from our records, or type its name and RERA number.")
}

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
    projectId:data.projectId??null,
    projectNameText:data.projectId ? null : (data.projectNameText??null),
    projectReraText:data.projectId ? null : (data.projectReraText??null),
    // Cleared when a number was given, so the two can never disagree on the page.
    projectReraAbsence:data.projectId||data.projectReraText ? null : (data.projectReraAbsence??null),
    builderNameText:data.projectId ? null : (data.builderNameText??null),
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
    contactPhoneVisibility:data.contactPhoneVisibility,
    contactWatsappVisibility:data.contactWatsappVisibility,
    contactInappVisibility:data.contactInappVisibility,
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
  // A hole that predates the approval queue and is worth naming: this endpoint
  // only refused a listing that was already ACTIVE, so the owner of a listing
  // an operator had TAKEN_DOWN could call it and put the listing straight back
  // into search. listingAvailabilityService guards that state explicitly and
  // this one did not, which made the guard next door decorative - there were
  // two roads into ACTIVE and only one of them was watched.
  //
  // EXPIRED is deliberately NOT refused here. Re-publishing is exactly how an
  // expired listing is meant to come back, and the availability endpoint's own
  // error message tells sellers to do it.
  if(listing.status==='TAKEN_DOWN'){
    throw new BadRequestError("Our team removed this listing after a report. The reason was sent to you in a notification \u2014 it cannot be published again from here")
  }
  if(!listing.contactPhone || !listing.contactName){
    throw new BadRequestError("Add a contact name and phone number before publishing \u2014 buyers have no other way to reach you")
  }
  // Approval does NOT gate this, deliberately, and it is worth saying why
  // because an earlier version of this code did gate it.
  //
  // Blocking the button means the seller finishes the work and then waits on
  // us for the one thing they came here to do. The listing is worth nothing to
  // them in that state and nothing to a buyer either, and every hour of the
  // queue's backlog is an hour of a property that cannot be found. What the
  // audit actually protects against lives in the MEDIA - a photograph lifted
  // off another site, a watermark, a phone number painted across the picture -
  // so the media is what waits, and the listing goes live now.
  //
  // See docs/adr/0003 for what is given up by letting the text through
  // unread.
  const [pendingImages,video]=await Promise.all([
    prisma.listingImages.count({where:{listingId,approved:false}}),
    prisma.listingVideos.findUnique({where:{listingId},select:{approved:true}}),
  ])
  const pendingVideo=video!==null && !video.approved
  const waiting=pendingImages+(pendingVideo ? 1 : 0)

  await prisma.listing.update({where:{id:listingId},data:{status:'ACTIVE'}})

  if(waiting===0) return 'Published. Buyers can find it in search now'

  // Said twice on purpose: once as the toast on the button they just pressed,
  // and once as a notification that is still there tomorrow. A seller who
  // publishes, sees no photographs on their live listing and has only a toast
  // that vanished after four seconds is a seller who thinks the upload failed.
  const what=pendingImages>0 && pendingVideo
    ? `${pendingImages} photo${pendingImages===1 ? '' : 's'} and the video`
    : pendingVideo
      ? 'the video'
      : `${pendingImages} photo${pendingImages===1 ? '' : 's'}`

  await prisma.notification.create({data:{
    userId,
    title:"Photos Being Checked",
    body:`${listing.title} is live and buyers can find it in search. Somebody is checking ${what} before they are shown \u2014 the listing is up either way, and we will tell you the moment they go on.`,
    type:"LISTING_MEDIA_PENDING",
  }})

  return `Published. Buyers can find it in search now \u2014 ${what} will show once our team has checked ${pendingImages===1 && !pendingVideo ? 'it' : 'them'}`
}

// Every availability change an owner is allowed to make. One endpoint rather
// than a status field on update: a PATCH that can quietly carry `status` beside
// forty other fields is a PATCH where nobody can see who closed a listing or
// why. See docs/adr/0002-listing-availability-status.md.
export const listingAvailabilityService=async(userId:string,listingId:string,status:'ACTIVE'|'SOLD'|'RENTED'|'DRAFT')=>{
  const user=await prisma.user.findUnique({where:{id:userId},select:{id:true}})
  if(!user) throw new BadRequestError("Invalid Token")
  const listing=await prisma.listing.findUnique({
    where:{id:listingId,ownerId:userId},
    select:{status:true,listingType:true,contactName:true,contactPhone:true},
  })
  if(!listing) throw new NotFoundError("Listing not found")

  // Where the listing stands decides whether it may move at all. Each of these
  // is a state the owner does not own: a draft leaves only by publishing, which
  // checks photos and a pin first; the other two were not theirs to begin with.
  // Leaving DRAFT is publishing, and publishing is /publish/:id: it refuses a
  // listing with no contact details, and this endpoint must not be a way round
  // that. Entering DRAFT is allowed, below.
  if(listing.status==='DRAFT') throw new BadRequestError("Publish this listing before changing whether it is available")
  if(listing.status==='EXPIRED') throw new BadRequestError("This listing has expired. Edit it and publish it again")
  if(listing.status==='TAKEN_DOWN') throw new BadRequestError("Our team removed this listing after a report. The reason was sent to you in a notification")

  // SALE ends as SOLD, RENT and PG as RENTED. The UI derives this and never
  // offers the wrong word, but a UI is not a constraint: without this check a
  // crafted request can mark a hostel sold, and the day that happens neither
  // status means anything.
  const closed=listing.listingType==='SALE' ? 'SOLD' : 'RENTED'
  if(status!=='ACTIVE' && status!=='DRAFT' && status!==closed){
    throw new BadRequestError(listing.listingType==='SALE'
      ? "A property for sale can only be marked sold"
      : "A property to rent can only be marked rented")
  }

  // Reopening republishes it, so it has to clear the same bar publishing does.
  // An edit can empty these columns, which would otherwise put a listing back
  // in search with no way to reach the seller.
  if(status==='ACTIVE' && (!listing.contactName || !listing.contactPhone)){
    throw new BadRequestError("Add a contact name and phone number before making this available again \u2014 buyers have no other way to reach you")
  }
  // No approval bar here. Reopening is the same act as publishing, and
  // publishing is not gated - each photograph carries the gate on its own row,
  // so whichever road a listing takes back into search its unapproved ones
  // stay hidden without this endpoint knowing anything about them.

  if(status===listing.status){
    return status==='ACTIVE' ? 'This listing is already available' : 'This listing is already closed'
  }

  await prisma.listing.update({where:{id:listingId},data:{status}})
  if(status==='DRAFT') return 'Unlisted. Its page no longer opens for anyone, and it is back in your drafts'
  return status==='ACTIVE'
    ? 'Back in search. Buyers can contact you about it again'
    : status==='SOLD'
      ? 'Marked as sold and removed from search'
      : 'Marked as rented and removed from search'
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
 // select, not a bare findFirst: this only needs to know WHETHER a video
 // exists, and a full row drags in every column the client knows about —
 // which is how a photo upload came to depend on listing_videos.reviewNote.
 const listingVideo=await prisma.listingVideos.findFirst({where:{listingId},select:{id:true}})
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
 // select, because a bare create RETURNs every column of the row - which
 // includes `approved` and `reviewNote`. If the database is a migration
 // behind the generated client, that RETURNING clause is what fails (P2022),
 // and it fails on an INSERT that would otherwise have been fine.
 await prisma.listingImages.create({data:{path:url,listingId,position},select:{id:true}})
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
 type filterType = {
    listingType:  ListingType | undefined,
    propertyType: PropertyType | undefined,
    postedBy:  PostedBy | undefined,
    maxPrice: number | undefined,
    beds: number | undefined,
    sort:  string | undefined,
    // Already validated and capped by listTake, so the service can trust it.
    take: number,
  };

const rentCoversPg = (type: ListingType) =>
  type === "RENT" ? { in: ["RENT", "PG"] as ListingType[] } : type;

export const listsFetchingService = async (page: number,filters:filterType) => {
  const {listingType, propertyType, postedBy, maxPrice, beds, sort, take} =filters 
  const where = { status: "ACTIVE" as const ,
    ...(listingType && { listingType: rentCoversPg(listingType) }),
    ...(propertyType && { propertyType }),
    ...(postedBy && { postedBy }),
    ...(maxPrice && { price: { lte: maxPrice } }),
    ...(beds && { bedrooms: { gte: beds } }),
  };  
  const orderBy: Prisma.ListingOrderByWithRelationInput[] =
    sort === "price-asc"  ? [{ price: "asc"  }, { id: "asc" }] :
    sort === "price-desc" ? [{ price: "desc" }, { id: "asc" }] :
                            [{ createdAt: "desc" }, { id: "asc" }]; 
  const [lists, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      orderBy,
      take,
      skip: (page - 1) * take,
      select: {                                   // only what a card shows, nothing private
        slug:true, title: true, listingType: true, propertyType: true, price: true,
        locality: true, city: true, district: true, bedrooms: true, bathrooms: true,
        areaValue: true, areaUnit: true, createdAt: true, updatedAt: true, status: true,
        postedBy: true,                           // the card says who listed it
        // approved only, on every public read of this table. The filter is
        // repeated at each call site rather than hidden in a helper because
        // forgetting it here does not fail, it LEAKS - an unread photograph
        // appears on the site and nothing in any log says so.
        listingImages: { where: { approved: true }, orderBy: { position: "asc" }, select: { path: true } },owner:{select:{agentReraStatus:true}}
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
   // NOT filtered on approved: this is the seller's own list, and a seller
   // whose card went blank because their photo is in a queue would reasonably
   // conclude the upload had failed and do it again.
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

const projectClaim=(listing:{
  postedBy:PostedBy
  projectNameText:string|null
  projectReraText:string|null
  projectReraAbsence:ProjectReraAbsence|null
  builderNameText:string|null
  project:{name:string,slug:string|null,reraNumber:string|null,reraStatus:VerificationStatus,
           isReraExempt:boolean,reraVerifiedReason:string|null,reraVerifiedAt:Date|null,
           builder:{name:string,slug:string|null}}|null
})=>{
  if(listing.project){
    const {project}=listing
    return {
      name:project.name,
      slug:project.slug,
      reraNumber:project.reraNumber,
      reraStatus:project.reraStatus,
      isReraExempt:project.isReraExempt,
      // As with the agent's: only an approval is public, and the column holds
      // whichever decision came last.
      reraVerifiedReason:project.reraStatus==='VERIFIED'?project.reraVerifiedReason:null,
      reraVerifiedAt:project.reraStatus==='VERIFIED'?project.reraVerifiedAt:null,
      builderName:project.builder.name,
      builderSlug:project.builder.slug,
      statedBy:"BUILDER" as const,
      inRecords:true,
    }
  }
  if(!listing.projectNameText) return null
  return {
    name:listing.projectNameText,
    slug:null,
    reraNumber:listing.projectReraText,
    reraStatus:"NONE" as VerificationStatus,
    isReraExempt:false,
    // Why there is no number, in the lister's own answer. The page says it in
    // words; a blank where a registration should be says nothing at all.
    reraAbsence:listing.projectReraAbsence,
    builderName:listing.builderNameText,
    builderSlug:null,
    // The agent or owner who posted it typed this name; the builder never confirmed it.
    statedBy:listing.postedBy,
    inRecords:false,
  }
}

export const SpecificListFetchingService=async(slug:string,userId?:string)=>{
const signedIn=userId ? Boolean(await prisma.user.findUnique({where:{id:userId},select:{id:true}})) : false
const listing=await prisma.listing.findUnique({
    // Sold and rented listings keep their page on purpose. The link is already
    // in buyers' WhatsApp threads and in Google's index, and a 404 there throws
    // away a visitor who has just proved what they are looking for; the page
    // says it is gone and offers similar ones instead. Search, the map and
    // similarListingService all still filter ACTIVE.
    // See docs/adr/0002-listing-availability-status.md.
    where:{slug,status:{in:['ACTIVE','SOLD','RENTED']}},
    // ownerId is kept here only long enough to answer "is this yours", and id
    // only long enough to hand back to the owner; both are destructured out
    // below so neither reaches anybody else's browser.
    omit:{projectId:true},
    include:{
        amenities:{select:{name:true,category:true}},
        // The registered project, when the unit is in one of our records.
        project:{select:{name:true,slug:true,reraNumber:true,reraStatus:true,isReraExempt:true,
                         reraVerifiedReason:true,reraVerifiedAt:true,
                         builder:{select:{name:true,slug:true}}}},
        listingImages:{where:{approved:true},orderBy:{position:"asc"},select:{path:true,position:true}},
        listingVideo:{where:{approved:true},select:{videoId:true}},
        owner:{select:{name:true,slug:true,avatarUrl:true,accountType:true,agentReraNumber:true,agentReraStatus:true,agentReraVerifiedReason:true,agentReraVerifiedAt:true}},
    },
})
if(!listing) throw new NotFoundError("Listing not found")

// Whether this listing HAS photographs that are simply not shown yet.
//
// Without this the page cannot tell the two cases apart, and it already has
// copy for one of them: "The seller has not added photos yet". Printing that
// over a listing whose eight photographs are sitting in a queue is a false
// statement about a real person, published on their own page, and it reads as
// carelessness on their part rather than a wait on ours.
//
// A count is deliberately not sent. "Photos not shown yet" is all a buyer
// needs; how many, and why, is between us and the seller.
const photosPending=(await prisma.listingImages.count({
  where:{listingId:listing.id,approved:false},
}))>0

const {contactName,contactPhone,ownerId,id,
  project:_project,projectNameText:_name,projectReraText:_rera,builderNameText:_builder,
  projectReraAbsence:_absence,
  ...publicFields}=listing
const isOwner=Boolean(userId) && userId===ownerId
return {
    ...publicFields,
    isOwner,
    // Only to the owner, and only because the dashboard routes are keyed by id:
    // without it an owner reading their own listing cannot be linked to its
    // editor, and the availability buttons on this page have nothing to call.
    ...(isOwner && {id}),
    ...(signedIn && {contactName,contactPhone}),
    project:projectClaim(listing),
    listingImages:listing.listingImages.map((img)=>({
        position:img.position,
        path:cdnUrl(img.path),
    })),
    listingVideo:listing.listingVideo ? {url:videoEmbedUrl(listing.listingVideo.videoId)} : null,
    photosPending,
    owner:{
      ...listing.owner,
      avatarUrl:avatarPublicUrl(listing.owner.avatarUrl),
      agentReraVerifiedReason:listing.owner.agentReraStatus==='VERIFIED'?listing.owner.agentReraVerifiedReason:null,
      agentReraVerifiedAt:listing.owner.agentReraStatus==='VERIFIED'?listing.owner.agentReraVerifiedAt:null,
    },
}
}
export const OwnerSpecificListFetchingService=async(userId:string,listingId:string)=>{
 const existingUSer=await prisma.user.findUnique({where:{id:userId}})
 if(!existingUSer) throw new BadRequestError("Invalid Token")
 // Not filtered on approved, and `approved` itself is selected: the owner sees
 // every photograph they uploaded, and which of them buyers can see. Hiding a
 // seller's own photograph from their own dashboard would read as a lost
 // upload, and they would upload it again.
 const listing=await prisma.listing.findUnique({where:{id:listingId,ownerId:userId},include:{amenities:{select:{id:true,name:true,category:true}},listingImages:{orderBy:{position:"asc"},select:{id:true,path:true,position:true,approved:true,reviewNote:true}},listingVideo:{select:{id:true,videoId:true,approved:true,reviewNote:true}},owner:{select:{id:true,name:true}}}})
 if(!listing) throw new NotFoundError("Listing not found")
 return {
    ...listing,
    listingImages:listing.listingImages.map((img)=>({
        id:img.id,
        position:img.position,
        path:cdnUrl(img.path),
        approved:img.approved,
        reviewNote:img.reviewNote,
    })),
    listingVideo:listing.listingVideo ? {id:listing.listingVideo.id,url:videoEmbedUrl(listing.listingVideo?.videoId),approved:listing.listingVideo.approved,reviewNote:listing.listingVideo.reviewNote} : null
}
}
export const listingImageDeleteService=async(userId:string,imageId:string)=>{
  const user=await prisma.user.findUnique({where:{id:userId}})
 if(!user) throw new BadRequestError("Invalid Token")
  const listingImage=await prisma.listingImages.findUnique({where:{id:imageId,listing:{ownerId:userId}}})
  if(!listingImage) throw new NotFoundError("Image not found")
  await prisma.listingImages.delete({where:{id:imageId}})
  await queueMediaCleanup({kind:"image",path:listingImage.path})
  return 'Image deleted successfully'
}

export const listingVideoDeleteService=async(userId:string,videoId:string)=>{
   const user=await prisma.user.findUnique({where:{id:userId}})
 if(!user) throw new BadRequestError("Invalid Token")
  const listingVideo=await prisma.listingVideos.findUnique({where:{id:videoId,listing:{ownerId:userId}}})
  if(!listingVideo) throw new NotFoundError("Video not found")
  await prisma.listingVideos.delete({where:{id:videoId}})
  await queueMediaCleanup({kind:"video",videoId:listingVideo.listingId})
  return 'Video deleted successfully'
}

export const deleteListingService=async(userId:string,listingId:string)=>{
   const user=await prisma.user.findUnique({where:{id:userId}})
   if(!user) throw new BadRequestError("Invalid Token")
   const listing=await prisma.listing.findUnique({where:{id:listingId,ownerId:userId},include:{listingVideo:{select:{videoId:true}}}})
   if(!listing) throw new NotFoundError("Listing not found") 
   await prisma.listing.delete({where:{id:listingId}})
   await queueMediaCleanup({kind:'listingFolder',listingId:listing.id})
   if(listing.listingVideo?.videoId){
     await queueMediaCleanup({kind:"video",videoId:listing.listingVideo.videoId})
   }
   return 'Listing deleted successfully'
}

const NOMINATIM_COUNTRY = "india"
const NOMINATIM_COUNTRY_CODE = "in"

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

export const geoCodingService=async(street:string|undefined,city:string,state:string,postalcode:string)=>{
   let response;
   const cached=await redis.get(`geoLocation:${street}|${city}|${state}|${postalcode}`)
   if(cached){
    return JSON.parse(cached)
   }
    response=await axios.get(process.env.NOMINATIM_SEARCH_API!,{
    headers:{"User-Agent":`real-estate-app/1.0(${process.env.NOMINATIM_CONTACT_EMAIL})`,"Accept-Language":"en"},
    timeout:5000,
    params:{street,city,state,postalcode,country:NOMINATIM_COUNTRY,
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
    headers:{"User-Agent":`real-estate-app/1.0(${process.env.NOMINATIM_CONTACT_EMAIL})`,"Accept-Language":"en"},
    timeout:5000,
    params:{postalcode,country:NOMINATIM_COUNTRY,
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
    headers:{"User-Agent":`real-estate-app/1.0(${process.env.NOMINATIM_CONTACT_EMAIL})`,"Accept-Language":"en"},
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

// `point` is the visitor's own position, from "Find nearby properties". When it
// is given it IS the centre, and nothing is geocoded: the device already knows
// where it is, and asking Nominatim to turn a locality name back into a
// coordinate only moves the answer. That round trip is what made a property
// 25 km away read as 2.4 km and drew the map's ring around a suburb centroid
// instead of the visitor — the further the name's scale, the worse it got, and
// a district centroid can be fifty kilometres from anywhere inside it.
//
// `location` still arrives on that path, but only as the label the results page
// shows. It must NOT reach the where clause below, because a name match is a
// different question from "within km of this point" and would put listings from
// an identically named locality in another state into a search anchored on a
// GPS fix.
export const searchService=async(location:string,km:number,type?:ListingType,property?:PropertyType,point?:SearchPoint,)=>{
let lat:number
let long:number
if(point){
  lat=point.lat
  long=point.lon
}else{
  const response=await axios.get(process.env.NOMINATIM_SEARCH_API!,{
      headers:{"User-Agent":`real-estate-app/1.0(${process.env.NOMINATIM_CONTACT_EMAIL})`,"Accept-Language":"en"},
      timeout:5000,
      params:{q:location,countrycodes:NOMINATIM_COUNTRY_CODE,
      format:"jsonv2"
  }})
  const result = response.data[0];
  if (!result) return {center:null,listings:[]};
  lat = Number(result.lat);
  long = Number(result.lon);
}

const where:ListingWhereInput=({
  status:ListingStatus.ACTIVE,
  ...(type && {
    listingType: rentCoversPg(type)
  }),
  ...(property && {
    propertyType:property
  }),
  // On a coordinate search the box is the whole question. On a typed search the
  // name is allowed to match as well, for a listing whose locality is what was
  // asked for.
  OR: point ? [boxAround(lat, long, km)] : [
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
  postedBy: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  listingImages: { where: { approved: true }, orderBy: { position: "asc" }, take: 1, select: { path: true } },
}})
const final_result=listings.map((list)=>({
  ...list,
  distanceKm:distanceKm(lat,long,list.latitude!,list.longitude!),
  listingImages: list.listingImages.map((image) => ({ path: cdnUrl(image.path) })),
})).filter((list)=>list.distanceKm<=km)
   .sort((a,b)=>a.distanceKm - b.distanceKm)
return {center:{lat,lon:long},listings:final_result}
}

export const sellerListsFetchingService=async(slug:string,page:number)=>{
  const take=9;
  const seller=await prisma.user.findUnique({where:{slug},select:{id:true}})
  if(!seller) throw new NotFoundError("Profile not found")
  const where:ListingWhereInput={status:ListingStatus.ACTIVE,ownerId:seller.id}

  const[lists,total]=await Promise.all([
    prisma.listing.findMany({
      where,
      orderBy:[{createdAt:"desc"},{id:"asc"}],
      take,
      skip:(page-1)*take,
      select:{
        slug:true,title:true,listingType:true,propertyType:true,price:true,
        locality:true,city:true,district:true,bedrooms:true,bathrooms:true,
        areaValue:true,areaUnit:true,createdAt:true,updatedAt:true,status:true,
        postedBy:true,                            // the card says who listed it
        listingImages:{where:{approved:true},orderBy:{position:"asc"},take:1,select:{path:true}},
      },
    }),
    prisma.listing.count({where}),
  ])

  return {
    total,
    lists:lists.map((listing)=>({
      ...listing,
      listingImages:listing.listingImages.map((image)=>({path:cdnUrl(image.path)})),
    })),
  }
}

export const similarListingService=async(slug:string,page:number)=>{
const listing=await prisma.listing.findUnique({where:{slug}})
if(!listing) throw new NotFoundError("Listing not found")
const take=8;
const skip=(page-1)*take
const existingCache=await redis.get(`related/${slug}/${skip}`)
if(existingCache){
  const result=JSON.parse(existingCache)
  return result
}
const where:ListingWhereInput={
  AND:[
    {id:{not:listing.id},status:'ACTIVE'},
    {OR:[
      {locality:listing.locality},
      {city:listing.city},
      {district:listing.district},
    ]}
  ]
}
const [similar,count]=await Promise.all([
  prisma.listing.findMany({
    where,
    skip,
    take,
    orderBy:{
      createdAt:'desc'
    },
    select:{slug:true,title:true,price:true,addressLine:true,locality:true,listingImages:{where:{approved:true},take:1,orderBy:{position:'asc'},select:{path:true}}}
  }),
  prisma.listing.count({where})
])
const result=similar.map((listing)=>({
  slug:listing.slug,
  title:listing.title,
  price:listing.price,
  addressLine:listing.addressLine,
  locality:listing.locality,
  image:listing.listingImages[0] ? cdnUrl(listing.listingImages[0].path) : null
}))
await redis.set(`related/${slug}/${skip}`,JSON.stringify({result,count}),{
  expiration:{type:"EX",value:5*60}
})
return {result,count}
}

export const complaintListingService=async(userId:string,slug:string,title:string,body:string)=>{
  const user=await prisma.user.findUnique({where:{id:userId}})
  if(!user) throw new BadRequestError("Invalid Token")
  const listing=await prisma.listing.findUnique({where:{slug},select:{id:true,ownerId:true}})
  if(!listing) throw new NotFoundError("Listing not found")
  if(listing.ownerId===userId) throw new BadRequestError("This is your own listing — edit or unpublish it instead")
  const open=await prisma.complaints.findFirst({where:{listingId:listing.id,userId},select:{id:true}})
  if(open) throw new BadRequestError("You have already reported this listing. We are looking at it.")
  await prisma.complaints.create({data:{listingId:listing.id,userId,title,body}})
  return 'Thank you — we have your report'
}

