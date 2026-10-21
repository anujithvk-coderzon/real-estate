import type { Request, Response } from "express";
import {
  adminRegisterService,
  interestSaveService,
  interestsFetchingService,
} from "./admin.service.js";
import { BadRequestError } from "../../errors/Errors.js";
import { prisma } from "../../lib/prisma.js";
import { adminCreationValidation, interestsTake } from "./admin.validation.js";

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
    const page=Number(req.query.page) || 1
    const take=interestsTake.safeParse(req.query.take)
    if(!take.success) throw take.error
    const {interests,total}=await interestsFetchingService(page,take.data)
    return res.status(200).json({message:"Interests fetched successfully",interests,total})
}