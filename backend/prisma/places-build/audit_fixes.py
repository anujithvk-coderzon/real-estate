"""Corrections from the regional audits.

Every entry traces to a specific finding by a verification agent, re-checked
against the reason given. They fall into four kinds.

RELOCATE - the town is filed under the district it was carved OUT of. This is
    the largest fault found and it is NOT the "empty new district" limitation:
    the new district exists and is populated with localities, while the town
    itself stayed with the parent. Gujarat's 2013 reorganisation, Maharashtra's
    2014 Palghar split, Punjab's and UP's 2011 splits and West Bengal's 2017
    Bardhaman split were all missed.

RESPELL - India Post's transliteration was kept as canonical and the name
    people actually write was demoted to an alias, or lost. Ahmedabad was
    stored as "Ahmadabad", Morbi as "Morvi", Dharamshala as "Dharmsala".

UNALIAS - an alias that names a DIFFERENT real place. The worst was Faizabad
    attached to an "Ayodhya" locality in Prayagraj, 150km from Ayodhya.

ADD_ALIAS - a well-known name that was missing entirely.
"""

# (state, city-as-stored) -> correct district
RELOCATE = {
 # Gujarat, 2013 reorganisation
 ("Gujarat","Morvi"):"Morbi", ("Gujarat","Maliya"):"Morbi",
 ("Gujarat","Wankaner"):"Morbi", ("Gujarat","Halvad"):"Morbi",
 ("Gujarat","Veraval"):"Gir Somnath", ("Gujarat","Una"):"Gir Somnath",
 ("Gujarat","Kodinar"):"Gir Somnath", ("Gujarat","Talala"):"Gir Somnath",
 ("Gujarat","Sutrapada"):"Gir Somnath",
 ("Gujarat","Modasa"):"Aravalli", ("Gujarat","Bhiloda"):"Aravalli",
 ("Gujarat","Bayad"):"Aravalli", ("Gujarat","Malpur"):"Aravalli",
 ("Gujarat","Meghraj"):"Aravalli",
 ("Gujarat","Lunawada"):"Mahisagar", ("Gujarat","Santrampur"):"Mahisagar",
 ("Gujarat","Balasinor"):"Mahisagar",
 ("Gujarat","Chhota Udaipur"):"Chhota Udaipur", ("Gujarat","Bodeli"):"Chhota Udaipur",
 ("Gujarat","Kavant"):"Chhota Udaipur", ("Gujarat","Nasvadi"):"Chhota Udaipur",
 ("Gujarat","Khambhalia"):"Devbhumi Dwarka", ("Gujarat","Dwarka"):"Devbhumi Dwarka",
 ("Gujarat","Okha"):"Devbhumi Dwarka", ("Gujarat","Bhanvad"):"Devbhumi Dwarka",
 ("Gujarat","Salaya"):"Devbhumi Dwarka", ("Gujarat","Kalyanpur"):"Devbhumi Dwarka",
 ("Gujarat","Botad"):"Botad", ("Gujarat","Gadhada"):"Botad",
 ("Gujarat","Barwala"):"Botad", ("Gujarat","Ranpur"):"Botad",
 # Maharashtra, Palghar split 2014
 ("Maharashtra","Palghar"):"Palghar", ("Maharashtra","Vasai-Virar City"):"Palghar",
 ("Maharashtra","Dahanu"):"Palghar", ("Maharashtra","Jawhar"):"Palghar",
 ("Maharashtra","Boisar"):"Palghar", ("Maharashtra","Vikramgad"):"Palghar",
 # Punjab, 2011 splits
 ("Punjab","Pathankot"):"Pathankot", ("Punjab","Sujanpur"):"Pathankot",
 ("Punjab","Fazilka"):"Fazilka", ("Punjab","Abohar"):"Fazilka",
 ("Punjab","Jalalabad"):"Fazilka",
 ("Punjab","Banga"):"Shaheed Bhagat Singh Nagar",
 ("Punjab","Balachaur"):"Shaheed Bhagat Singh Nagar",
 # Uttar Pradesh, 2011 splits
 ("Uttar Pradesh","Hapur"):"Hapur", ("Uttar Pradesh","Pilkhuwa"):"Hapur",
 ("Uttar Pradesh","Sambhal"):"Sambhal", ("Uttar Pradesh","Chandausi"):"Sambhal",
 ("Uttar Pradesh","Bahjoi"):"Sambhal",
 ("Uttar Pradesh","Shamli"):"Shamli", ("Uttar Pradesh","Kairana"):"Shamli",
 # West Bengal, Bardhaman split 2017
 ("West Bengal","Asansol"):"Paschim Bardhaman",
 ("West Bengal","Durgapur"):"Paschim Bardhaman",
 ("West Bengal","Raniganj"):"Paschim Bardhaman",
 ("West Bengal","Jamuria"):"Paschim Bardhaman",
 ("West Bengal","Kulti"):"Paschim Bardhaman",
 ("West Bengal","Andal"):"Paschim Bardhaman",
 ("West Bengal","Ukhra"):"Paschim Bardhaman",
 ("West Bengal","Hindusthan Cables Town"):"Paschim Bardhaman",
 ("West Bengal","Alipurduar"):"Alipurduar",
 ("West Bengal","Jhargram"):"Jhargram",
 ("West Bengal","Kalimpong"):"Kalimpong",
}

# (state, city-as-stored) -> the spelling people write
RESPELL = {
 ("Gujarat","Ahmadabad"):"Ahmedabad", ("Gujarat","Mahesana"):"Mehsana",
 ("Gujarat","Morvi"):"Morbi", ("Gujarat","Anklesvar"):"Ankleshwar",
 ("Gujarat","Himatnagar"):"Himmatnagar", ("Gujarat","Sidhpur"):"Siddhpur",
 ("Gujarat","Devgadbaria"):"Devgadh Baria",
 ("Maharashtra","Ahmadnagar"):"Ahilyanagar", ("Maharashtra","Gondiya"):"Gondia",
 ("Maharashtra","Talode"):"Taloda", ("Maharashtra","Ambejogai"):"Ambajogai",
 ("Maharashtra","Malwan"):"Malvan", ("Maharashtra","Shahade"):"Shahada",
 ("Maharashtra","Sironcha Ry."):"Sironcha",
 ("Rajasthan","Dhaulpur"):"Dholpur",
 ("Himachal Pradesh","Dharmsala"):"Dharamshala",
 ("Himachal Pradesh","Jogindarnagar"):"Joginder Nagar",
 ("Himachal Pradesh","Rawalsar"):"Rewalsar",
 ("Himachal Pradesh","Sundarnagar"):"Sundernagar",
 ("Punjab","Muktsar"):"Sri Muktsar Sahib", ("Punjab","Gidderbaha"):"Giddarbaha",
 ("Uttar Pradesh","Mughalsarai"):"Pandit Deen Dayal Upadhyaya Nagar",
 ("Haryana","Mohindergarh"):"Mahendragarh",
 ("Bihar","Dinapur Nizamat"):"Danapur", ("Bihar","Fatwah"):"Fatuha",
 ("Bihar","Purnia"):"Purnia", ("Bihar","Mokameh"):"Mokama",
 ("Odisha","Jeypur"):"Jeypore", ("Odisha","Brajarajnagar"):"Brajrajnagar",
 ("Odisha","Phulabani"):"Phulbani", ("Odisha","Nilagiri"):"Nilgiri",
 ("Odisha","Athagad"):"Athagarh", ("Odisha","Titlagarh"):"Titilagarh",
 ("Jharkhand","Hazaribag"):"Hazaribagh", ("Jharkhand","Kodarma"):"Koderma",
 ("Jharkhand","Jhumri Tilaiya"):"Jhumri Telaiya",
 ("Assam","Mangaldoi"):"Mangaldai",
 ("West Bengal","Barddhaman"):"Bardhaman",
}

# (state, city) -> aliases to REMOVE because they name a different place
# Keys are (state, district, city). district=None means "wherever it occurs".
# Ayodhya needs the district: a locality of that name sits in Prayagraj, 150km
# from the real one, and an un-scoped rule stripped the alias from one and then
# handed it back to both.
UNALIAS = {
 ("Uttar Pradesh","Prayagraj","Ayodhya"):["Faizabad","Fyzabad"],
 ("West Bengal",None,"Murshidabad"):["Baharampur","Berhampore"],
 ("Jharkhand",None,"Ghorabandha"):["Gurabanda"],
 ("Goa",None,"Goa Velha"):["Old Goa"],
 ("Maharashtra",None,"Valha"):["Velhe"],
 ("Uttar Pradesh",None,"Hathras"):["Mahamaya Nagar"],    # district name, never the city
 ("Maharashtra",None,"Sangli"):["Turmeric city"],        # a nickname, not a name
 ("West Bengal",None,"New Town Action Area I"):["New Town Action Area II",
                                                     "New Town Action Area III"],
}

# (state, district, city) -> aliases to ADD. district=None means "wherever".
ADD_ALIAS = {
 ("Goa",None,"Panaji"):["Panjim"], ("Goa",None,"Margao"):["Madgaon","Madgao"],
 ("Gujarat",None,"Ahmedabad"):["Amdavad"],
 ("Rajasthan",None,"Kota"):["Kotah"],
 ("Odisha",None,"Brahmapur"):["Berhampur","Berhampore Odisha"],
 ("Odisha",None,"Raurkela"):["Rourkela"],
 ("Odisha",None,"Baleshwar"):["Balasore"], ("Odisha",None,"Debagarh"):["Deogarh"],
 ("Odisha",None,"Baudhgarh"):["Boudh"], ("Odisha",None,"Sonapur"):["Sonepur"],
 ("Jharkhand",None,"Jamshedpur"):["Tatanagar"],
 ("West Bengal",None,"Contai"):["Kanthi"],
 ("West Bengal",None,"Bardhaman"):["Burdwan","Barddhaman"],
 ("Bihar",None,"Arrah"):["Ara","Arah"], ("Bihar",None,"Chapra"):["Chhapra"],
 ("Punjab",None,"Sahibzada Ajit Singh Nagar"):["Mohali","SAS Nagar"],
 ("Punjab",None,"Rupnagar"):["Ropar"],
 ("Himachal Pradesh",None,"Dharamshala"):["Dharamsala","McLeod Ganj"],
 ("Uttar Pradesh","Ayodhya","Ayodhya"):["Fyzabad","Faizabad"],   # the real Ayodhya
 ("Uttar Pradesh",None,"Chitrakoot Dham"):["Chitrakoot","Karwi"],
 ("Uttar Pradesh",None,"Noida"):["Gautam Buddha Nagar"],
 ("Maharashtra",None,"Ahilyanagar"):["Ahmednagar","Ahmadnagar"],
 ("Maharashtra",None,"Kalyan-Dombivli"):["Dombivli","Dombivali","Kalyan"],
 ("Tamil Nadu",None,"Thoothukudi"):["Tuticorin"],
}
