import { Router } from "express";
import { isAuthorized } from "../../middlewares/jwtTokens.js";
import { createListingPost, deleteListing, deleteListingImage, deleteListingVideo, fetchListingImages, fetchListings, fetchListingVideo, fetchOwnerListings, fetchOwnerSpecificListing, fetchSpecificListings, geoCode, getAmentites, publishListing, reverseGeoCode, updateListing, uploadListingImages, uploadListingVideo } from "./listing.controller.js";
import { upload } from "../../lib/multer.js";

const router=Router()


router.post('/create',isAuthorized,createListingPost);
router.patch('/publish/:id',isAuthorized,publishListing)
router.get('/amenities',isAuthorized,getAmentites)
router.post('/images/:id',isAuthorized,upload.array("images",10),uploadListingImages)
router.post('/video/:id',isAuthorized,upload.single("video"),uploadListingVideo)
router.get('/all',fetchListings)
router.get('/owner/all',isAuthorized,fetchOwnerListings)
router.get('/:id',fetchSpecificListings)
router.get('/owner/:id',isAuthorized,fetchOwnerSpecificListing)
router.delete('/image/delete/:imageId',isAuthorized,deleteListingImage)
router.delete('/video/delete/:videoId',isAuthorized,deleteListingVideo)
router.get('/images/all/:id',isAuthorized,fetchListingImages)
router.get('/video/all/:id',isAuthorized,fetchListingVideo)
router.delete('/delete/:listingId',isAuthorized,deleteListing)
router.patch('/update/:listingId',isAuthorized,updateListing)
router.get('/details/geocode',geoCode)
router.get('/details/reverse',reverseGeoCode)

export default router