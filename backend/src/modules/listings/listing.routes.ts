import { Router } from "express";
import { isAuthorized } from "../../middlewares/jwtTokens.js";
import { fetchSellerListings, createListingPost, setListingAvailability, deleteListing, deleteListingImage, deleteListingVideo, fetchListingImages, fetchListings, fetchListingVideo, fetchOwnerListings, fetchOwnerSpecificListing, fetchSpecificListings, geoCode, getAmentites, publishListing, reverseGeoCode, updateListing, uploadListingImages, uploadListingVideo, userSearch, similarListings, complaintListing } from "./listing.controller.js";
import { upload } from "../../lib/multer.js";

const router=Router()


router.post('/create',isAuthorized,createListingPost);

router.patch('/publish/:id',isAuthorized,publishListing)
// Availability only: SOLD, RENTED or back to ACTIVE. Separate from /update so a
// status change is its own auditable act rather than one field among forty.
router.patch('/status/:id',isAuthorized,setListingAvailability)
router.get('/amenities',isAuthorized,getAmentites)
router.post('/images/:id',isAuthorized,upload.array("images",10),uploadListingImages)
router.post('/video/:id',isAuthorized,upload.single("video"),uploadListingVideo)
router.get('/all',fetchListings)
router.get('/seller/:slug',fetchSellerListings)
router.get('/owner/all',isAuthorized,fetchOwnerListings)
router.get('/search',userSearch)
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
router.get('/similar/:slug',similarListings)
router.post('/complaint/:slug',isAuthorized,complaintListing)
export default router