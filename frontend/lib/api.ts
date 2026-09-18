import axios from "axios";
import { error } from "console";

let accessToken:string|null = null

export const setAccessToken=(token:string|null)=>{
    accessToken=token
}

// Settles once the first /auth/refresh after a page load has finished, signed in
// or not. Pages that show more to signed-in users wait for it, so their first
// request already carries the token.
let markReady:()=>void
export const authReady=new Promise<void>((resolve)=>{markReady=resolve})
export const setAuthReady=()=>markReady()

// True when this tab holds an access token, i.e. the user is signed in.
export const isSignedIn=()=>accessToken!==null
export const api=axios.create({
    baseURL:process.env.NEXT_PUBLIC_BACKEND_URL,  
    timeout:10_000, 
    withCredentials:true
})

api.interceptors.request.use((config)=>{
    if(accessToken){
        config.headers.Authorization= `Bearer ${accessToken}`
    }
    return config
})

api.interceptors.response.use((response)=>response,
async(error)=>{
    const original=error.config;
    // A failed /auth/refresh is final: retrying it would just call refresh again.
    if(error.response?.status === 401 && !original._retry && original.url !== "/auth/refresh"){
        original._retry=true;
        try {
            const {data}=await axios.post(
                `${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/refresh`,
                {},
                {withCredentials:true}
            );
            setAccessToken(data.accessToken);
            original.headers.Authorization=`Bearer ${data.accessToken}`;
            return api(original)
        } catch {
            setAccessToken(null)
             // Only signed-in pages (under /list) send visitors to login.
             // Public pages like the landing page stay open to everyone.
             if (typeof window !== "undefined" && window.location.pathname.startsWith("/list")) {
   setTimeout(() => {
      window.location.href = "/auth/login";
    }, 1500)
  }
        }
    }
    return Promise.reject(error)
}
)
