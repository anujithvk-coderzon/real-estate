"""Source labels the resolver cannot reach on its own.

Three kinds, kept apart because they mean different things:

WITHIN  - a typo, a state suffix, or a headquarters town standing in for its
          district. Same state, wrong label.
MOVE    - the row is filed under the wrong STATE. India Post still files Leh
          and Kargil under Jammu and Kashmir (they are Ladakh since 2019) and
          Karaikal under Tamil Nadu (it is Puducherry). Moving the state is
          the only correct fix; leaving them would put a Ladakh town in J&K.
DROP    - not a place. "Na" is a null, and a handful of labels appear exactly
          once in a state they have nothing to do with ("Jhajjar" shows up as
          a single row in twenty different states) - data-entry residue, not
          geography.
"""

WITHIN = {
 # typos and state suffixes
 ("Rajasthan","jhujhunu"):"Jhunjhunu",
 ("Rajasthan","pratapghar"):"Pratapgarh",
 ("Karnataka","bijapurkar"):"Vijayapura",
 ("Chhattisgarh","bijapurcgh"):"Bijapur",
 ("Chhattisgarh","bilaspurcgh"):"Bilaspur",
 ("Chhattisgarh","balodbazer"):"Baloda Bazar-Bhatapara",
 ("Himachal Pradesh","hamirpurhp"):"Hamirpur",
 ("Himachal Pradesh","bilaspurhp"):"Bilaspur",
 ("Maharashtra","raigarh"):"Raigad",
 ("Maharashtra","raigarhmh"):"Raigad",
 ("Maharashtra","mumbaisubueban"):"Mumbai Suburban",
 ("Maharashtra","jalgoan"):"Jalgaon",
 ("Jammu and Kashmir","bandipur"):"Bandipora",
 ("Gujarat","botab"):"Botad",
 ("Gujarat","ahmedabadcity"):"Ahmedabad",
 ("Haryana","ambalacity"):"Ambala",
 ("Assam","dimahassonorthcacharhill"):"Dima Hasao",
 ("Uttar Pradesh","prayagrajallahabad"):"Prayagraj",
 ("Tripura","agartala"):"West Tripura",
 ("West Bengal","medinipur"):"Paschim Medinipur",
 ("Chandigarh","chandighar"):"Chandigarh",
 ("Telangana","kvrangareddy"):"Rangareddy",
 ("Uttar Pradesh","raigarhmh"):"",          # wrong state AND ambiguous - drop
 # a headquarters town standing in for its district
 ("Maharashtra","malegaon"):"Nashik",
 ("Maharashtra","bhusawal"):"Jalgaon",
 ("Maharashtra","miraj"):"Sangli",
 ("Maharashtra","shrirampur"):"Ahilyanagar",
 ("Telangana","parkal"):"Hanumakonda",
 ("Telangana","kothagudemcolls"):"Bhadradri Kothagudem",
 ("Telangana","secunderabad"):"Hyderabad",
 ("Telangana","trimulgherry"):"Hyderabad",
 ("Telangana","stnjadcherla"):"Mahabubnagar",
 ("Telangana","zaheerabad"):"Sangareddy",
 ("Andhra Pradesh","madanapalle"):"Annamayya",
 ("Andhra Pradesh","machilipatnam"):"Krishna",
 ("Andhra Pradesh","kovvur"):"West Godavari",
 ("Andhra Pradesh","tadepalligudem"):"West Godavari",
 ("Andhra Pradesh","palakol"):"West Godavari",
 ("Andhra Pradesh","amlapuram"):"Dr. B.R. Ambedkar Konaseema",
 ("Andhra Pradesh","avanigadda"):"Krishna",
 ("Andhra Pradesh","hindupur"):"Sri Sathya Sai",
 ("Andhra Pradesh","dharmavaram"):"Sri Sathya Sai",
 ("Andhra Pradesh","srikalahasti"):"Tirupati",
 ("Karnataka","kollegal"):"Chamarajanagar",
 ("Karnataka","siddapur"):"Uttara Kannada",
 ("Karnataka","joida"):"Uttara Kannada",
 ("Karnataka","arsikere"):"Hassan",
 ("Karnataka","hunsur"):"Mysuru",
 ("Karnataka","nanjangud"):"Mysuru",
 ("Karnataka","hanagodu"):"Mysuru",
 ("Karnataka","saraswathipuram"):"Mysuru",
 ("Karnataka","madikeri"):"Kodagu",
 ("Karnataka","athani"):"Belagavi",
 ("Karnataka","bailhongal"):"Belagavi",
 ("Karnataka","ramdurg"):"Belagavi",
 ("Karnataka","jamkhandi"):"Bagalkot",
 ("Karnataka","kundgol"):"Dharwad",
 ("Karnataka","kalghatgi"):"Dharwad",
 ("Karnataka","hubballi"):"Dharwad",
 ("Karnataka","sagar"):"Shivamogga",
 ("Chhattisgarh","makdi"):"Kondagaon",
 ("Tripura","dharmanagar"):"North Tripura",
 ("Manipur","imphal"):"Imphal West",
 ("Manipur","thanlon"):"Pherzawl",
 ("Meghalaya","tura"):"West Garo Hills",
 ("Assam","sonapur"):"Kamrup Metropolitan",
 ("Kerala","thalassery"):"Kannur",
 ("Chandigarh","mohali"):"",                 # Mohali is Punjab - moved below
}

MOVE = {
 ("Jammu and Kashmir","leh"):("Ladakh","Leh"),
 ("Jammu and Kashmir","kargil"):("Ladakh","Kargil"),
 ("Tamil Nadu","karaikal"):("Puducherry","Karaikal"),
 ("Tamil Nadu","pondicherry"):("Puducherry","Puducherry"),
 ("Puducherry","villupuram"):("Tamil Nadu","Viluppuram"),
 ("Kerala","mahe"):("Puducherry","Mahe"),
 ("Andhra Pradesh","yanam"):("Puducherry","Yanam"),
 ("Punjab","chandighar"):("Chandigarh","Chandigarh"),
 ("Chandigarh","mohali"):("Punjab","Sahibzada Ajit Singh Nagar"),
 # India Post files Bitra island's branch office under district "Kochi".
 # An earlier version of this rule sent it to Kerala/Ernakulam, which exiled
 # one of Lakshadweep's ten inhabited islands out of the territory. The row
 # belongs in Lakshadweep.
 ("Lakshadweep","kochi"):("Lakshadweep","Lakshadweep"),
 ("Uttar Pradesh","haridwar"):("Uttarakhand","Haridwar"),
 ("Uttarakhand","hazaribag"):("Jharkhand","Hazaribagh"),
 ("Jharkhand","shopian"):("Jammu and Kashmir","Shopian"),
 ("Sikkim","dimapur"):("Nagaland","Dimapur"),
 ("West Bengal","eastsikkim"):("Sikkim","Gangtok"),
 ("West Bengal","northsikkim"):("Sikkim","Mangan"),
 ("West Bengal","southsikkim"):("Sikkim","Namchi"),
 ("West Bengal","portblair"):("Andaman and Nicobar Islands","South Andaman"),
 ("Arunachal Pradesh","westgodavari"):("Andhra Pradesh","West Godavari"),
 ("Manipur","westtripura"):("Tripura","West Tripura"),
 ("Mizoram","westtripura"):("Tripura","West Tripura"),
 ("Telangana","vizianagaram"):("Andhra Pradesh","Vizianagaram"),
 ("Telangana","koderma"):("Jharkhand","Koderma"),
 ("Andhra Pradesh","bhadrachalam"):("Telangana","Bhadradri Kothagudem"),
 ("Andhra Pradesh","bhongir"):("Telangana","Yadadri Bhuvanagiri"),
 ("Andhra Pradesh","karimnagar"):("Telangana","Karimnagar"),
 ("Andhra Pradesh","mahabubnagar"):("Telangana","Mahabubnagar"),
 ("Andhra Pradesh","rangareddy"):("Telangana","Rangareddy"),
 ("Andhra Pradesh","warangal"):("Telangana","Warangal"),
 ("Kerala","kollegal"):("Karnataka","Chamarajanagar"),
}

# ONLY nulls are dropped globally. An earlier version of this list also held
# geographic names like "West Godavari", "Dimapur" and "Basti" to kill the
# single-row residue scattered across unrelated states - but those are real
# districts in their OWN states, and dropping them by name discarded about
# 4,800 legitimate rows. The scattered residue is instead simply left
# unresolved: being unplaced costs one post office, mis-dropping costs a
# district.
DROP_LABELS = {"na", "nil", "none", "unknown", "others", "other", "n a"}
