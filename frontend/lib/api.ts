import axios from "axios";

let accessToken:string|null = null

export const setAccessToken=(token:string|null)=>{
    accessToken=token
}

// The chat socket needs it: new WebSocket() cannot send an Authorization
// header, so the token travels in the first frame instead.
export const getAccessToken=()=>accessToken


let markReady:()=>void
export const authReady=new Promise<void>((resolve)=>{markReady=resolve})
export const setAuthReady=()=>markReady()
export const isSignedIn=()=>accessToken!==null


export const api=axios.create({
    baseURL:"/api",  
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
    if(error.response?.status === 401 && !original._retry && original.url !== "/auth/refresh"){
        original._retry=true;
        try {
            const {data}=await axios.post(
                "/api/auth/refresh",
                {},
                {withCredentials:true}
            );
            setAccessToken(data.accessToken);
            original.headers.Authorization=`Bearer ${data.accessToken}`;
            return api(original)
        } catch {
            setAccessToken(null)
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
