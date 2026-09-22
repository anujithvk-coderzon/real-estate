export const boxAround=(lat:number,lon:number,km:number)=>{
    const latStep=km/111;
    const lonStep=km/(111 * Math.cos((lat * Math.PI)/180));
    return {
        latitude:{gte: lat -latStep,lte: lat+latStep},
        longitude:{gte: lon - lonStep, lte: lon + lonStep}
    }
}

export const distanceKm=(lat1:number,lon1:number,lat2:number,lon2:number)=>{
    const r=(d:number)=>(d*Math.PI)/180
    const a=Math.sin(r(lat2-lat1)/2) ** 2 + Math.cos(r(lat1))*Math.cos(r(lat2))*Math.sin(r(lon2-lon1)/2) ** 2;
    return 12742 * Math.asin(Math.sqrt(a))
};

