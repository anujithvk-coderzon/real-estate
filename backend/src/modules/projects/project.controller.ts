import type { Request, Response } from "express";
import { BadRequestError, UnauthorizedError } from "../../errors/Errors.js";
import {
  builderProjectService,
  builderProjectsService,
  createProjectService,
  deleteProjectService,
  projectImageDeleteService,
  projectImagesService,
  projectImageUploadService,
  projectSearchService,
  updateProjectService,
} from "./project.service.js";
import { projectCreateValidation, projectUpdateValidation } from "./project.validation.js";

export const createProject=async(req:Request,res:Response)=>{
  const userId=req.user?.id as string;
  const validated=projectCreateValidation.safeParse(req.body)
  if(!validated.success) throw validated.error;
  const project=await createProjectService(userId,validated.data)
  return res.status(201).json({message:"Project added successfully",project})
}

export const updateProject=async(req:Request,res:Response)=>{
  const userId=req.user?.id as string;
  const projectId=req.params?.projectId as string
  if(!projectId) throw new BadRequestError("Project Id required")
  const validated=projectUpdateValidation.safeParse(req.body)
  if(!validated.success) throw validated.error;
  const project=await updateProjectService(userId,projectId,validated.data)
  return res.status(200).json({message:"Project updated successfully",project})
}

export const deleteProject=async(req:Request,res:Response)=>{
  const userId=req.user?.id as string;
  const projectId=req.params?.projectId as string
  if(!projectId) throw new BadRequestError("Project Id required")
  const response=await deleteProjectService(userId,projectId)
  return res.status(200).json({message:response})
}

export const fetchMyProjects=async(req:Request,res:Response)=>{
  const userId=req.user?.id;
  if(!userId) throw new UnauthorizedError("Unauthorized")
  const projects=await builderProjectsService(userId)
  return res.status(200).json({message:"Projects fetched successfully",projects})
}

export const fetchProject=async(req:Request,res:Response)=>{
  const userId=req.user?.id as string;
  const projectId=req.params?.projectId as string
  if(!projectId) throw new BadRequestError("Project Id required")
  const project=await builderProjectService(userId,projectId)
  return res.status(200).json({message:"Project fetched successfully",project})
}

export const uploadProjectImages=async(req:Request,res:Response)=>{
  const userId=req.user?.id as string;
  const projectId=req.params?.projectId as string
  if(!projectId) throw new BadRequestError("Project Id required")
  const images=req.files as Express.Multer.File[]
  if(!images || images.length===0) throw new BadRequestError("No photos to upload")
  const response=await projectImageUploadService(userId,projectId,images)
  return res.status(201).json({message:response})
}

export const fetchProjectImages=async(req:Request,res:Response)=>{
  const userId=req.user?.id as string;
  const projectId=req.params?.projectId as string
  if(!projectId) throw new BadRequestError("Project Id required")
  const response=await projectImagesService(userId,projectId)
  return res.status(200).json({message:"Photos fetched successfully",...response})
}

export const deleteProjectImage=async(req:Request,res:Response)=>{
  const userId=req.user?.id as string;
  const imageId=req.params?.imageId as string
  if(!imageId) throw new BadRequestError("Photo Id required")
  const response=await projectImageDeleteService(userId,imageId)
  return res.status(200).json({message:response})
}


export const searchProjects=async(req:Request,res:Response)=>{
  const query=String(req.query.q ?? "")
  const {projects,more}=await projectSearchService(query)
  return res.status(200).json({message:"Projects fetched successfully",projects,more})
}
