
const calFactor={
    SQFT:1,
    SQM:10.7639,
    CENT:435.6,
    ACRE:43560
} as const

type unitType= keyof typeof calFactor;

export const toSQFT=(value:number,unit:unitType)=>{
 return value * calFactor[unit]
}