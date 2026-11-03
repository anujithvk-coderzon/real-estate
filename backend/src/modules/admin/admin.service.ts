import { BadRequestError, UnauthorizedError } from "../../errors/Errors.js"
import type { VerificationStatus } from "../../generated/prisma/enums.js"
import { prisma } from "../../lib/prisma.js"
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



