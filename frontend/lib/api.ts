import axios from "axios";
import { error } from "console";

let accessToken:string|null = null

export const setAccessToken=(token:string|null)=>{
    accessToken=token
}
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
    if(error.response?.status === 401 && !original._retry){
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
             if (typeof window !== "undefined" && !window.location.pathname.startsWith("/auth")) {
   setTimeout(() => {
      window.location.href = "/auth/login";
    }, 1500)
  }
        }
    }
    return Promise.reject(error)
}
)
