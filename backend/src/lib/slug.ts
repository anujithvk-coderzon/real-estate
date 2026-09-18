

export const listNameSluggify=(name:string)=>{
    const slug=name.trim().toLocaleLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-")
    return `${slug}-${Date.now()}`
}