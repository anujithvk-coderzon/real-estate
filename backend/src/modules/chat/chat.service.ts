
import { BadRequestError, NotFoundError } from "../../errors/Errors.js"
import { avatarPublicUrl } from "../../lib/bunny.js"
import { prisma } from "../../lib/prisma.js"
import { conversationSide } from "./chat.helper.js"
import { sendToUser } from "./chat.socket.js"


export const chatIntitializeService=async(slug:string,userId:string)=>{
    const listing=await prisma.listing.findUnique({where:{slug}})
    if(!listing) throw new NotFoundError("Listing not found")
    if(listing.ownerId===userId) throw new BadRequestError("This is your listing")
    if(listing.status!=='ACTIVE') throw new BadRequestError("This is not a active listing")
    const conversation=await prisma.conversation.upsert({where:{listingId_buyerId:{listingId:listing.id,buyerId:userId}},create:{buyerId:userId,sellerId:listing.ownerId,listingId:listing.id},update:{},select:{id:true}})
    return conversation.id
}

export const chatHaderFetchService=async(conversationId:string,userId:string)=>{
  const conversation=await prisma.conversation.findUnique({where:{id:conversationId},
   select:{buyerId:true,sellerId:true,buyer:{select:{avatarUrl:true,name:true}},seller:{select:{avatarUrl:true,name:true}},listing:{select:{title:true,price:true,slug:true},}}
  })
  if(!conversation) throw new NotFoundError("Conversation not found")
 const other=conversation.buyerId === userId ?
        conversation.seller : conversation.buyer
  const result={
  listing:conversation.listing,
  user:{
    name:other.name,
    avatarUrl:avatarPublicUrl(other.avatarUrl)
  },
  type:conversation.sellerId===userId ? "Buyer":"Owner"
}
return result
}

export const messageSendService=async(conversationId:string,userId:string,body:string)=>{
    const side=await conversationSide(conversationId,userId)
    const now=new Date()
    const [message,conversation]=await prisma.$transaction([
        prisma.message.create({
            data:{conversationId,senderId:userId,body},
        }),
        prisma.conversation.update({
            where:{id:conversationId},
            data:{
                lastMessageAt:now,
                lastMessageText:body.slice(0,120),
                ...(side==='buyer' ? {sellerUnread:{increment:1}}:{buyerUnread:{increment:1}})
            }
        })
    ]) 
    const recipientId=side==='buyer'?conversation.sellerId:conversation.buyerId
    sendToUser(recipientId,{type:"message",conversationId,message})
    console.log(message);
    
    return message
}

export const messagesFetchService=async(conversationId:string,userId:string)=>{
    await conversationSide(conversationId,userId)
    const messages=await prisma.message.findMany({
        where:{conversationId},
        orderBy:{createdAt:"desc"}
    })
    return messages.reverse()
}

export const fetchAllMessagesService=async(userId:string)=>{
    const messages=await prisma.conversation.findMany({where:{OR:[{buyerId:userId},{sellerId:userId}]},select:{lastMessageAt:true,buyerId:true,sellerId:true,id:true,lastMessageText:true,buyerUnread:true,sellerUnread:true,listing:{select:{ title:true}},buyer:{select:{avatarUrl:true,name:true}},seller:{select:{avatarUrl:true,name:true}}},orderBy:{lastMessageAt:"desc"}})
    const result=messages.map((conversation)=>{
        const isBuyer=conversation.buyerId===userId;
        return {
            id:conversation.id,
            lastMessageText:conversation.lastMessageText,
            lastMessageAt:conversation.lastMessageAt,
            unreadCount:isBuyer ? conversation.buyerUnread : conversation.sellerUnread,
            name: isBuyer ? conversation.seller.name : conversation.buyer.name,
            avatar:isBuyer ? avatarPublicUrl(conversation.seller.avatarUrl) : avatarPublicUrl(conversation.buyer.avatarUrl),
            title:conversation.listing.title
        }
    })
    return result
}
export const totalUnreadService=async(userId:string)=>{
 const [asBuyer,asSeller]=await prisma.$transaction([
    prisma.conversation.aggregate({where:{buyerId:userId},_sum:{buyerUnread:true}}),
    prisma.conversation.aggregate({where:{sellerId:userId},_sum:{sellerUnread:true}})
 ])
 return (asBuyer._sum.buyerUnread ?? 0)+(asSeller._sum.sellerUnread ?? 0)
}
export const markAsReadService=async(conversationId:string,userId:string)=>{
const side=await conversationSide(conversationId,userId)
await prisma.conversation.update({where:{id:conversationId},data:side==='buyer' ? {buyerUnread:0}:{sellerUnread:0}})
sendToUser(userId,{type:"read",conversationId})
return "Conversation marked read"
}
