import { BadRequestError, NotFoundError, UnauthorizedError } from "../../errors/Errors.js"
import type { ListingStatus, VerificationStatus } from "../../generated/prisma/enums.js"
import { prisma } from "../../lib/prisma.js"
import { avatarPublicUrl, cdnUrl, videoEmbedUrl } from "../../lib/bunny.js"
import {hash} from 'bcrypt'

export const adminRegisterService=async(name:string,email:string,pass:string)=>{
 const hashedPassword=await hash(pass,10)
 await prisma.user.create({data:{
    name,
    email,
    password:hashedPassword,
    role:"ADMIN",
    isVerified:true
 }})
 return 'Admin Registered Successfully'
}

export const interestSaveService=async(id:string,slug:string)=>{
const existingUser=await prisma.user.findUnique({where:{id}})
if(!existingUser) throw new UnauthorizedError("Unauthorized")
const lisiting=await prisma.listing.findUnique({where:{slug},select:{id:true}})
if(!lisiting) throw new BadRequestError("lising not found")
await prisma.userInterest.upsert({where:{userId_listingId:{userId:id,listingId:lisiting.id}},create:{
    userId:id,
    listingId:lisiting.id
},update:{}})
return 'Interest saved successfully'
}

export const interestsFetchingService = async () => {
  const rows = await prisma.userInterest.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        user: { select: {id:true, name: true, email: true } },
        listing: {
          select: {
            slug: true,
            title: true,
            locality: true,
            city: true,
            price: true,
            listingType: true,
            contactName: true,
            contactPhone: true,
            owner: { select: { name: true, email: true } },
          },
        },
      },
    })
    const byUser=new Map<string, { id: string; name: string; email: string; count: number; lastAt: Date; interests: typeof rows }>();
    for( const row of rows){
      const theirs=byUser.get(row.user.email);
      if(theirs){
        theirs.interests.push(row);
        theirs.count++;
      }
      else{
        byUser.set(row.user.email,{...row.user,count:1,lastAt: row.createdAt, interests: [row] })
      }
    }
  const users = [...byUser.values()];
  return {total:users.length,users};
};

export const reraVerficationRequestService=async(userId:string,type:VerificationStatus)=>{
const requests=await prisma.user.findMany({where:{agentReraStatus:type,isVerified:true,NOT:{id:userId}},select:{id:true,name:true,email:true,accountType:true,agentReraName:true,agentReraState:true,agentReraNumber:true,agentReraVerifiedReason:true,agentReraVerifiedAt:true,}})
return requests
}

export const projectReraRequestService=async(type:VerificationStatus)=>{
const projects=await prisma.project.findMany({
  where:{reraStatus:type},
  orderBy:{createdAt:'desc'},
  select:{id:true,name:true,slug:true,locality:true,city:true,state:true,status:true,totalUnits:true,
          reraNumber:true,reraState:true,reraStatus:true,isReraExempt:true,exemptReason:true,
          reraVerifiedReason:true,reraVerifiedAt:true,
          builder:{select:{name:true,email:true}}},
})
return projects
}

export const projectReraExemptionsService=async()=>{
const projects=await prisma.project.findMany({
  where:{isReraExempt:true},
  orderBy:{createdAt:'desc'},
  select:{id:true,name:true,slug:true,locality:true,city:true,state:true,status:true,totalUnits:true,
          reraNumber:true,reraState:true,reraStatus:true,isReraExempt:true,exemptReason:true,
          reraVerifiedReason:true,reraVerifiedAt:true,
          builder:{select:{name:true,email:true}}},
})
return projects
}

const projectForDecision=async(id:string)=>{
const project=await prisma.project.findUnique({where:{id}})
if(!project) throw new BadRequestError("Project not found")
if(project.isReraExempt) throw new BadRequestError("This project is listed as exempt, so it has no registration to check")
if(!project.reraNumber) throw new BadRequestError("This project has no registration number on it")
return project
}

export const approveProjectReraService=async(id:string,reason:string)=>{
const project=await projectForDecision(id)
await prisma.$transaction([
  prisma.project.update({where:{id},data:{reraStatus:'VERIFIED',reraVerifiedReason:reason,reraVerifiedAt:new Date()}}),
  prisma.notification.create({data:{userId:project.builderId,title:"Project RERA Verification",body:`The RERA registration for ${project.name} has been approved. Buyers now see this note on the project: ${reason}`,type:"PROJECT_RERA_VERIFICATION"}})
])
return 'Project registration verified'
}

export const rejectProjectReraService=async(id:string,reason:string)=>{
const project=await projectForDecision(id)
await prisma.$transaction([
  prisma.project.update({where:{id},data:{reraStatus:'REJECTED',reraVerifiedReason:reason,reraVerifiedAt:new Date()}}),
  prisma.notification.create({data:{userId:project.builderId,title:"Project RERA Verification",body:`We could not verify the RERA registration for ${project.name}. ${reason}`,type:"PROJECT_RERA_VERIFICATION"}})
])
return 'Project registration rejected'
}

export const revokeProjectReraService=async(id:string,reason:string)=>{
const project=await projectForDecision(id)
if(project.reraStatus!=='VERIFIED') throw new BadRequestError("Only a verified registration can be revoked")
await prisma.$transaction([
  prisma.project.update({where:{id},data:{reraStatus:'REVOKED',reraVerifiedReason:reason,reraVerifiedAt:new Date()}}),
  prisma.notification.create({data:{userId:project.builderId,title:"Project RERA Verification",body:`The verified registration for ${project.name} has been revoked, and the badge is off its listings. ${reason}`,type:"PROJECT_RERA_VERIFICATION"}})
])
return 'Project registration revoked'
}

export const approveRearaService=async(id:string,reason:string)=>{
const user=await prisma.user.findUnique({where:{id}})
if(!user) throw new BadRequestError("Agent not found")
  await prisma.$transaction([
    prisma.user.update({where:{id},data:{agentReraStatus:'VERIFIED',agentReraVerifiedReason:reason,agentReraVerifiedAt:new Date()}}),
    prisma.notification.create({data:{userId:id,title:"RERA Verification",body:`Your RERA verification has been approved. Buyers now see this note on your profile: ${reason}`,type:"RERA_VERIFICATION"}})
  ])
return "verification successfull."
}

export const rejectReraService=async(id:string,reason:string)=>{
const user=await prisma.user.findUnique({where:{id}})
if(!user) throw new BadRequestError("Agent not found")
await prisma.$transaction([
  prisma.user.update({where:{id},data:{agentReraStatus:'REJECTED',agentReraVerifiedReason:reason,agentReraVerifiedAt:new Date()}}),
  prisma.notification.create({data:{userId:id,title:"RERA Verification",body:`We could not verify your RERA registration. ${reason}`,type:"RERA_VERIFICATION"}})
])
return 'Verification rejected'
}

export const revokeReraService=async(id:string,reason:string)=>{
const user=await prisma.user.findUnique({where:{id}})
if(!user) throw new BadRequestError("Agent not found")
if(user.agentReraStatus!=='VERIFIED') throw new BadRequestError("Only a verified registration can be withdrawn")
await prisma.$transaction([
  prisma.user.update({where:{id},data:{agentReraStatus:'REVOKED',agentReraVerifiedReason:reason,agentReraVerifiedAt:new Date()}}),
  prisma.notification.create({data:{userId:id,title:"RERA Verification",body:`Your RERA verification has been withdrawn and the verified badge is off your listings. ${reason}`,type:"RERA_VERIFICATION"}})
])
return 'Verification withdrawn'
}

export const getListingComplaintsService=async(type?:string)=>{
  // Two different questions, so two different filters. PENDING and RESOLVED ask
  // about the complaint; TAKEN_DOWN asks about the listing, because once a
  // listing is down its complaints are settled and the thing the operator is
  // looking for is "what did we remove, and why".
  const where=type==='TAKEN_DOWN'
    ? {listing:{status:'TAKEN_DOWN' as const}}
    : type ? {status:type} : {}
  const complaints=await prisma.complaints.findMany({
    where,
    orderBy:{createdAt:'desc'},
    select:{
      id:true,
      createdAt:true,
      title:true,
      body:true,
      status:true,
      listing:{select:{id:true,slug:true,title:true,locality:true,city:true,price:true,listingType:true,status:true,contactName:true,contactPhone:true,owner:{select:{name:true,email:true,}}}},
      user:{select:{id:true,name:true,email:true}}
    }
  })
  return complaints
}

export const adminListingService=async(slug:string)=>{
  const listing=await prisma.listing.findUnique({
    where:{slug,OR:[{status:'ACTIVE'},{status:'TAKEN_DOWN'}]},
    include:{
      amenities:{select:{name:true,category:true}},
      project:{select:{name:true,slug:true,reraNumber:true,reraStatus:true,isReraExempt:true,exemptReason:true,
                       builder:{select:{name:true,slug:true}}}},
      listingImages:{orderBy:{position:"asc"},select:{path:true,position:true}},
      listingVideo:{select:{videoId:true}},
      owner:{select:{id:true,name:true,email:true,slug:true,avatarUrl:true,accountType:true,
                     agentReraNumber:true,agentReraState:true,agentReraStatus:true}},
      complaints:{orderBy:{createdAt:"desc"},
                  select:{id:true,title:true,body:true,status:true,createdAt:true,
                          user:{select:{id:true,name:true,email:true}}}},
    },
  })
  if(!listing) throw new NotFoundError("Listing not found")
  return {
    ...listing,
    listingImages:listing.listingImages.map((image)=>({position:image.position,path:cdnUrl(image.path)})),
    listingVideo:listing.listingVideo ? {url:videoEmbedUrl(listing.listingVideo.videoId)} : null,
    owner:{...listing.owner,avatarUrl:avatarPublicUrl(listing.owner.avatarUrl)},
  }
}

export const takeDownListingService=async(listingId:string,reason:string)=>{
  const listing=await prisma.listing.findUnique({where:{id:listingId}})
  if(!listing) throw new BadRequestError("Listing not found")
  await prisma.$transaction([
    prisma.listing.update({where:{id:listingId},data:{status:'TAKEN_DOWN'}}),
    prisma.complaints.updateMany({where:{listingId,status:'PENDING'},data:{status:'RESOLVED'}}),
    prisma.notification.create({data:{userId:listing.ownerId,title:"Listing Taken Down",body:`Your listing ${listing.title} has been taken down by the admin. ${reason}`,type:"LISTING_TAKEN_DOWN"}})
  ])
  return 'Listing taken down successfully'
}

export const activateTakenDownListingService=async(listingId:string)=>{
  const listing=await prisma.listing.findUnique({where:{id:listingId}})
  if(!listing) throw new BadRequestError("Listing not found")
  if(listing.status!=='TAKEN_DOWN') throw new BadRequestError("Listing is not taken down")
  await prisma.$transaction([
    prisma.listing.update({where:{id:listingId},data:{status:'ACTIVE'}}),
    // Told, the same way the take-down was. Removing a listing sends a
    // notification and putting it back did not, so a seller who fixed what we
    // asked them to fix had no way to know it had worked — they would write
    // again, or quietly give up on the account.
    prisma.notification.create({data:{userId:listing.ownerId,title:"Listing Back Up",body:`Your listing ${listing.title} is live again and buyers can see it.`,type:"LISTING_RESTORED"}}),
  ])
  return 'Listing activated successfully'
}

export type ListingApprovalQueue='LIVE'|'DRAFTS'|'REJECTED'

const waitingOnUs={
  OR:[
    {listingImages:{some:{approved:false,reviewNote:null}}},
    {listingVideo:{approved:false,reviewNote:null}},
  ],
}

const sentBack={
  OR:[
    {listingImages:{some:{reviewNote:{not:null}}}},
    {listingVideo:{reviewNote:{not:null}}},
  ],
}

export const getListingApprovalCountsService=async()=>{
  const live={...waitingOnUs,status:{in:['ACTIVE','SOLD','RENTED','EXPIRED'] as ListingStatus[]}}
  const drafts={...waitingOnUs,status:'DRAFT' as const}
  const [liveCount,draftCount,sentBackCount]=await Promise.all([
    prisma.listing.count({where:live}),
    prisma.listing.count({where:drafts}),
    prisma.listing.count({where:sentBack}),
  ])
  return {
    live:liveCount,
    drafts:draftCount,
    sentBack:sentBackCount,
    waiting:liveCount+draftCount,
  }
}

export const getListingApprovalsService=async(queue:ListingApprovalQueue)=>{
  const where=queue==='REJECTED'
    ? sentBack
    : queue==='DRAFTS'
      ? {...waitingOnUs,status:'DRAFT' as const}
      : {...waitingOnUs,status:{in:['ACTIVE','SOLD','RENTED','EXPIRED'] as ListingStatus[]}}

  const listings=await prisma.listing.findMany({
    where,
    orderBy:{updatedAt:'asc'},
    select:{
      id:true,slug:true,title:true,description:true,
      listingType:true,propertyType:true,postedBy:true,
      price:true,areaValue:true,areaUnit:true,
      bedrooms:true,bathrooms:true,furnishing:true,propertyStatus:true,
      addressLine:true,landmark:true,locality:true,city:true,district:true,
      state:true,pincode:true,latitude:true,longitude:true,
      contactName:true,contactPhone:true,
      status:true,
      createdAt:true,updatedAt:true,
      listingImages:{orderBy:{position:'asc'},select:{id:true,path:true,position:true,approved:true,reviewNote:true,createdAt:true,updatedAt:true}},
      listingVideo:{select:{id:true,videoId:true,approved:true,reviewNote:true,createdAt:true,updatedAt:true}},
      amenities:{select:{name:true,category:true}},
      owner:{select:{id:true,name:true,email:true,slug:true,avatarUrl:true,accountType:true,
                     agentReraNumber:true,agentReraStatus:true}},
      project:{select:{name:true,slug:true,reraNumber:true,reraStatus:true,isReraExempt:true}},
    },
  })

  return listings.map((listing)=>({
    ...listing,
    listingImages:listing.listingImages.map((image)=>({id:image.id,position:image.position,path:cdnUrl(image.path),approved:image.approved,reviewNote:image.reviewNote,createdAt:image.createdAt,updatedAt:image.updatedAt})),
    listingVideo:listing.listingVideo ? {id:listing.listingVideo.id,url:videoEmbedUrl(listing.listingVideo.videoId),approved:listing.listingVideo.approved,reviewNote:listing.listingVideo.reviewNote,createdAt:listing.listingVideo.createdAt,updatedAt:listing.listingVideo.updatedAt} : null,
    owner:{...listing.owner,avatarUrl:avatarPublicUrl(listing.owner.avatarUrl)},
  }))
}

export const approveListingMediaService=async(listingId:string)=>{
  const listing=await prisma.listing.findUnique({
    where:{id:listingId},
    select:{
      id:true,title:true,ownerId:true,status:true,
      _count:{select:{listingImages:{where:{approved:false,reviewNote:null}}}},
      listingVideo:{select:{approved:true,reviewNote:true}},
    },
  })
  if(!listing) throw new NotFoundError("Listing not found")

  const images=listing._count.listingImages
  const video=listing.listingVideo!==null
    && !listing.listingVideo.approved
    && listing.listingVideo.reviewNote===null
  if(images===0 && !video) throw new BadRequestError("Nothing on this listing is waiting to be looked at")

  const live=listing.status!=='DRAFT'
  const one=images===1 && !video
  const what=images>0 && video
    ? `Your ${images} photo${images===1 ? '' : 's'} and video`
    : video ? 'Your video' : `Your ${images} photo${images===1 ? '' : 's'}`

  const body=live
    ? `${what} on ${listing.title} ${one ? 'has' : 'have'} been checked and ${one ? 'is' : 'are'} now showing to buyers.`
    : `${what} on ${listing.title} ${one ? 'has' : 'have'} been checked. ${one ? 'It' : 'They'} will show to buyers as soon as you publish the listing.`

  await prisma.$transaction([
    prisma.listingImages.updateMany({
      where:{listingId,approved:false,reviewNote:null},
      data:{approved:true},
    }),
    prisma.listingVideos.updateMany({
      where:{listingId,approved:false,reviewNote:null},
      data:{approved:true},
    }),
    prisma.notification.create({data:{
      userId:listing.ownerId,
      title:live ? "Photos Are Live" : "Photos Checked",
      body,
      type:"LISTING_MEDIA_APPROVED",
    }}),
  ])
  return live ? 'Showing to buyers now' : 'Cleared for when they publish'
}

export const allowListingMediaService=async(
  kind:'image'|'video',
  mediaId:string,
)=>{
  const target=kind==='image'
    ? await (async()=>{
        const image=await prisma.listingImages.findUnique({
          where:{id:mediaId},
          select:{position:true,approved:true,listing:{select:{title:true,ownerId:true,status:true}}},
        })
        if(!image) throw new NotFoundError("Photo not found")
        return {which:`Photo ${image.position+1}`,approved:image.approved,listing:image.listing}
      })()
    : await (async()=>{
        const video=await prisma.listingVideos.findUnique({
          where:{id:mediaId},
          select:{approved:true,listing:{select:{title:true,ownerId:true,status:true}}},
        })
        if(!video) throw new NotFoundError("Video not found")
        return {which:'The video',approved:video.approved,listing:video.listing}
      })()

  if(target.approved) throw new BadRequestError("That one is already showing to buyers")

  const live=target.listing.status!=='DRAFT'
  await prisma.$transaction([
    kind==='image'
      ? prisma.listingImages.update({where:{id:mediaId},data:{approved:true,reviewNote:null}})
      : prisma.listingVideos.update({where:{id:mediaId},data:{approved:true,reviewNote:null}}),
    prisma.notification.create({data:{
      userId:target.listing.ownerId,
      title:"Photo Approved",
      body:live
        ? `${target.which} on ${target.listing.title} has been checked and is now showing to buyers.`
        : `${target.which} on ${target.listing.title} has been checked. It will show to buyers as soon as you publish the listing.`,
      type:"LISTING_MEDIA_APPROVED",
    }}),
  ])
  return `${target.which} is showing now`
}

export const rejectListingMediaService=async(
  kind:'image'|'video',
  mediaId:string,
  note:string,
)=>{
  const target=kind==='image'
    ? await (async()=>{
        const image=await prisma.listingImages.findUnique({
          where:{id:mediaId},
          select:{position:true,listing:{select:{title:true,ownerId:true}}},
        })
        if(!image) throw new NotFoundError("Photo not found")
        return {which:`Photo ${image.position+1}`,listing:image.listing,title:"A Photo Needs Changing"}
      })()
    : await (async()=>{
        const video=await prisma.listingVideos.findUnique({
          where:{id:mediaId},
          select:{listing:{select:{title:true,ownerId:true}}},
        })
        if(!video) throw new NotFoundError("Video not found")
        return {which:'The video',listing:video.listing,title:"Your Video Needs Changing"}
      })()

  await prisma.$transaction([
    kind==='image'
      ? prisma.listingImages.update({where:{id:mediaId},data:{approved:false,reviewNote:note}})
      : prisma.listingVideos.update({where:{id:mediaId},data:{approved:false,reviewNote:note}}),
    prisma.notification.create({data:{
      userId:target.listing.ownerId,
      title:target.title,
      body:`${target.which} on ${target.listing.title} cannot be shown to buyers yet. ${note} Replace it and we will take another look \u2014 your listing itself stays up either way, and anything already checked is still showing.`,
      type:"LISTING_MEDIA_REJECTED",
    }}),
  ])
  return `${target.which} sent back to the seller`
}
