import express from 'express';
import { approveRearaVerificationRequest, createAdmin, fetchUserInterests, rejectReraVerificationRequest, reraVerificationRequest, userInterestCreate } from './admin.controller.js';
import { isAuthorized } from '../../middlewares/jwtTokens.js';
import { requireAdmin } from '../../middlewares/requireAdmin.js';

const route=express.Router()

route.post('/interest/create/:slug',isAuthorized,userInterestCreate)
route.get('/interests',isAuthorized,requireAdmin,fetchUserInterests)
route.post('/create',createAdmin)
route.get('/rera/all',isAuthorized,requireAdmin,reraVerificationRequest)
route.patch('/rera/approve/:id',isAuthorized,requireAdmin,approveRearaVerificationRequest)
route.patch('/rera/reject/:id',isAuthorized,requireAdmin,rejectReraVerificationRequest)

export default route