import express from 'express';
import { approveProjectReraVerificationRequest, approveRearaVerificationRequest, createAdmin, fetchUserInterests, projectReraVerificationRequest, rejectProjectReraVerificationRequest, rejectReraVerificationRequest, reraVerificationRequest, revokeProjectReraVerificationRequest, revokeReraVerificationRequest, userInterestCreate } from './admin.controller.js';
import { isAuthorized } from '../../middlewares/jwtTokens.js';
import { requireAdmin } from '../../middlewares/requireAdmin.js';

const route=express.Router()

route.post('/interest/create/:slug',isAuthorized,userInterestCreate)
route.get('/interests',isAuthorized,requireAdmin,fetchUserInterests)
route.post('/create',createAdmin)
route.get('/rera/all',isAuthorized,requireAdmin,reraVerificationRequest)
route.patch('/rera/approve/:id',isAuthorized,requireAdmin,approveRearaVerificationRequest)
route.patch('/rera/reject/:id',isAuthorized,requireAdmin,rejectReraVerificationRequest)
route.patch('/rera/revoke/:id',isAuthorized,requireAdmin,revokeReraVerificationRequest)
route.get('/project-rera/all',isAuthorized,requireAdmin,projectReraVerificationRequest)
route.patch('/project-rera/approve/:id',isAuthorized,requireAdmin,approveProjectReraVerificationRequest)
route.patch('/project-rera/reject/:id',isAuthorized,requireAdmin,rejectProjectReraVerificationRequest)
route.patch('/project-rera/revoke/:id',isAuthorized,requireAdmin,revokeProjectReraVerificationRequest)

export default route