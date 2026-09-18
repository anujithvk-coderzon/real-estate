"use client"
import { api, setAccessToken } from "@/lib/api"
import { useEffect, useRef } from "react"

export const AuthBootStrap=()=>{
    const done=useRef(false)
    useEffect(() => {
       if(done.current) return
       done.current=true
       api.post('/auth/refresh')
       .then(({data})=>setAccessToken(data.accessToken))
       .catch(()=>{
       
       })
    }, []);
    return null
}

export default AuthBootStrap