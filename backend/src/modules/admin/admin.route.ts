import express from 'express';
import { createAdmin, userInterestCreate } from './admin.controller.js';
import { isAuthorized } from '../../middlewares/jwtTokens.js';

const route=express.Router()

route.post('/interest/create/:slug',isAuthorized,userInterestCreate)
route.post('/create',createAdmin)

export default route