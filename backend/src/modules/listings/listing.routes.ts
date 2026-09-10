import { Router } from "express";
import { isAuthorized } from "../../middlewares/jwtTokens.js";
import { createListingPost, deleteListing, deleteListingImage, deleteListingVideo, fetchListings, fetchSpecificListings, getAmentites, updateListing, uploadListingImages, uploadListingVideo } from "./listing.controller.js";
import { upload } from "../../lib/multer.js";

const router=Router()


router.post('/create',isAuthorized,createListingPost);
router.get('/amenities',isAuthorized,getAmentites)
router.post('/images/:id',isAuthorized,upload.array("images",10),uploadListingImages)
router.post('/video/:id',isAuthorized,upload.single("video"),uploadListingVideo)
router.get('/all',fetchListings)
router.get('/:id',fetchSpecificListings)
router.delete('/image/delete/:imageId',isAuthorized,deleteListingImage)
router.delete('/video/delete/:videoId',isAuthorized,deleteListingVideo)
router.delete('/delete/:listingId',isAuthorized,deleteListing)
router.patch('/update/:listingId',isAuthorized,updateListing)

export default router