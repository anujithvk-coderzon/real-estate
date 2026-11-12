import type { Request, Response } from "express";
import {
  adminRegisterService,
  approveRearaService,
  interestSaveService,
  interestsFetchingService,
  rejectReraService,
  reraVerficationRequestService,
  revokeReraService,
  approveProjectReraService,
  projectReraExemptionsService,
  projectReraRequestService,
  rejectProjectReraService,
  revokeProjectReraService,
  getListingComplaintsService,
  getListingApprovalsService,
  getListingApprovalCountsService,
  approveListingMediaService,
  rejectListingMediaService,
  allowListingMediaService,
  type ListingApprovalQueue,
  takeDownListingService,
  adminListingService,
  activateTakenDownListingService,
} from "./admin.service.js";
import { BadRequestError } from "../../errors/Errors.js";
import { prisma } from "../../lib/prisma.js";
import { adminCreationValidation, reraDecisionValidation, listingRejectionValidation } from "./admin.validation.js";
import { VerificationStatus } from "../../generated/prisma/enums.js";

export const createAdmin=async(req:Request,res:Response)=>{
    const findexisting=await prisma.user.findFirst({where:{role:"ADMIN"}})
    if(findexisting) throw new BadRequestError("Admin already exist")
    const validated=adminCreationValidation.safeParse(req.body)
    if(!validated.success) throw validated.error
    const response=await adminRegisterService(validated.data.name,validated.data.email,validated.data.password)
    return res.status(201).json({message:response})
}

export const userInterestCreate=async(req:Request,res:Response)=>{
    const userId=req.user?.id;
    const listingSlug=req.params.slug as string
    if(!listingSlug) throw new BadRequestError("Invalid Link")
    const message=await interestSaveService(userId!,listingSlug)
    return res.status(201).json({ message })
}

export const fetchUserInterests=async(req:Request,res:Response)=>{
   
    const {users,total}=await interestsFetchingService()
    return res.status(200).json({message:"Interests fetched successfully",users,total})
}

export const reraVerificationRequest=async(req:Request,res:Response)=>{
    const userId=req.user?.id as string
    const type=req.query.type ?? VerificationStatus.PENDING
    const requests=await reraVerficationRequestService(userId,type as VerificationStatus)
    return res.status(200).json({message:"Fetched successfully",requests})
}

export const approveRearaVerificationRequest=async(req:Request,res:Response)=>{
    const id=req.params.id as string
    const validated=reraDecisionValidation.safeParse(req.body)
    if(!validated.success) throw validated.error
    const response=await approveRearaService(id,validated.data.reason)
    return res.status(200).json({message:response})
}

export const rejectReraVerificationRequest=async(req:Request,res:Response)=>{
    const id=req.params.id as string;
    const validated=reraDecisionValidation.safeParse(req.body)
    if(!validated.success) throw validated.error
    const response=await rejectReraService(id,validated.data.reason);
    return res.status(200).json({message:response})
}

export const revokeReraVerificationRequest=async(req:Request,res:Response)=>{
    const id=req.params.id as string;
    const validated=reraDecisionValidation.safeParse(req.body)
    if(!validated.success) throw validated.error
    const response=await revokeReraService(id,validated.data.reason);
    return res.status(200).json({message:response})
}

// ---------- the same queue, for projects ----------

export const projectReraVerificationRequest=async(req:Request,res:Response)=>{
    const type=req.query.type
    // EXEMPT is not a VerificationStatus; it is "listing on a stated exemption
    // instead of a number", which is a different column entirely.
    if(type==='EXEMPT'){
        const requests=await projectReraExemptionsService()
        return res.status(200).json({message:"Fetched successfully",requests})
    }
    const requests=await projectReraRequestService((type ?? VerificationStatus.PENDING) as VerificationStatus)
    return res.status(200).json({message:"Fetched successfully",requests})
}

export const approveProjectReraVerificationRequest=async(req:Request,res:Response)=>{
    const id=req.params.id as string
    const validated=reraDecisionValidation.safeParse(req.body)
    if(!validated.success) throw validated.error
    const response=await approveProjectReraService(id,validated.data.reason)
    return res.status(200).json({message:response})
}

export const rejectProjectReraVerificationRequest=async(req:Request,res:Response)=>{
    const id=req.params.id as string
    const validated=reraDecisionValidation.safeParse(req.body)
    if(!validated.success) throw validated.error
    const response=await rejectProjectReraService(id,validated.data.reason)
    return res.status(200).json({message:response})
}

export const revokeProjectReraVerificationRequest=async(req:Request,res:Response)=>{
    const id=req.params.id as string
    const validated=reraDecisionValidation.safeParse(req.body)
    if(!validated.success) throw validated.error
    const response=await revokeProjectReraService(id,validated.data.reason)
    return res.status(200).json({message:response})
}

export const getListingComplaints=async(req:Request,res:Response)=>{
    const type=req.query.type
    if(type && !['PENDING','RESOLVED','TAKEN_DOWN'].includes(type as string)) throw new BadRequestError("Invalid type")
    const complaints=await getListingComplaintsService(type as string|undefined)
    return res.status(200).json({message:"Fetched successfully",complaints})
}  

export const adminListing=async(req:Request,res:Response)=>{
    const slug=req.params.slug as string
    if(!slug) throw new BadRequestError("Listing not found")
    const listing=await adminListingService(slug)
    return res.status(200).json({message:"Listing fetched successfully",listing})
}

export const takeDownListing=async(req:Request,res:Response)=>{
    const listingId=req.params.id as string
    const reason=typeof req.body?.reason==="string" ? req.body.reason.trim() : ""
    if(!listingId) throw new BadRequestError("Invalid listing id")
    if(reason.length<15) throw new BadRequestError("Say why it is being taken down — the seller is told this")
    if(reason.length>300) throw new BadRequestError("Keep the reason under 300 characters")
    const listing=await prisma.listing.findUnique({where:{id:listingId}})
    if(!listing) throw new BadRequestError("Listing not found")
    const updated=await takeDownListingService(listingId,reason)
    if(!updated) throw new BadRequestError("Listing could not be taken down")
    return res.status(200).json({message:"Listing taken down successfully"})
}

export const activateTakenDownListing=async(req:Request,res:Response)=>{
    const listingId=req.params.id as string
    if(!listingId) throw new BadRequestError("Invalid listing id")
    const updated=await activateTakenDownListingService(listingId)
    if(!updated) throw new BadRequestError("Listing could not be activated")
    return res.status(200).json({message:"Listing activated successfully"})
}
const APPROVAL_QUEUES=['LIVE','DRAFTS','REJECTED'] as const

export const getListingApprovalCounts=async(_req:Request,res:Response)=>{
    const counts=await getListingApprovalCountsService()
    return res.status(200).json({message:"Fetched successfully",counts})
}

export const getListingApprovals=async(req:Request,res:Response)=>{
    const queue=(req.query.queue ?? 'LIVE') as string
    if(!APPROVAL_QUEUES.includes(queue as ListingApprovalQueue)){
        throw new BadRequestError("Invalid queue")
    }
    const listings=await getListingApprovalsService(queue as ListingApprovalQueue)
    return res.status(200).json({message:"Fetched successfully",listings})
}

export const approveListingMedia=async(req:Request,res:Response)=>{
    const listingId=req.params.id as string
    if(!listingId) throw new BadRequestError("Invalid listing id")
    const message=await approveListingMediaService(listingId)
    return res.status(200).json({message})
}

export const allowListingMedia=async(req:Request,res:Response)=>{
    const kind=req.params.kind
    const mediaId=req.params.id as string
    if(kind!=='image' && kind!=='video') throw new BadRequestError("Invalid media kind")
    if(!mediaId) throw new BadRequestError("Invalid media id")
    const message=await allowListingMediaService(kind,mediaId)
    return res.status(200).json({message})
}

export const rejectListingMedia=async(req:Request,res:Response)=>{
    const kind=req.params.kind
    const mediaId=req.params.id as string
    if(kind!=='image' && kind!=='video') throw new BadRequestError("Invalid media kind")
    if(!mediaId) throw new BadRequestError("Invalid media id")
    const validated=listingRejectionValidation.safeParse(req.body)
    if(!validated.success) throw validated.error
    const message=await rejectListingMediaService(kind,mediaId,validated.data.note)
    return res.status(200).json({message})
}
