// Alternate and historical names for states and union territories.
// Verified against the Local Government Directory, the Legislative
// Department's list of Central Acts, and the relevant gazette notifications.
//
// Four kinds of entry live here, and the distinction matters:
//   1. Former OFFICIAL names - Orissa, Uttaranchal, Pondicherry, Madras State,
//      Mysore State, Laccadives, and the two pre-2020 UT names that legacy
//      addresses still carry as their state value.
//   2. Standard two-letter codes. Only the ones that do not already resolve by
//      prefix are listed: "AS" needs no alias because Assam starts with it,
//      but "HR" does, because without it "hr" matched Andhra Pradesh - the
//      substring sits inside "andhra".
//   3. Misspellings Indians actually type. No official source exists for these
//      by definition; they are here because the field must not dead-end.
//   4. Ampersand and spacing variants, which GoI's own sites use inconsistently.
//
// Deliberately NOT here, and why:
//   "NCR" / "Delhi NCR" - the National Capital Region spans Delhi plus
//      districts of Haryana, Uttar Pradesh and Rajasthan, so it would misfile.
//   "Bombay State", "Hyderabad State", "East Punjab" - each was split across
//      several modern states, so none maps to one answer.
//   "Travancore", "Cochin" - not co-extensive with modern Kerala; Kanyakumari
//      went to Madras State in 1956.
//   Bare city names (Bombay, Madras, Mysore, Jammu, Daman) - they belong in the
//      city layer. "Madras State" and "Mysore State" stay: those were real
//      state names.

export const STATE_ALIASES: Readonly<Record<string, readonly string[]>> = {
  "Andaman and Nicobar Islands": ["Andaman and Nicobar", "Andaman & Nicobar", "Andaman & Nicobar Islands", "Andamans", "A&N Islands", "A & N Islands", "AN"],
  "Andhra Pradesh": ["AP", "Andhra"],
  "Arunachal Pradesh": ["Arunachal", "AR"],
  "Assam": ["AS"],
  "Bihar": ["BR"],
  "Chandigarh": ["CH"],
  "Chhattisgarh": ["Chattisgarh", "Chatisgarh", "Chhatisgarh", "CG"],
  "Dadra and Nagar Haveli and Daman and Diu": ["Dadra and Nagar Haveli", "Dadra & Nagar Haveli", "Daman and Diu", "Daman & Diu", "Dadra & Nagar Haveli and Daman & Diu", "Dadra and Nagar Haveli & Daman and Diu", "Silvassa", "DD", "DN", "DNH"],
  "Delhi": ["New Delhi", "NCT of Delhi", "National Capital Territory of Delhi", "NCT Delhi", "Delhi NCT", "DL"],
  "Goa": ["GA"],
  "Gujarat": ["GJ"],
  "Haryana": ["Harayana", "HR"],
  "Himachal Pradesh": ["HP", "Himachal"],
  "Jammu and Kashmir": ["J&K", "Jammu & Kashmir", "J and K", "J & K", "JK"],
  "Jharkhand": ["Jharkand", "JH"],
  "Karnataka": ["Mysore State", "Karnatka", "KA"],
  // The Kerala (Alteration of Name) Act, 2026 is in force (25 Aug 2026), but
  // government sites and every existing address still say Kerala, so Kerala
  // stays canonical and the new legal name resolves as an alias.
  "Kerala": ["Keralam", "Kerela", "KL"],
  "Ladakh": ["LA"],
  "Lakshadweep": ["Laccadives", "Lakshdweep", "LD"],
  "Madhya Pradesh": ["MP"],
  "Maharashtra": ["Maharastra", "Maharashta", "MH"],
  "Manipur": ["MN"],
  "Meghalaya": ["Megalaya", "ML"],
  "Mizoram": ["MZ"],
  "Nagaland": ["NL"],
  "Odisha": ["Orissa", "Odhisa", "Orrisa", "OD", "OR"],
  "Puducherry": ["Pondicherry", "Pondy", "Pondichery", "Puduchery", "Pudducherry", "PY"],
  "Punjab": ["PB"],
  "Rajasthan": ["Rajastan", "RJ"],
  "Sikkim": ["SK"],
  "Tamil Nadu": ["Tamilnadu", "Madras State", "TN"],
  "Telangana": ["Telengana", "Telangna", "TS", "TG"],
  "Tripura": ["TR"],
  "Uttar Pradesh": ["UP"],
  "Uttarakhand": ["Uttaranchal", "Uttrakhand", "UK", "UKD"],
  "West Bengal": ["Bengal", "Westbengal", "WB"],
};

export const stateAliasesFor = (state: string): readonly string[] =>
  STATE_ALIASES[state] ?? [];
