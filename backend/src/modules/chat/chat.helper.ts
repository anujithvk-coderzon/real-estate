import { NotFoundError } from "../../errors/Errors.js"
import { prisma } from "../../lib/prisma.js"

export const conversationSide=async(conversationId:string,userId:string)=>{
 const conversation=await prisma.conversation.findUnique({where:{id:conversationId},select:{buyerId:true,sellerId:true}})
 if(!conversation) throw new NotFoundError("Conversation not found")
 if(conversation.buyerId===userId) return "buyer" as const
 if(conversation.sellerId===userId) return "seller" as const
 throw new NotFoundError("Conversation not found")
}
