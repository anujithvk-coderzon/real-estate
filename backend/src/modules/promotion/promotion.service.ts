import { BadRequestError, NotFoundError } from "../../errors/Errors.js"
import { bannerImageUpload, cdnUrl } from "../../lib/bunny.js";
import { prisma } from "../../lib/prisma.js"

type FeaturedTarget =
    | { type: 'ListingId'; id: string }
    | { type: 'ProjectId'; id: string };

export const promotionCreationService=async(userId:string,image:Express.Multer.File,idType:FeaturedTarget)=>{
const user=await prisma.user.findUnique({where:{id:userId}})
if(!user)throw new BadRequestError("Invalid Token")
let target:{projectId?:string,listingId?:string}
if(idType.type==='ListingId'){
    const listing=await prisma.listing.findUnique({where:{id:idType.id}});
    if(!listing) throw new NotFoundError("Listing not found")
    if(listing.ownerId!==user.id) throw new BadRequestError("This is not your listing")
    if(listing.status!=='ACTIVE') throw new BadRequestError("Publish the listing before promoting it")
    target={listingId:listing.id}
}
else{
    const project=await prisma.project.findUnique({where:{id:idType.id}});
    if(!project) throw new NotFoundError("Project not found")
    if(project.builderId!==user.id) throw new BadRequestError("This is not your Project")
    target={projectId:project.id}
}
    const path=await bannerImageUpload(image)
    await prisma.promotions.create({data:{
        userId,
        path,
        ...target
}})
  return 'Promotion is on review right now'
}

export const myPromotionsService=async(userId:string)=>{
const user=await prisma.user.findUnique({where:{id:userId}})
if(!user) throw new BadRequestError("Invalid token")
const result=await prisma.promotions.findMany({where:{userId},orderBy:{createdAt:'desc'},select:{id:true,createdAt:true,isActive:true,listingId:true,path:true,projectId:true}})
const promotions=result.map((promo)=>{
    return {
        id:promo.id,
        isActive:promo.isActive,
        ...(promo.listingId && {
        listingId:promo.listingId
        }),
        ...(promo.projectId && {
        projectId:promo.projectId
        }),
        image:cdnUrl(promo.path),
        createdAt:promo.createdAt
    }
})
return promotions;
}

export const allPromotionService=async(type:boolean)=>{
    const promotions=await prisma.promotions.findMany({where:{isActive:type}})
    return promotions
}