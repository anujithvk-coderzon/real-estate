import { BadRequestError, ForbiddenError, NotFoundError } from "../../errors/Errors.js";
import { cdnUrl,uploadProjectImage } from "../../lib/bunny.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { userSlug } from "../../lib/slug.js";
import { RERA_EXEMPT_MAX_UNITS, type CreateProjectInput, type UpdateProjectInput } from "./project.validation.js";
import { queueMediaCleanup } from "../../queues/media.queue.js";


// Only the builder who is building it registers a project. An agent selling in
// someone else's project names it on the listing instead, as a claim.
const builderOnly=async(userId:string)=>{
  const user=await prisma.user.findUnique({where:{id:userId}})
  if(!user) throw new BadRequestError("Invalid Token")
  if(user.accountType!=="BUILDER") throw new ForbiddenError("Only builders can add projects")
  return user
}

const ownProject=async(userId:string,projectId:string)=>{
  const project=await prisma.project.findUnique({where:{id:projectId}})
  if(!project) throw new NotFoundError("Project not found")
  if(project.builderId!==userId) throw new ForbiddenError("This project belongs to another builder")
  return project
}

const freeReraNumber=async(reraNumber:string,projectId?:string)=>{
  const taken=await prisma.project.findUnique({where:{reraNumber},select:{id:true}})
  if(taken && taken.id!==projectId) throw new BadRequestError("This RERA number is already used by another project")
}

export const createProjectService=async(userId:string,data:CreateProjectInput)=>{
await builderOnly(userId)
const mustRegister=(data.totalUnits ?? 0) > RERA_EXEMPT_MAX_UNITS
const isReraExempt=mustRegister ? false : data.isReraExempt
if(data.reraNumber) await freeReraNumber(data.reraNumber)

const project=await prisma.project.create({data:{
    name:data.name,
    slug:userSlug(data.name),
    status:data.status,
    propertyType:data.propertyType??null,
    description:data.description??null,
    totalUnits:data.totalUnits??null,
    minPrice:data.minPrice??null,
    maxPrice:data.maxPrice??null,
    startedAt:data.startedAt??null,
    handoverAt:data.handoverAt??null,
    locality:data.locality,
    city:data.city,
    district:data.district,
    state:data.state,
    pincode:data.pincode,
    latitude:data.latitude??null,
    longitude:data.longitude??null,
    // A declared number is PENDING, not NONE: it is a claim waiting for somebody
    // to check it against the state register, and that is what puts the project
    // in the admin queue. An exempt project has nothing to check, so it stays NONE.
    reraStatus:isReraExempt ? "NONE" : "PENDING",
    reraNumber:isReraExempt ? null : (data.reraNumber??null),
    reraState:isReraExempt ? null : (data.reraState??null),
    isReraExempt,
    exemptReason:isReraExempt ? (data.exemptReason??null) : null,
    builderId:userId,
}})
return project
}

export const updateProjectService=async(userId:string,projectId:string,newData:UpdateProjectInput)=>{
 const project=await ownProject(userId,projectId)

 // The rules read the project as it will be after the edit, not as it was.
 const totalUnits=newData.totalUnits ?? project.totalUnits ?? 0
 const mustRegister=totalUnits > RERA_EXEMPT_MAX_UNITS
 const isReraExempt=mustRegister ? false : (newData.isReraExempt ?? project.isReraExempt)
 const reraNumber=newData.reraNumber ?? project.reraNumber

 if(mustRegister && !reraNumber) throw new BadRequestError(`RERA registration is compulsory above ${RERA_EXEMPT_MAX_UNITS} units`)

 // The same two rules the create form applies, re-checked on the merged project:
 // an edit must not be able to leave it with no number and no stated exemption.
 if(!isReraExempt && !reraNumber) throw new BadRequestError("Give the RERA number, or mark the project exempt")
 if(isReraExempt && !(newData.exemptReason ?? project.exemptReason)){
  throw new BadRequestError("Say why the project is exempt")
 }
 if(newData.reraNumber) await freeReraNumber(newData.reraNumber,projectId)

 // Only the keys that were sent; the rest of the project is left alone.
 const fields=Object.fromEntries(
  Object.entries(newData).filter(([,value])=>value!==undefined),
 ) as Prisma.ProjectUpdateInput

 // What this edit does to the verification, which is not always what the
 // builder thinks they are doing. Both of these throw away a decision an
 // operator made and a note that is on the public page.
 const numberChanged=Boolean(newData.reraNumber) && newData.reraNumber!==project.reraNumber
 const becameExempt=isReraExempt && !project.isReraExempt
 const wasVerified=project.reraStatus==="VERIFIED"

 // A changed number goes back in the queue. Turning exempt leaves nothing to
 // check at all, so it goes back to NONE. Either way the note that was
 // published about the old number must not survive it: it describes a
 // registration this project no longer claims.
 const verification=becameExempt
  ? {reraStatus:"NONE" as const,reraVerifiedReason:null,reraVerifiedAt:null}
  : numberChanged
    ? {reraStatus:"PENDING" as const,reraVerifiedReason:null,reraVerifiedAt:null}
    : {}

 // Told, not left to be noticed. Losing a verified badge is the kind of thing
 // a builder discovers weeks later by looking at their own listing, and the
 // cause — an edit they made themselves — is the last thing they would suspect.
 const told=becameExempt
  ? (wasVerified
      ? `${project.name} is now listed as exempt from RERA registration, so its verified badge has been taken off the project and its listings.`
      : null)
  : numberChanged
    ? (wasVerified
        ? `The RERA number for ${project.name} was changed, so its verified badge has come off the project and its listings until somebody checks the new number.`
        : `The new RERA number for ${project.name} is waiting to be checked against the state authority's register.`)
    : null

 const [updated]=await prisma.$transaction([
  prisma.project.update({
   where:{id:projectId},
   data:{
     ...fields,
     isReraExempt,
     ...(isReraExempt
       ? {reraNumber:null,reraState:null}
       : {exemptReason:null}),
     ...verification,
   },
  }),
  ...(told
    ? [prisma.notification.create({data:{userId,title:"Project RERA Verification",body:told,type:"PROJECT_RERA_VERIFICATION"}})]
    : []),
 ])
 return updated
}

export const deleteProjectService=async(userId:string,projectId:string)=>{
 await ownProject(userId,projectId)
 const project=await prisma.project.findUnique({where:{id:projectId},include:{_count:{select:{listings:true}}}})
 if(!project) throw new NotFoundError("Project not found")
 // Listings survive a deleted project (the link is set to null), but say so first.
 if(project._count.listings>0) throw new BadRequestError(`${project._count.listings} listings point at this project. Move or remove them first.`)
 await prisma.project.delete({where:{id:projectId}})
 return 'Project deleted successfully'
}

export const builderProjectsService=async(userId:string)=>{
 const projects=await prisma.project.findMany({
  where:{builderId:userId},
  orderBy:{createdAt:"desc"},
  select:{
    id:true,name:true,slug:true,status:true,propertyType:true,totalUnits:true,
    locality:true,city:true,district:true,
    reraNumber:true,reraStatus:true,isReraExempt:true,
    images:{orderBy:{position:"asc"},take:1,select:{path:true}},
  },
 })
 return projects.map((project)=>({
  ...project,
  images:project.images.map((image)=>({path:cdnUrl(image.path)})),
 }))
}

const MAX_PROJECT_IMAGES=10

// One project, as its builder sees it on the project page.
export const builderProjectService=async(userId:string,projectId:string)=>{
 await ownProject(userId,projectId)
 const project=await prisma.project.findUnique({
  where:{id:projectId},
  include:{
    images:{orderBy:{position:"asc"},select:{id:true,path:true,position:true}},
    _count:{select:{listings:true}},
  },
 })
 if(!project) throw new NotFoundError("Project not found")
 return {
  ...project,
  images:project.images.map((image)=>({...image,path:cdnUrl(image.path)})),
  listingCount:project._count.listings,
 }
}

export const projectImageUploadService=async(userId:string,projectId:string,images:Express.Multer.File[])=>{
 await ownProject(userId,projectId)

 const existingCount=await prisma.projectImages.count({where:{projectId}})
 const remaining=MAX_PROJECT_IMAGES-existingCount
 if(images.length>remaining){
  throw new BadRequestError(
    remaining<=0
      ? `This project already has ${MAX_PROJECT_IMAGES} photos — the limit is reached.`
      : `A project allows up to ${MAX_PROJECT_IMAGES} photos. You have ${existingCount}, so you can add ${remaining} more.`,
  )
 }

 const lastImage=await prisma.projectImages.findFirst({
   where:{projectId},
   orderBy:{position:"desc"},
   select:{position:true},
 })
 let position=(lastImage?.position ?? -1)+1;

 for(const image of images){
  const path=await uploadProjectImage(projectId,image)
  await prisma.projectImages.create({data:{path,projectId,position}})
  position++;
 }
 return `Photos uploaded successfully`
}

export const projectImagesService=async(userId:string,projectId:string)=>{
 await ownProject(userId,projectId)
 const project=await prisma.project.findUnique({
  where:{id:projectId},
  select:{name:true,images:{orderBy:{position:"asc"},select:{id:true,path:true,position:true}}},
 })
 if(!project) throw new NotFoundError("Project not found")
 return {
  name:project.name,
  images:project.images.map((image)=>({...image,path:cdnUrl(image.path)})),
 }
}

export const projectImageDeleteService=async(userId:string,imageId:string)=>{
 const image=await prisma.projectImages.findUnique({where:{id:imageId,project:{builderId:userId}}})
 if(!image) throw new NotFoundError("Photo not found")
 await prisma.projectImages.delete({where:{id:imageId}})
 await queueMediaCleanup({kind:"image",path:image.path})
 return 'Photo deleted successfully'
}


// Project search for the listing form: an agent sells in someone else's project,
// so they search all of them by name or place.
// Enough to choose from without scrolling. More than this and the answer is to
// type another word, not to scroll: "sobha" narrows to "sobha kakkanad".
const MAX_PROJECT_RESULTS=10

export const projectSearchService=async(query:string,skip=0)=>{
 const words=query.trim().split(/\s+/).filter(Boolean)

 // Every word must appear somewhere in the project, so each word the agent adds
 // narrows the list instead of widening it. No words at all is not an error and
 // not an empty list: it is "show me what is here", answered with the newest
 // ones, because a picker that does nothing until you guess a word teaches
 // nobody what it holds.
 const where=words.length
   ? {AND:words.map((word)=>({OR:[
       {name:{contains:word,mode:"insensitive" as const}},
       {locality:{contains:word,mode:"insensitive" as const}},
       {city:{contains:word,mode:"insensitive" as const}},
     ]}))}
   : {}

 // The count comes back with the page, because "12 projects match sky" is the
 // number that tells an agent whether to type another letter or start reading.
 // Browsing the newest is alphabetical nonsense, so that case orders by date.
 const [found,total]=await Promise.all([
   prisma.project.findMany({
     where,
     orderBy:words.length ? {name:"asc"} : {createdAt:"desc"},
     skip,
     take:MAX_PROJECT_RESULTS,
     select:{
       id:true,name:true,status:true,locality:true,city:true,
       reraNumber:true,reraStatus:true,isReraExempt:true,
       builder:{select:{name:true}},
     },
   }),
   prisma.project.count({where}),
 ])

 const projects=found.map(({builder,...project})=>({
  ...project,
  builderName:builder.name,
 }))
 // more is derived from the count now, so it stays true while the list is being
 // appended to rather than being about one page in isolation.
 return {projects,total,more:skip+projects.length<total}
}

