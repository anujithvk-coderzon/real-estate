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
} from "./admin.service.js";
import { BadRequestError } from "../../errors/Errors.js";
import { prisma } from "../../lib/prisma.js";
import { adminCreationValidation, reraDecisionValidation,} from "./admin.validation.js";
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

