"""Round-two corrections, from nine per-state auditors.

The dominant fault they found is one shape: a district created after India
Post's data was compiled exists in the dataset and holds localities, but its
HEADQUARTERS TOWN is still filed under the district it was carved out of. It
showed up independently in Mizoram, Nagaland, Telangana, Tamil Nadu, Sikkim,
Delhi, Jammu and Kashmir and Punjab, so it is systematic rather than regional.

Second fault: Odisha's towns took the June 2026 gazette spelling as canonical
with NO conventional alias - the exact inverse of the district policy - so
Rourkela, Odisha's second city, is unreachable by the name everyone uses.
"""

# (state, city) -> district it belongs to
RELOCATE = {
 # Mizoram 2019 splits
 ("Mizoram","Hnahthial"):"Hnahthial", ("Mizoram","Khawzawl"):"Khawzawl",
 ("Mizoram","Saitual"):"Saitual", ("Mizoram","Chawngte"):"Lawngtlai",
 ("Mizoram","Tuichawng"):"Lawngtlai", ("Mizoram","Borapansury"):"Lawngtlai",
 # Nagaland 2021-2024 splits
 ("Nagaland","Chumukedima"):"Chumoukedima", ("Nagaland","Medziphema"):"Chumoukedima",
 ("Nagaland","Diphupar"):"Chumoukedima", ("Nagaland","Tseminyu"):"Tseminyu",
 ("Nagaland","Meluri"):"Meluri", ("Nagaland","Shamator"):"Shamator",
 ("Nagaland","Niuland"):"Niuland", ("Nagaland","Noklak"):"Noklak",
 # Punjab
 ("Punjab","Malerkotla"):"Malerkotla", ("Punjab","Maler Kotla"):"Malerkotla",
 ("Punjab","Kiratpur Sahib"):"Rupnagar",
 # Telangana: India Post's "Hyderabad" division is not Hyderabad district
 ("Telangana","Vikarabad"):"Vikarabad", ("Telangana","Tandur"):"Vikarabad",
 ("Telangana","Shamirpet"):"Medchal-Malkajgiri", ("Telangana","Keesara"):"Medchal-Malkajgiri",
 ("Telangana","Bahadurpalli"):"Medchal-Malkajgiri", ("Telangana","Ghatkesar"):"Medchal-Malkajgiri",
 ("Telangana","Cherial"):"Siddipet", ("Telangana","Moinabad"):"Rangareddy",
 ("Telangana","Mancherial"):"Mancherial", ("Telangana","Gadwal"):"Jogulamba Gadwal",
 ("Telangana","Bhongir"):"Yadadri Bhuvanagiri", ("Telangana","Bhuvanagiri"):"Yadadri Bhuvanagiri",
 ("Telangana","Ramagundam"):"Peddapalli", ("Telangana","Korutla"):"Jagtial",
 ("Telangana","Koratla"):"Jagtial",
 # Tamil Nadu: Chennai's 2018 expansion and the 2019 splits
 ("Tamil Nadu","Ambattur"):"Chennai", ("Tamil Nadu","Alandur"):"Chennai",
 ("Tamil Nadu","Sholinganallur"):"Chennai", ("Tamil Nadu","Tiruvottiyur"):"Chennai",
 ("Tamil Nadu","Madhavaram"):"Chennai",
 ("Tamil Nadu","Mamallapuram"):"Chengalpattu", ("Tamil Nadu","Maduranthakam"):"Chengalpattu",
 ("Tamil Nadu","Thakkolam"):"Ranipet", ("Tamil Nadu","Vilapakkam"):"Ranipet",
 # Sikkim's 2021 reorganisation
 ("Sikkim","Pelling"):"Gyalshing", ("Sikkim","Yuksom"):"Gyalshing",
 ("Sikkim","Ravangla"):"Namchi", ("Sikkim","Namchi"):"Namchi",
 ("Sikkim","Chungthang"):"Mangan", ("Sikkim","Mangan"):"Mangan",
 ("Sikkim","Pakyong"):"Pakyong", ("Sikkim","Soreng"):"Soreng",
 # Delhi: South East Delhi has existed since 2012
 ("Delhi","Jungpura"):"South East Delhi", ("Delhi","Kalkaji"):"South East Delhi",
 ("Delhi","Badarpur"):"South East Delhi", ("Delhi","Nehru Place"):"South East Delhi",
 ("Delhi","Sarita Vihar"):"South East Delhi", ("Delhi","Greater Kailash"):"South East Delhi",
 ("Delhi","Hazrat Nizamuddin"):"South East Delhi", ("Delhi","Okhla"):"South East Delhi",
 ("Delhi","Lajpat Nagar"):"South East Delhi",
 # Jammu and Kashmir: the dataset was on the pre-2007 Doda split
 ("Jammu and Kashmir","Chhatroo"):"Kishtwar", ("Jammu and Kashmir","Dachhan"):"Kishtwar",
 ("Jammu and Kashmir","Padar"):"Kishtwar", ("Jammu and Kashmir","Mugal Maidan"):"Kishtwar",
 ("Jammu and Kashmir","Inderwal"):"Kishtwar", ("Jammu and Kashmir","Gulabgarh"):"Kishtwar",
 ("Jammu and Kashmir","Dul Hasti"):"Kishtwar",
 # the UT enclave that was double-filed
 ("Dadra and Nagar Haveli and Daman and Diu","Kachigam"):"Daman",

 # Chhattisgarh's 2012 reorganisation was never applied to the town layer.
 # Nine district HQs were sitting under their pre-2012 parent.
 ("Chhattisgarh","Balod"):"Balod", ("Chhattisgarh","Dalli-Rajhara"):"Balod",
 ("Chhattisgarh","Dondi"):"Balod", ("Chhattisgarh","Dondi Lohara"):"Balod",
 ("Chhattisgarh","Gunderdehi"):"Balod", ("Chhattisgarh","Gurur"):"Balod",
 ("Chhattisgarh","Arjunda"):"Balod",
 ("Chhattisgarh","Bemetara"):"Bemetara", ("Chhattisgarh","Berla"):"Bemetara",
 ("Chhattisgarh","Saja"):"Bemetara", ("Chhattisgarh","Than-Khamharia"):"Bemetara",
 ("Chhattisgarh","Baloda Bazar"):"Baloda Bazar-Bhatapara",
 ("Chhattisgarh","Bhatapara"):"Baloda Bazar-Bhatapara",
 ("Chhattisgarh","Simga"):"Baloda Bazar-Bhatapara",
 ("Chhattisgarh","Kasdol"):"Baloda Bazar-Bhatapara",
 ("Chhattisgarh","Gariyaband"):"Gariaband", ("Chhattisgarh","Gariaband"):"Gariaband",
 ("Chhattisgarh","Rajim"):"Gariaband", ("Chhattisgarh","Chhura"):"Gariaband",
 ("Chhattisgarh","Fingeshwar"):"Gariaband",
 ("Chhattisgarh","Mungeli"):"Mungeli", ("Chhattisgarh","Lormi"):"Mungeli",
 ("Chhattisgarh","Pathariya"):"Mungeli",
 ("Chhattisgarh","Surajpur"):"Surajpur",
 ("Chhattisgarh","Balrampur"):"Balrampur-Ramanujganj",
 ("Chhattisgarh","Ramanujganj"):"Balrampur-Ramanujganj",
 ("Chhattisgarh","Kusmi"):"Balrampur-Ramanujganj",
 ("Chhattisgarh","Rajpur"):"Balrampur-Ramanujganj",
 ("Chhattisgarh","Wadrafnagar"):"Balrampur-Ramanujganj",
 ("Chhattisgarh","Kondagaon"):"Kondagaon", ("Chhattisgarh","Keskal"):"Kondagaon",
 ("Chhattisgarh","Farasgaon"):"Kondagaon",
 ("Chhattisgarh","Sukma"):"Sukma", ("Chhattisgarh","Konta"):"Sukma",

 # Goa: Ponda taluka moved to South Goa in Jan 2015; Kushavati's four
 # municipal councils were still in South Goa
 ("Goa","Ponda"):"South Goa", ("Goa","Bandora"):"South Goa",
 ("Goa","Borim"):"South Goa", ("Goa","Candola"):"South Goa",
 ("Goa","Curti"):"South Goa", ("Goa","Marcaim"):"South Goa",
 ("Goa","Orgao"):"South Goa", ("Goa","Priol"):"South Goa",
 ("Goa","Quela"):"South Goa", ("Goa","Usgao"):"South Goa",
 ("Goa","Quepem"):"Kushavati", ("Goa","Sanguem"):"Kushavati",
 ("Goa","Canacona"):"Kushavati", ("Goa","Curchorem-Cacora"):"Kushavati",
 ("Goa","Curchorem"):"Kushavati",

 # Gujarat: the 2013 misses the first pass left behind
 ("Gujarat","Virpur"):"Mahisagar", ("Gujarat","Sankheda"):"Chhota Udaipur",
 ("Gujarat","Mithapur"):"Devbhumi Dwarka",

 # Haryana
 ("Haryana","Kosli"):"Rewari", ("Haryana","Shahzadpur"):"Ambala",
}

# (state, city-as-stored) -> the spelling people write
RESPELL = {
 ("Andhra Pradesh","Tadpatri"):"Tadipatri", ("Andhra Pradesh","Palacole"):"Palakollu",
 ("Andhra Pradesh","Jaggaiahpet"):"Jaggayyapeta", ("Andhra Pradesh","Markapur"):"Markapuram",
 ("Andhra Pradesh","Samalkot"):"Samalkota", ("Andhra Pradesh","Rayadurg"):"Rayadurgam",
 ("Andhra Pradesh","Avanashi"):"Avinashi",
 ("Bihar","Colgong"):"Kahalgaon", ("Bihar","Behea"):"Bihiya",
 ("Assam","Marigaon"):"Morigaon", ("Assam","Kharupatia"):"Kharupetia",
 ("Tamil Nadu","Velacheri"):"Velachery", ("Tamil Nadu","Thygarayanagar"):"T. Nagar",
 ("Karnataka","Hospet"):"Hosapete", # REVERTED: the auditor retracted this. yadgir.nic.in writes
 # "Shorapura" and "Surapura" appears in no government source, so the
 # original spelling stands.
 # ("Karnataka","Shorapur"):"Surapura",
 ("Andhra Pradesh","Rajahmundry"):"Rajamahendravaram",
 ("Jammu and Kashmir","Baramula"):"Baramulla", ("Jammu and Kashmir","Shupiyan"):"Shopian",
 ("Jammu and Kashmir","Bashohli"):"Basohli",
 # "Manendragarh" is a real town in CHHATTISGARH; Haryana's is Mahendragarh.
 # Storing one under the other's name makes the Haryana town unfindable and
 # invites a cross-state mix-up.
 ("Haryana","Manendragarh"):"Mahendragarh",
 ("Gujarat","Dohad"):"Dahod",
}

# (state, district-or-None, city) -> aliases to add
ADD_ALIAS = {
 # Odisha: gazette spelling is canonical, the everyday name was missing
 ("Odisha",None,"Raurkela"):["Rourkela"],
 ("Odisha",None,"Jagatsinghapur"):["Jagatsinghpur"],
 ("Odisha",None,"Baleshwar"):["Balasore"],
 ("Odisha",None,"Kendujhar"):["Keonjhar"],
 ("Odisha",None,"Rajagangapur"):["Rajgangpur"],
 ("Odisha",None,"Bishamakatak"):["Bissam Cuttack"],
 ("Odisha",None,"Ranapurgada"):["Ranpur"],
 ("Odisha",None,"Brahmapur"):["Berhampur"],
 ("Odisha",None,"Anandpur"):["Anandapur"],
 # the UTs
 ("Puducherry",None,"Mahé"):["Mahe","Mayyazhi"],
 ("Lakshadweep",None,"Bithra"):["Bitra"],
 ("Andaman and Nicobar Islands",None,"Carnicobar"):["Car Nicobar"],
 ("Andaman and Nicobar Islands",None,"Campbelbay"):["Campbell Bay"],
 ("Puducherry",None,"Olugarai"):["Ozhukarai","Oulgaret","Uzhavarkarai"],
 # a district HQ people type instead of the district
 ("Punjab",None,"S.A.S. Nagar"):["Mohali","Sahibzada Ajit Singh Nagar"],
 ("Andhra Pradesh",None,"Ananthapuramu"):["Anantapur","Anantapuram"],
 ("Ladakh",None,"Khalsi"):["Khaltse","Khalatse"],
 ("Ladakh",None,"Nyoma Mud"):["Nyoma"],
 ("Gujarat",None,"Dahod"):["Dohad"],
 ("Gujarat",None,"Veraval"):["Somnath","Prabhas Patan"],
 ("Haryana",None,"Mahendragarh"):["Mohindergarh","Narnaul"],
 # the auditor found the town only under the India Post spelling
 ("Telangana",None,"Koratla"):["Korutla"],
}

# district-level aliases the auditors found missing: the HQ town is the only
# name most people know for a recently created district
DISTRICT_ALIAS = {
 "Arunachal Pradesh":{"East Siang":["Pasighat"],"West Kameng":["Bomdila"],
   "Lower Subansiri":["Ziro"],"Lohit":["Tezu"],"West Siang":["Aalo","Along"],
   "Leparada":["Basar","Lepa Rada"],"Lower Siang":["Likabali"],
   "East Kameng":["Seppa"],"Tirap":["Khonsa"],"Dibang Valley":["Anini"],
   "Lower Dibang Valley":["Roing"],"Upper Subansiri":["Daporijo"],
   "Changlang":["Changlang"],"Namsai":["Namsai"],"Siang":["Pangin","Boleng"],
   "Kra Daadi":["Jamin","Palin"],"Kamle":["Raga"],"Pakke-Kessang":["Lemmi"],
   "Bichom":["Napangphung"],"Keyi Panyor":["Yachuli"],"Shi-Yomi":["Tato"],
   "Anjaw":["Hawai"],"Longding":["Longding"],"Upper Siang":["Yingkiong"],
   "Kurung Kumey":["Koloriang"],"Papum Pare":["Yupia"],"Tawang":["Tawang"]},
 "Andhra Pradesh":{"Annamayya":["Madanapalle","Rayachoti"],
   "Polavaram":["Rampachodavaram"],"East Godavari":["Rajahmundry","Rajamahendravaram"],
   "Alluri Sitharama Raju":["Paderu"],"Dr. B.R. Ambedkar Konaseema":["Amalapuram"],
   "Krishna":["Machilipatnam","Bandar"],"Sri Sathya Sai":["Puttaparthi","Hindupur"],
   "Bapatla":["Bapatla"],"Palnadu":["Narasaraopet"],"Nandyal":["Nandyal"],
   "Anakapalli":["Anakapalle"],"Eluru":["Ellore"],"NTR":["Vijayawada"],
   "Parvathipuram Manyam":["Parvathipuram"],"Tirupati":["Tirupathi"]},
 "Punjab":{"Malerkotla":["Maler Kotla","Malerkotla"],"Fatehgarh Sahib":["Sirhind"]},
 "Tamil Nadu":{"Tiruvannamalai":["North Arcot"],"Tenkasi":["Thenkasi"],
   "Ramanathapuram":["Pasumpon Muthuramalinga Thevar"]},
 "Bihar":{"Buxar":["Shahabad"],"Rohtas":["Shahabad"],"Kaimur":["Shahabad"]},
}
