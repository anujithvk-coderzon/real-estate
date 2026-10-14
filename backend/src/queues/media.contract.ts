export const MEDIA_QUEUE="media"

export type MediaCleanupJob=
| {kind:"listingFolder";listingId:string}
| {kind:"image";path:string}
| {kind:"video";videoId:string}