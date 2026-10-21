import { BadRequestError, UnauthorizedError } from "../../errors/Errors.js"
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


export const interestsFetchingService = async (page: number, take: number) => {
  const [rows, total] = await prisma.$transaction([
    prisma.userInterest.findMany({
      orderBy: { createdAt: "desc" },
      take,
      skip: (page - 1) * take,
      select: {
        id: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
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
    }),
    prisma.userInterest.count(),
  ]);
  return { total, interests: rows };
};
