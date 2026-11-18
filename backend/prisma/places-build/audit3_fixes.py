"""Round-three corrections, from the remaining auditors plus two of my own
regressions that they caught.

Note on tiers: India Post has no notion of a municipality, and the Census town
directory misses some large bodies entirely, so a few major towns sit at
"locality". Rather than invent a population rule, the ones the auditors named
with a source are set explicitly.
"""

RELOCATE = {
 # Maharashtra: the Palghar split moves whole TALUKAS, and only six towns had
 # been moved. These ten are the rest.
 ("Maharashtra","Wada"):"Palghar", ("Maharashtra","Vada"):"Palghar",
 ("Maharashtra","Manor"):"Palghar", ("Maharashtra","Tarapur"):"Palghar",
 ("Maharashtra","Chinchani"):"Palghar", ("Maharashtra","Kudus"):"Palghar",
 ("Maharashtra","Pasthal"):"Palghar", ("Maharashtra","Shirgaon"):"Palghar",
 ("Maharashtra","Dandi"):"Palghar", ("Maharashtra","Chandrapada"):"Palghar",
 ("Maharashtra","Umbar Pada Nandade"):"Palghar",
 # Karnataka: Bengaluru Rural dates from 1986 and held nothing
 ("Karnataka","Dod Ballapur"):"Bengaluru Rural",
 ("Karnataka","Doddaballapur"):"Bengaluru Rural",
 ("Karnataka","Devanahalli"):"Bengaluru Rural", ("Karnataka","Hoskote"):"Bengaluru Rural",
 ("Karnataka","Nelamangala"):"Bengaluru Rural", ("Karnataka","Vijayapura"):"Bengaluru Rural",


 # Andersonpet softened by the auditor to a strong suspicion - no government
 # page names its district - so it is left where it is.
 # ("Karnataka","Andersonpet"):"Kolar",
 # Vijayanagara district (2021) never received its towns
 ("Karnataka","Hospet"):"Vijayanagara", ("Karnataka","Hosapete"):"Vijayanagara",
 ("Karnataka","Kotturu"):"Vijayanagara", ("Karnataka","Kudligi"):"Vijayanagara",
 ("Karnataka","Hoovina Hadagalli"):"Vijayanagara",
 ("Karnataka","Kamalapuram"):"Vijayanagara",
 ("Karnataka","Hagaribommanahalli"):"Vijayanagara",
 ("Karnataka","Mariammanahalli"):"Vijayanagara",
 ("Karnataka","Harapanahalli"):"Vijayanagara",
 # Manipur / Meghalaya
 ("Manipur","Saikul"):"Kangpokpi",
 ("Meghalaya","Khliehriat"):"East Jaintia Hills",
 ("Meghalaya","Mawkyrwat"):"South West Khasi Hills",
 # Tripura's 2012 reorganisation was never applied: four district HQs among
 # eight municipal councils left in the wrong district.
 ("Tripura","Khowai"):"Khowai", ("Tripura","Teliamura"):"Khowai",
 ("Tripura","Sonamura"):"Sepahijala", ("Tripura","Bishalgarh"):"Sepahijala",
 ("Tripura","Udaipur"):"Gomati", ("Tripura","Amarpur"):"Gomati",
 ("Tripura","Kailasahar"):"Unakoti", ("Tripura","Kumarghat"):"Unakoti",
 ("Tripura","Chandigarh"):"Sepahijala",
 # West Bengal: Paschim Bardhaman's own block HQs stayed with the parent
 ("West Bengal","Kanksa"):"Paschim Bardhaman", ("West Bengal","Salanpur"):"Paschim Bardhaman",
 ("West Bengal","Burnpur"):"Paschim Bardhaman",
 ("West Bengal","Matigara"):"Darjeeling",
 # Uttar Pradesh: four unfinished 2011 splits
 ("Uttar Pradesh","Kandhla"):"Shamli", ("Uttar Pradesh","Thanabhawan"):"Shamli",
 ("Uttar Pradesh","Banat"):"Shamli", ("Uttar Pradesh","Garhi Pukhta"):"Shamli",
 ("Uttar Pradesh","Garhmukteshwar"):"Hapur", ("Uttar Pradesh","Babugarh"):"Hapur",
 ("Uttar Pradesh","Gunnaur"):"Sambhal", ("Uttar Pradesh","Amethi"):"Amethi",
 ("Uttarakhand","Devprayag"):"Tehri Garhwal", ("Uttarakhand","Devaprayag"):"Tehri Garhwal",
 # A second verification pass widened these two: 7 of Shamli's 10 ULBs and
 # 5 of Sambhal's 8 were stranded, not 4 and 3.
 ("Uttar Pradesh","Ailam"):"Shamli", ("Uttar Pradesh","Jalalabad"):"Shamli",
 ("Uttar Pradesh","Babrala"):"Sambhal", ("Uttar Pradesh","Gawan"):"Sambhal",
 ("Uttar Pradesh","Sirsi"):"Sambhal", ("Uttar Pradesh","Narauli"):"Sambhal",
 ("West Bengal","Nimsa"):"Paschim Bardhaman",
}

RESPELL = {
 # my regression: the twin-city census row and the India Post row were two
 # rows. One corporation, canonical on the name India Post uses.
 ("Karnataka","Hubli-Dharwad"):"Hubballi",
 ("Karnataka","Dod Ballapur"):"Doddaballapur",
 ("Maharashtra","Bid"):"Beed", ("Maharashtra","Vada"):"Wada",
 ("Maharashtra","Mangalvedhe"):"Mangalwedha", ("Maharashtra","Navapur"):"Nawapur",
 ("Madhya Pradesh","Murwara"):"Katni", ("Madhya Pradesh","Babai"):"Makhan Nagar",
 ("Uttarakhand","Hardwar"):"Haridwar",
 ("Andaman and Nicobar Islands","Carnicobar"):"Car Nicobar",
 ("Andaman and Nicobar Islands","Campbelbay"):"Campbell Bay",
 # one city recorded twice under its old and new name
 ("Karnataka","Chikkamagaluru"):"Chikmagalur",
}

# (state, district-or-None, city) -> aliases to add
ADD_ALIAS = {
 ("Karnataka",None,"Robertson Pet"):["KGF","Kolar Gold Fields"],
 ("Karnataka",None,"Hubballi"):["Hubli","Hubli-Dharwad"],
 ("Karnataka",None,"Doddaballapur"):["Doddaballapura","Dodballapura","Dod Ballapur"],
 ("Meghalaya",None,"Cherrapunjee"):["Sohra","Cherrapunji"],
 ("Madhya Pradesh",None,"Katni"):["Murwara"],
 ("Maharashtra",None,"Beed"):["Bid","Bhir"],
 ("Maharashtra",None,"Wada"):["Vada"],
 ("Maharashtra",None,"Vasai-Virar City"):["Nalasopara","Nala Sopara","Vasai","Virar"],
 ("Maharashtra",None,"Mira-Bhayandar"):["Mira Road","Bhayander"],
 ("Andhra Pradesh",None,"Nadim Tiruvuru"):["Tiruvuru"],
 ("Andhra Pradesh",None,"Sulluru"):["Sullurpeta","Sullurupeta"],
 ("Andhra Pradesh",None,"Kanigiri U"):["Kanigiri"],
 # Karnataka's own sources disagree with each other (Hosapete/Hospet,
 # Chikkamagaluru/Chikmagalur), so both forms are kept as aliases rather
 # than picking a canonical that half the state does not use.
 ("Karnataka",None,"Hospet"):["Hosapete"],
 ("Karnataka",None,"Chikmagalur"):["Chikkamagaluru"],
 ("Karnataka",None,"Hole Narsipur"):["Holenarasipura","Holenarsipur"],
 ("Karnataka",None,"Piriyapatna"):["Periyapatna"],
 ("Karnataka",None,"Ranebennur"):["Ranibennur"],
 ("Karnataka",None,"Sindhanur"):["Sindhnur"],
 ("Karnataka",None,"Mudbidri"):["Moodbidri","Moodabidri"],
 ("Karnataka",None,"Karatgi"):["Karatagi"],
 ("Karnataka",None,"Kanakagiri"):["Kanakgiri"],
 ("Karnataka",None,"Chikmagalur"):["Chikkamagaluru"],
 ("West Bengal",None,"Koch Bihar"):["Cooch Behar","Coochbehar"],
 ("West Bengal",None,"Darjiling"):["Darjeeling"],
 ("Uttarakhand",None,"Haridwar"):["Hardwar"],
 ("Lakshadweep",None,"Bithra"):["Bitra"],
 # The Census keys this census town as "Haringhata Farm"; everyone says
 # "Haringhata". The municipality of that name is a SEPARATE body and the two
 # records must not be merged - 3,989 people against 45,953.
 ("West Bengal",None,"Haringhata Farm"):["Haringhata"],
 # howrah.gov.in returns nothing for "Dhulagarh" and one hit for "Dhulagari",
 # so the Census spelling stays canonical and the common one is the alias.
 ("West Bengal",None,"Dhulagari"):["Dhulagarh"],
 # deoria.nic.in lists the ULB as "Gaura Barhaj", so the canonical stays and
 # the short form everyone uses becomes the alias. The separate "Barahaj" in
 # Kushinagar is a different village and is deliberately NOT merged.
 ("Uttar Pradesh",None,"Gaura Barhaj"):["Barhaj"],
}

# (state, district-or-None, city) -> aliases to remove (a different real place)
UNALIAS = {
 ("Maharashtra",None,"Wada"):["Vedhe"],
}

# (state, city) -> tier. Each named by an auditor with a government source.
TIER = {
 ("Karnataka","Dharwad"):"municipality",
 ("Karnataka","Hubballi"):"corporation",
 ("Maharashtra","Pimpri"):"corporation", ("Maharashtra","Chinchwad"):"corporation",
 ("Maharashtra","Sangli"):"corporation", ("Maharashtra","Miraj"):"municipality",
 ("Maharashtra","Kupwad"):"municipality",
 ("Telangana","Vikarabad"):"municipality",
 ("Uttar Pradesh","Noida"):"corporation", ("Uttar Pradesh","Greater Noida"):"municipality",
 ("Telangana","Hyderabad"):"corporation",
}

# a district whose rename has now been gazetted, so canonical flips
DISTRICT_RENAME = {
 # Revenue Dept notification 23-05-2025 under s.4(4A) KLR Act; the district's
 # own portal migrated to bengalurusouth.nic.in and self-names Bengaluru South.
 # Bengaluru Rural -> Bengaluru North has NOT been gazetted and is left alone.
 ("Karnataka","Ramanagara"):"Bengaluru South",
}
