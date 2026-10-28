import express from 'express'
import { isAuthorized } from '../../middlewares/jwtTokens.js';
import { upload } from '../../lib/multer.js';
import { togglePromotion, allPromotions, createPromotion, myPromotions, showActivePromotions } from './promotion.controller.js';
import { requireAdmin } from '../../middlewares/requireAdmin.js';

const route=express.Router();
route.get('/active',showActivePromotions)
route.post('/create',isAuthorized,upload.single('banner'),createPromotion)
route.get('/my',isAuthorized,myPromotions)
route.get('/all',isAuthorized,requireAdmin,allPromotions)
route.patch('/:id',isAuthorized,requireAdmin,togglePromotion)
export default route;