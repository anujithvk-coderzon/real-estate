import type { Request,Response } from "express";
import { chatInitializationSchema, messageSendSchema } from "./chat.validation.js";
import { chatHaderFetchService, chatIntitializeService, fetchAllMessagesService, markAsReadService, messageSendService, messagesFetchService, totalUnreadService } from "./chat.service.js";
import { BadRequestError } from "../../errors/Errors.js";


export const chatInitializeController=async(req:Request,res:Response)=>{
    const userId=req.user?.id as string
    const validated=chatInitializationSchema.safeParse(req.body)
    if(!validated.success) throw validated.error
    const chatId=await chatIntitializeService(validated.data.listingSlug,userId)
    return res.status(200).json({message:"Chat created",chatId})
}

export const chatHeaderController=async(req:Request,res:Response)=>{
    const userId=req.user?.id as string
    const conversationId=req.params.id as string
    if(!conversationId) throw new BadRequestError("Conversation id required.")
    const header=await chatHaderFetchService(conversationId,userId)
    return res.status(200).json({message:"Header featched",header})
}

export const messageSendController=async(req:Request,res:Response)=>{
    const userId=req.user?.id as string
    const conversationId=req.params.id as string
    if(!conversationId) throw new BadRequestError("Conversation id required.")
    const validated=messageSendSchema.safeParse(req.body)
    if(!validated.success) throw validated.error
    const message=await messageSendService(conversationId,userId,validated.data.body)
    return res.status(201).json({message:"Message sent",data:message})
}

export const messagesFetchController=async(req:Request,res:Response)=>{
    const userId=req.user?.id as string
    const conversationId=req.params.id as string
    if(!conversationId) throw new BadRequestError("Conversation id required.")
    const messages=await messagesFetchService(conversationId,userId)
    return res.status(200).json({message:"Messages fetched",messages})
}

export const fetchAllMessagesController=async(req:Request,res:Response)=>{
    const userId=req.user?.id as string;
    const messages=await fetchAllMessagesService(userId)
    return res.status(200).json({message:"Messages fetched",messages})
}

export const totalUnreadController=async(req:Request,res:Response)=>{
    const userId=req.user?.id as string;
    const count=await totalUnreadService(userId)
    return res.status(200).json({message:"Unread fetched successfully",count})
}

export const markAsReadController=async(req:Request,res:Response)=>{
    const userId=req.user?.id as string;
    const conversationId=req.params.id as string;
    if(!conversationId) throw new BadRequestError("Conversation id required")
    const message=await markAsReadService(conversationId,userId)
    return res.status(200).json({message})
}