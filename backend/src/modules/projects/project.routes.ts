import { Router } from "express";
import { isAuthorized } from "../../middlewares/jwtTokens.js";
import { upload } from "../../lib/multer.js";
import {
  createProject,
  deleteProject,
  deleteProjectImage,
  fetchMyProjects,
  fetchProject,
  searchProjects,
  fetchProjectImages,
  updateProject,
  uploadProjectImages,
} from "./project.controller.js";

const router=Router()

router.post('/create',isAuthorized,createProject)
router.get('/mine',isAuthorized,fetchMyProjects)
router.get('/search',isAuthorized,searchProjects)
router.get('/single/:projectId',isAuthorized,fetchProject)
router.patch('/update/:projectId',isAuthorized,updateProject)
router.delete('/delete/:projectId',isAuthorized,deleteProject)
router.post('/images/:projectId',isAuthorized,upload.array("images",10),uploadProjectImages)
router.get('/images/all/:projectId',isAuthorized,fetchProjectImages)
router.delete('/image/delete/:imageId',isAuthorized,deleteProjectImage)

export default router
