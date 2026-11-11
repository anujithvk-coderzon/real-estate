/**
 * Administrative filler that carries no identity. Whole tokens only, and only
 * while something else survives.
 *
 * The removed words were measured against the 565,227 Indian place names in
 * the GeoNames IN dataset, and each one damages real names:
 *
 *   north/south/east/west -> collapses 8 distinct places onto "delhi"
 *                            (Delhi, East Delhi, North Delhi, ...), and
 *                            Goa + North Goa + South Goa onto "goa"
 *   state                 -> "West Bengal" becomes "bengal"
 *   village/gram/panchayat-> "Gram Panchayat Nahan" becomes "nahan"
 *   block/subdistrict     -> same class of damage
 *   road/street/junction  -> "Main Road" is itself a place in the dataset
 *
 * With nameKey unique, a collapse does not just mis-match - it DISCARDS rows
 * at import. Seven of those eight Delhis would never reach the table.
 *
 * Address filler ("house", "floor", "flat", "bldg") cannot live here either.
 * It belongs to address parsing, a separate problem - this function has to
 * produce identical keys on both sides of the lookup, and the gazetteer side
 * is place names, not addresses.
 */
const NOISE = new Set([
  "dist", "distt", "district",
  "taluk", "taluka", "tehsil", "teh", "mandal",
  "po", "via", "pin", "pincode",
  "india", "bharat",
  "near", "opp", "opposite", "behind",
]);

/**
 * Keys shorter than this are rejected at import and at query time. Two-letter
 * keys are almost all noise ("WB", "PO") and sit within one edit of hundreds
 * of real names, so they are a liability in fuzzy matching. Only 77 of the
 * 331k dataset keys fall below it.
 */
export const MIN_KEY_LENGTH = 3;


/**
 * The one standard form a place name is compared in.
 *
 * Used BOTH when writing rows into place_names and when looking a query up.
 * If the two sides ever compute a key differently, every lookup silently finds
 * nothing - no error, no crash, nothing in any log. So: one implementation,
 * pure, and it never reads config, locale or the clock.
 */
export const normalizePlaceName=(place:string):string=>{
    const cleaned=place
        // NFD splits an accented letter into base + combining mark so the next
        // step can delete the mark and keep the base: "Pondich\u00e9ry" -> "pondichery".
        // The GeoNames import does not need this (that file ships an asciiname
        // column) but pasted user input does.
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        // Apostrophes join, they do not split: "O'Brien" is one word.
        .replace(/['\u2018\u2019\u02bc`]/g, "")
        // One pass for "." "," "-" "/" "(" and runs of spaces.
        .replace(/[^a-z0-9]+/g, " ")
        // After the line above, never before - that line is what creates the
        // stray leading and trailing spaces.
        .trim()
        // Recompose, so a stored key does not depend on which Unicode form the
        // input arrived in.
        .normalize("NFC")

    if(cleaned === "") return ""

    const words=cleaned.split(" ")
    const kept=words.filter(word=>!NOISE.has(word))

    // If filler removal emptied it, keep what was typed. An empty key would
    // match the empty key of every malformed row.
    return (kept.length >0 ? kept : words).join(" ")
}