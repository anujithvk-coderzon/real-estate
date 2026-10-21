import type { Server } from "node:http";
import {WebSocketServer, type WebSocket} from 'ws'
import { accessTokenVerification } from "../../middlewares/jwtTokens.js";

type ChatClient = WebSocket & {
    userId?:string,
};

const LOGIN_TIME_LIMIT=10_000;
const LOGIN_FAILED=4001;

let socketServer:WebSocketServer|null

export const startChatSocketServer=(httpServer:Server)=>{
    socketServer=new WebSocketServer({
        server:httpServer,
        path:"/ws/chat"
    })
    socketServer.on("connection",(client:ChatClient)=>{
        const loginTimer=setTimeout(()=>{
                client.close(LOGIN_FAILED,"Login never arrived");
        },LOGIN_TIME_LIMIT);

        client.on("message",async(incoming)=>{
            let event
            try {
                event=JSON.parse(incoming.toString())
            } catch  {
                return;
            };

            if(event.type==="login"){
                if(client.userId) return
                if(typeof event.token !== "string") return;
                try {
                    const user=await accessTokenVerification(event.token)
                    client.userId=user.id as string
                    clearTimeout(loginTimer);
                    client.send(JSON.stringify({type:"logged-in",userId:client.userId}))
                    console.log("[chat] logged in:",client.userId);
                } catch {
                    client.close(LOGIN_FAILED,"Invalid token")
                }
                return;
            }
            if(!client.userId) return;
            console.log("[Chat] from",client.userId,event);
        });
        client.on("close",()=>{
            clearTimeout(loginTimer);
            console.log("[chat] closed",client.userId ?? "a stranger");
        })
    })
    console.log("[chat] socket server ready on /ws/chat");
    
}

export const sendToUser=(userId:string,event:object)=>{
    if(!socketServer) return;
    const Payload=JSON.stringify(event)
    for(const client of socketServer.clients as Set<ChatClient>){
        if(client.userId===userId && client.readyState===client.OPEN){
            client.send(Payload)     
        }
    }
}