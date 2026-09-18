"use client"
import * as maplibregl from 'maplibre-gl'
import "maplibre-gl/dist/maplibre-gl.css"
import { useEffect, useRef } from 'react'
type Props={
  center:[number,number],
  setLocation:(location:[number,number])=>void
}
const FALLBACK_CENTER: [number, number] = [78.9629, 20.5937];
const MapPicker = ({center,setLocation}:Props) => {
  const map=useRef<maplibregl.Map | null>(null)
  const marker=useRef<maplibregl.Marker|null>(null)
  const isFallback =
    center[0] === FALLBACK_CENTER[0] && center[1] === FALLBACK_CENTER[1];
  useEffect(() => {
    if(map.current) return;
    maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs');
    map.current=new maplibregl.Map({
      container:"map-picker",
      center,
      style:process.env.NEXT_PUBLIC_MAP_STYLE!,
      zoom: isFallback ? 4 : 12
    });
    
     marker.current=new maplibregl.Marker({draggable:true}).setLngLat(center).addTo(map.current)
     marker.current.on("dragend", () => {
      const { lng, lat } = marker.current!.getLngLat();
      setLocation([lng,lat])
    });
    map.current?.on('click', (e) => {
  marker.current?.setLngLat(e.lngLat)
  const {lng,lat}=e.lngLat
  setLocation([lng,lat])
})
 return () => {
      map.current?.remove();
      map.current = null;
      marker.current = null;
    }
  }, [])
   useEffect(() => {
    map.current?.flyTo({ center, zoom: isFallback ? 4 : 15 })
    marker.current?.setLngLat(center)
  }, [center[0], center[1]])
  return (
    <div id='map-picker' className="h-full w-full"></div>
  );
}

export default MapPicker;
