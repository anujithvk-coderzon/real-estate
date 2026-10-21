import express from 'express';
import { isAuthorized } from '../../middlewares/jwtTokens.js';
import { chatHeaderController, chatInitializeController, fetchAllMessagesController, markAsReadController, messageSendController, messagesFetchController, totalUnreadController } from './chat.controller.js';

const route=express.Router()

route.post('/conversation',isAuthorized,chatInitializeController)
route.get('/conversation/unread',isAuthorized,totalUnreadController)
route.get('/conversation/:id',isAuthorized,chatHeaderController)
route.post('/conversation/:id/message',isAuthorized,messageSendController)
route.get('/conversation/:id/messages',isAuthorized,messagesFetchController)
route.get('/conversations',isAuthorized,fetchAllMessagesController)
route.post('/conversation/:id/read',isAuthorized,markAsReadController)
export default route