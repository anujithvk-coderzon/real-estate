import { rateLimit } from "../../middlewares/rateLimit.js";
import { Router } from "express";
import { isAuthorized } from "../../middlewares/jwtTokens.js";
import { fetchSellerListings, createListingPost, setListingAvailability, deleteListing, deleteListingImage, deleteListingVideo, fetchListingImages, fetchListings, fetchListingVideo, fetchOwnerListings, fetchOwnerSpecificListing, fetchSpecificListings, geoCode, getAmentites, publishListing, reverseGeoCode, updateListing, uploadListingImages, uploadListingVideo, userSearch, similarListings, complaintListing, contactFetching} from "./listing.controller.js";
import { upload } from "../../lib/multer.js";
import { catalogueLimiter, complaintLimiter, contactRevealLimiter, mediaUploadLimiter, videoUploadLimiter } from "../../lib/rateLimiter.js";

const router=Router()


router.post('/create',isAuthorized,createListingPost);
router.patch('/publish/:id',isAuthorized,publishListing)
router.patch('/status/:id',isAuthorized,setListingAvailability)
router.get('/amenities',isAuthorized,getAmentites)
router.post('/images/:id',isAuthorized,rateLimit(mediaUploadLimiter),upload.array("images",10),uploadListingImages)
router.post('/video/:id',isAuthorized,rateLimit(videoUploadLimiter),upload.single("video"),uploadListingVideo)
router.get('/all',rateLimit(catalogueLimiter),fetchListings)
router.get('/seller/:slug',rateLimit(catalogueLimiter),fetchSellerListings)
router.get('/owner/all',isAuthorized,fetchOwnerListings)
router.get('/search',rateLimit(catalogueLimiter),userSearch)
router.get('/:id',rateLimit(catalogueLimiter),fetchSpecificListings)
router.get('/owner/:id',isAuthorized,fetchOwnerSpecificListing)
router.delete('/image/delete/:imageId',isAuthorized,deleteListingImage)
router.delete('/video/delete/:videoId',isAuthorized,deleteListingVideo)
router.get('/images/all/:id',isAuthorized,fetchListingImages)
router.get('/video/all/:id',isAuthorized,fetchListingVideo)
router.delete('/delete/:listingId',isAuthorized,deleteListing)
router.patch('/update/:listingId',isAuthorized,updateListing)
router.get('/details/geocode',geoCode)
router.get('/details/reverse',rateLimit(catalogueLimiter),reverseGeoCode)
router.get('/similar/:slug',rateLimit(catalogueLimiter),similarListings)
router.post('/complaint/:slug',isAuthorized,rateLimit(complaintLimiter),complaintListing)
router.get('/contact/:slug',isAuthorized,rateLimit(contactRevealLimiter),contactFetching)

export default router