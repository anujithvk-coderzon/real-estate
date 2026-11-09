import { RADIUS_OPTIONS } from "@/lib/listing";

// How much to trust a browser position fix, and what a search is allowed to do
// with one.
//
// `coords.accuracy` from the Geolocation API is a radius in metres: the browser
// is 95% confident the visitor is somewhere inside a circle that big. It is the
// only honest measure of a fix, and it means the same thing on a phone holding
// GPS satellites and on a desktop placed by its IP address — which is why
// nothing here asks what kind of device it is.
//
// The question is not "is this fix good" but "can a search of radius R around
// it tell the visitor anything true", and that has a geometric answer. Search
// R km around a point that is d km from where the visitor really stands, and
// this is the share of the area they care about that actually gets looked at:
//
//     R = 10 km, off by 21 km ->   0.0%    results can be up to 31 km away
//     R = 10 km, off by 14 km ->  18.8%
//     R = 20 km, off by 21 km ->  36.4%    results can be up to 41 km away
//     R = 20 km, off by 14 km ->  56.4%
//     R = 50 km, off by 21 km ->  73.5%
//     R = 50 km, off by 14 km ->  82.2%
//
// (d is the error actually made. accuracy is the 95% bound on it, so the worst
// row for a given accuracy is d = accuracy, and the typical case is nearer
// d = 2/3 accuracy — the mean distance from the centre of a disc.)
//
// Two thresholds fall out of that table, and both of them are facts rather
// than taste.

// At accuracy >= 2R the two circles cannot touch: the search point is more
// than 2R from the visitor, so every property within R of the visitor is
// outside a circle of radius R around the search point, and everything the
// search does return is at least R away from them. 0.0% in the table. There is
// no honest result to show, however many properties are genuinely nearby, and
// this is the one case worth refusing.
export const DEAD_FIX_MULTIPLE = 2;

// Below accuracy = R/2 the overlap is good enough that saying nothing is fair:
// the error is small against the circle it sits in, and a distance label is
// right to within a fraction of the radius.
//
// Expressed as a share of the radius rather than as a number of metres,
// because the radius is the visitor's to choose: 5 km of error is useless
// against a 10 km search and unremarkable against a 50 km one.
export const GOOD_FIX_SHARE = 0.5;

// Between the two the search is worth running and not worth stating as fact.
// This is the grade that earns the "approximate" wording, the uncertainty
// circle on the map and the ~ on every distance: more than half the results
// are usually genuinely near the visitor, and no single distance can be
// trusted to the kilometre.
export type FixGrade = "good" | "approximate" | "useless";

export const gradeFix = (
  accuracyMetres: number,
  radiusKm: number,
): FixGrade => {
  const accuracyKm = accuracyMetres / 1000;
  if (accuracyKm >= radiusKm * DEAD_FIX_MULTIPLE) return "useless";
  if (accuracyKm > radiusKm * GOOD_FIX_SHARE) return "approximate";
  return "good";
};

// Ceil, not round: this is an error bar, and the honest direction to round one
// is outwards. It also keeps the number off the radius it is shown beside —
// a 20.4 km error rounding to "20" next to a 20 km search was a sentence that
// refused itself.
export const fixErrorKm = (accuracyMetres: number) =>
  Math.ceil(accuracyMetres / 1000);

// The narrowest distance on offer that this fix is not hopeless for, so a
// refusal can name a search that would work instead of just saying no.
//
// Strictly greater than accuracy/2, which is DEAD_FIX_MULTIPLE read backwards:
// the smallest R with any overlap at all. Undefined when even 50 km cannot
// help, which is the only time there is nothing to suggest.
export const widerRadiusFor = (accuracyMetres: number) =>
  RADIUS_OPTIONS.find(
    (option) =>
      Number(option.value) > accuracyMetres / 1000 / DEAD_FIX_MULTIPLE,
  );
