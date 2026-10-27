import express from 'express'
import { isAuthorized } from '../../middlewares/jwtTokens.js';
import { upload } from '../../lib/multer.js';
import { createPromotion, myPromotions } from './promotion.controller.js';

const route=express.Router();

route.post('/create',isAuthorized,upload.single('banner'),createPromotion)
route.get('/my',isAuthorized,myPromotions)

export default route;