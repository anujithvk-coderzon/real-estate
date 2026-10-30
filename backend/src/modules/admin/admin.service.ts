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
const requests=await prisma.user.findMany({where:{agentReraStatus:type,isVerified:true,NOT:{id:userId}},select:{id:true,name:true,email:true,accountType:true,agentReraName:true,agentReraState:true,agentReraNumber:true,}})
return requests
}

export const approveRearaService=async(id:string)=>{
const user=await prisma.user.findUnique({where:{id}})
if(!user) throw new BadRequestError("Invalid token")
await prisma.user.update({where:{id},data:{agentReraStatus:'VERIFIED',agentReraVerifiedAt:new Date()}})
return "verification successfull."
}

export const rejectReraService=async(id:string)=>{
const user=await prisma.user.findUnique({where:{id}})
if(!user) throw new BadRequestError("Invalid token")
await prisma.user.update({where:{id},data:{agentReraStatus:'REVOKED'}})
return 'Verification revoked'
}