import { BadRequestError, NotFoundError } from "../../errors/Errors.js"
import { Prisma } from "../../generated/prisma/client.js";
import { bannerImageUpload, cdnUrl } from "../../lib/bunny.js";
import { prisma } from "../../lib/prisma.js"

type FeaturedTarget =
    | { type: 'ListingId'; id: string }
    | { type: 'ProjectId'; id: string };

export const promotionCreationService=async(userId:string,image:Express.Multer.File,idType:FeaturedTarget)=>{
const user=await prisma.user.findUnique({where:{id:userId}})
if(!user)throw new BadRequestError("Invalid Token")
let target:{projectId?:string,listingId?:string}
// A promotion is us putting something on our own home page, for money. Whatever
// a listing page may carry as somebody's own claim, a banner we sell and place
// is ours to stand behind — so nothing gets promoted unless a person here
// checked the registration behind it against a state register.
if(idType.type==='ListingId'){
    const listing=await prisma.listing.findUnique({where:{id:idType.id}});
    if(!listing) throw new NotFoundError("Listing not found")
    if(listing.ownerId!==user.id) throw new BadRequestError("This is not your listing")
    if(listing.status!=='ACTIVE') throw new BadRequestError("Publish the listing before promoting it")
    // The lister, not the listing: a listing has no registration of its own.
    if(user.agentReraStatus!=='VERIFIED') throw new BadRequestError("Your RERA registration has to be verified before you can promote a property")
    target={listingId:listing.id}
}
else{
    const project=await prisma.project.findUnique({where:{id:idType.id}});
    if(!project) throw new NotFoundError("Project not found")
    if(project.builderId!==user.id) throw new BadRequestError("This is not your Project")
    // VERIFIED only, which excludes a project listing on a stated exemption:
    // nothing about an exemption has been checked against any register, and a
    // banner is the wrong place for an unchecked claim.
    if(project.reraStatus!=='VERIFIED') throw new BadRequestError("This project's RERA registration has to be verified before you can promote it")
    target={projectId:project.id}
}
    const open=await prisma.promotions.findFirst({where:target})
    if(open) throw new BadRequestError("You already have a banner for this. Remove it before adding another.")
    const path=await bannerImageUpload(image)
    try{
        await prisma.promotions.create({data:{
            userId,
            path,
            ...target
    }})
    }catch(error){
        if(error instanceof Prisma.PrismaClientKnownRequestError && error.code==='P2002')
            throw new BadRequestError("You already have a banner for this. Remove it before adding another.")
        throw error
    }
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
    const result=await prisma.promotions.findMany({
        where:{isActive:type},
        orderBy:{createdAt:'desc'},
        include:{
            user:{select:{id:true,name:true,email:true}},
            listing:{select:{slug:true,title:true,price:true,locality:true,city:true,status:true,listingType:true}},
            project:{select:{slug:true,name:true,locality:true,city:true,status:true}},
        },
    })
    return result.map(({path,...promotion})=>({...promotion,image:cdnUrl(path)}))
}

 export const togglePromotionService=async(id:string)=>{
const promotion=await prisma.promotions.findUnique({where:{id},select:{isActive:true,listing:{select:{ title:true}},project:{select:{name:true}}}})
if(!promotion) throw new NotFoundError("Promotion not found")
await prisma.promotions.update({where:{id},data:{isActive:!promotion.isActive}})
return `Updated promotion for ${promotion.listing?.title ?? promotion.project?.name ?? "this promotion"}`
}

export const showActivePromotionService=async()=>{
    // Checked again here, not only when the banner was created. A verification
    // can be revoked a month into a run, and a paid banner is exactly where a
    // stale "verified" would do the most damage — so the condition is on the
    // read, and a revocation takes the banner off the home page by itself.
    const result=await prisma.promotions.findMany({
        where:{
            isActive:true,
            OR:[
                {listing:{owner:{agentReraStatus:'VERIFIED'}}},
                {project:{reraStatus:'VERIFIED'}},
            ],
        },
        select:{listingId:true,projectId:true,path:true,project:{select:{ slug:true}},listing:{select:{slug:true}}},
    })
    const promotions=result.map((promo)=>{
        return{
            ...(promo.listingId && {
            type:'Listing',
            slug:promo.listing?.slug
            }),
            ...(promo.projectId && {
            type:'Project',
            slug:promo.project?.slug
            }),
            path:cdnUrl(promo.path)
        }
    })
    return promotions
}