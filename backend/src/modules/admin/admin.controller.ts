import type { Request, Response } from "express";
import {
  adminRegisterService,
  approveRearaService,
  interestSaveService,
  interestsFetchingService,
  rejectReraService,
  reraVerficationRequestService,
} from "./admin.service.js";
import { BadRequestError } from "../../errors/Errors.js";
import { prisma } from "../../lib/prisma.js";
import { adminCreationValidation,} from "./admin.validation.js";
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
    const response=await approveRearaService(id)
    return res.status(200).json({message:response})
}

export const rejectReraVerificationRequest=async(req:Request,res:Response)=>{
    const id=req.params.id as string;
    const response=await rejectReraService(id);
    return res.status(200).json({message:response})
}
