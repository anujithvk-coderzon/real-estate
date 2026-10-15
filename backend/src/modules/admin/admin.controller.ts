import type { Request, Response } from "express";
import { adminRegisterService, interestSaveService } from "./admin.service.js";
import { BadRequestError } from "../../errors/Errors.js";
import { prisma } from "../../lib/prisma.js";
import { adminCreationValidation } from "./admin.validation.js";

export const createAdmin=async(req:Request,res:Response)=>{
    const findexisting=await prisma.user.findFirst({where:{role:"ADMIN"}})
    if(findexisting) throw new BadRequestError("Admin already exist")
    const validated=adminCreationValidation.safeParse(req.body)
    if(!validated.success) throw validated.error
    const response=await adminRegisterService(validated.data.name,validated.data.email,validated.data.password)
    return res.status(201).json({message:response})
}

export const userInterestCreate=async(req:Request,_res:Response)=>{
    const userId=req.user?.id;
    const listingSlug=req.params.slug as string
    if(!listingSlug) throw new BadRequestError("Invalid Link")
    console.log(userId,listingSlug);
    const response=await interestSaveService(userId!,listingSlug)
    console.log(response);
}