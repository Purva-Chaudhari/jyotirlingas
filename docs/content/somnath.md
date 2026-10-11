# Somnath (Prabhas Patan, Gujarat): research notes

Story data: `src/temples/stories/somnath.json`. Researched 2026-10-04.

## Stop map (visiting order)

| # | id | at (zone / anchor) | kind | Topic |
|---|----|--------------------|------|-------|
| 1 | somnath-dwar | dwar | history | Digvijay Dwar, Sardar Patel statue, 1947–1951 rebuilding |
| 2 | somnath-prabhas | sea (promenade, sea wall) | legend | Chandra, Daksha's curse, Prabhas (Shiva Purana) |
| 3 | somnath-baan | baan | history | Baan Stambh and its inscription, framed with caveats |
| 4 | somnath-rebuilt | temple (jagati, nritya and sabha mandapa) | history | Destructions and rebuildings, 1026 to 1951; architecture |
| 5 | somnath-garbhagriha | garbhagriha | ritual | Invocation (Dwadasha Jyotirlinga Stotram v.1), then the aarti |

Only five zones/anchors exist for Somnath in `anchors.ts` (dwar, temple, garbhagriha, baan, sea). Each stop uses its own zone so they trigger separately. The ritual content (three aartis, light-and-sound show) went into stop 4's "did you know", the final stop and the `aarti` block, not into a sixth stop. A second stop in the `temple` zone would be queued behind the first by `index.ts`. If you want a separate ritual stop, add an anchor such as `nritya` in `anchors.ts` and point a new stop at it.

## 1. Legends

### Chandra (Soma) and Daksha: Shiva Purana, Kotirudra Samhita, ch. 14
Source: https://www.wisdomlib.org/hinduism/book/shiva-purana-english/d/doc226515.html (J.L. Shastri translation)
- vv. 5–9: Daksha gives his 27 daughters to the Moon, who favours Rohini.
- vv. 10–19: Daksha warns him twice, then curses him with the wasting disease (consumption).
- vv. 20–34: The gods go to Brahma, who recounts the Moon's earlier misdeeds (abducting Tara) and prescribes going to **Prabhasa** and propitiating Shiva by the **Mrityunjaya** rite.
- vv. 35–41: For six months the Moon worships an earthen linga and repeats the Mrityunjaya mantra "a hundred million times".
- v. 45: The boon: "Let your digit decline day by day in one fortnight and increase steadily in another."
- vv. 46–54: Shiva stays as **Someshvara**; the "moon's pond" (Chandrakunda) is established.
- vv. 55–62: Phalashruti: bathing at Prabhasa cures consumption; seeing the Somalinga removes sins.

### Variants and related traditions
- **Skanda Purana, Prabhasa Khanda**: the whole first part of the Prabhasa Khanda is a mahatmya of this kshetra and expands on the Soma story. It is not directly quoted here.
- **Temple lore of four temples** (Gujarat Tourism): Soma built a temple of gold, Ravana one of silver, Krishna one of wood, and Bhimdev one of stone. https://gujarattourism.com/saurashtra/gir-somnath/somnath-temple.html. Some versions say sandalwood instead of wood; the PIB note mentions "Ravana – silver, Krishna – sandalwood" traditions. This is lore, so the narration labels it "temple tradition says".
- **Wikipedia** summarises the legend as Soma bathing in the Saraswati at this spot to regain his lustre. That differs slightly from the Shiva Purana, which has worship of an earthen linga with no bath. https://en.wikipedia.org/wiki/Somnath_temple
- **Triveni Sangam**: the confluence of the Hiran, Kapila and Saraswati with the sea (Wikipedia; Gujarat Tourism).
- **Prabhasa in the epics**: Prabhasa is where the Yadavas perished. Bhalka Tirth nearby is where tradition places Krishna's departure. Not used in narration because I had no strong source in hand; a candidate for a future stop.

## 2. Documented history (dates with sources)

| Date | Event | Source / note |
|------|-------|---------------|
| before 997 | Chaulukya king Mularaja reportedly builds or renovates a temple | Wikipedia (scholars differ) |
| Jan 1026 | Mahmud of Ghazni raids the temple, breaks the linga, takes great wealth | Wikipedia; PIB note says "January 1026" |
| 1038 | Inscription suggests the temple was repaired within about 12 years | Wikipedia |
| 1169 | Kumarapala rebuilds it in stone | Wikipedia (the PIB note says "12th century") |
| 1299 | Alauddin Khalji's army (Ulugh Khan) sacks it; later sources disagree on the idol's fate | Wikipedia |
| 1308; 1331–51 | Chudasama Mahipala I restores it; Khengara installs the linga | Wikipedia |
| 1395 | Zafar Khan destroys it | Wikipedia |
| 1451 | Mahmud Begada desecrates it | Wikipedia |
| 1706 | Aurangzeb orders its destruction | Wikipedia |
| c. 1783 (or 1785/86) | Ahilyabai Holkar builds the "Old Somnath" (Ahilyabai) temple next to the ruins | Wikipedia |
| 13 Nov 1947 | Sardar Patel, with N.V. Gadgil and Jam Saheb, visits the ruins; Patel announces rebuilding at a public meeting that evening | VIF, https://www.vifindia.org/article/2018/january/16/re-building-of-somanath-temple-a-tribute-to-sardar-patel-and-k-m-munshi ; DeshGujarat series |
| 1950 | Old ruins cleared and foundation laid; dates conflict (see below) | |
| 15 Dec 1950 | Sardar Patel dies | general record |
| 11 May 1951 | Pran-pratishtha by President Dr Rajendra Prasad | somnath.org; Wikipedia; PIB |
| 1995 | Kalash installed and temple dedicated, President Shankar Dayal Sharma | Wikipedia; PIB |
| Jan & May 2026 | "Somnath Swabhiman Parv": 1,000 years since 1026 and 75 years since 1951 | PIB note: https://static.pib.gov.in/WriteReadData/specificdocs/documents/2026/may/doc202658866001.pdf |

**Architecture** (PIB note): built in the "Kailash Mahameru Prasad" style; 150-foot shikhara; 10-tonne kalash; 27-foot dhwajdand. One automated summary of that PDF wrongly reported 155 ft and 37 ft; the PDF text itself says 150 and 27. Architect Prabhashankar Sompura; Maru-Gurjara (Chaulukya/Solanki) style (Wikipedia). The temple has a garbhagriha, a sabha mandapa and a nritya mandapa (PIB).

**Digvijay Dwar**: named after Jam Saheb Digvijaysinhji of Nawanagar (ruled 1933–1966), chairman of the Somnath Trust, who made the first donation of Rs 1 lakh. https://en.wikipedia.org/wiki/Digvijaysinhji_Ranjitsinhji_Jadeja

### Conflicts noted
- **Foundation and bhoomi-pujan date**: one source says the ruins were pulled down on 8 May 1950 and the foundation stone laid on 19 Oct 1950. Gujarat Tourism claims Patel "laid the foundation stone on 12 November 1947", which looks wrong: that was a visit and pledge, not a foundation. Not used in narration.
- **Ahilyabai temple**: c. 1783 vs 1785/86. The narration says "about 1783".
- **Veer Hamirji Gohil**: the PIB note says he died defending the temple "in 1299 A.D. during Zafar Khan's invasion", but Zafar Khan's attack is dated 1395 and 1299 was Alauddin Khalji's army. PIB itself says he is remembered "through local tradition rather than official historical records". Not used in narration.
- **Light-and-sound show time**: the trust FAQ says 20:00–21:00 (not in monsoon); Gujarat Tourism and others say 19:45; a Hindi travel site says 19:30–20:30. The JSON uses the trust's time.

## 3. Baan Stambh: handled with care
- Inscription (as widely reported): **"आसमुद्रान्त दक्षिण ध्रुव पर्यन्त अबाधित ज्योतिर्मार्ग"**, "an unobstructed path of light up to the South Pole".
- Its age is **not established**. Sources claim "6th century" or "at least the 7th century" without primary evidence: https://www.freepressjournal.in/travel/does-baan-stambh-in-gujarats-somnath-temple-point-towards-antarctica-heres-the-truth ; https://www.newkerala.com/news/a/somnath-swabhiman-parv-baanstambh-symbolises-indias-scientific-vision-251.htm . The pillar stands on the modern sea wall.
- **Geography check (my own reasoning, not from a source)**: Somnath is at about 70.40°E. Kerguelen's main island spans roughly 68.4°E to 70.6°E at about 49°S, and Port-aux-Français is at about 70.2°E. So a strict meridian due south from Somnath plausibly crosses Kerguelen before Antarctica. That is why the narration presents the inscription as "an old belief", not as a scientific fact.

## 4. Rituals and living culture
- Darshan 06:00–22:00; aartis at **07:00, 12:00 and 19:00** (trust FAQ: https://somnath.org/faq/).
- Electronics (mobile, camera, smartwatch and so on) are prohibited inside; "mini skirts and disrespectful dress" are not permitted (FAQ).
- Light and sound show **"Jai Somnath"**: started 2003, upgraded 2017 with 3D projection and Amitabh Bachchan's narration (PIB; DeshGujarat 2017).
- Bilva puja: more than 13.77 lakh devotees a year. Dhwaja puja and offerings: the complex has 1,666 gold-plated kalashes and 14,200 dhwajas (PIB).
- Festivals: Mahashivratri, Kartik Purnima fair (Gujarat Tourism).

## 5. Aarti
- **What is sung**: the trust does not publish the hymn sequence of its aarti. Descriptions mention drums, bells, conch and lamps. I could not confirm whether "Om Jai Shiv Omkara" or "Karpuragauram" is part of it, so **ask the trust**.
- **Lyrics used in the JSON** (public domain, labelled as not the documented temple text):
  - Dwadasha Jyotirlinga Stotram v.1, "सौराष्ट्रदेशे विशदेऽतिरम्ये…", traditionally attributed to Adi Shankaracharya. Typed from the traditional text; verify against https://sanskritdocuments.org/doc_shiva/dvAdashaJyotistotra.html (that site's transcription has reuse terms, but the 8th-century text itself is public domain).
  - "कर्पूरगौरं करुणावतारं…", the traditional shloka recited at the end of Shiva aartis.

### Audio licensing

| Candidate | License | Usable? |
|-----------|---------|---------|
| Somnath Trust live darshan/aarti (somnath.org/somnath-live-darshan, YouTube) | All rights reserved | **Needs permission** |
| Wikimedia Commons: no Somnath audio or video of aarti found (API search on "Somnath" + audio/video MIME returned 0 hits) | | none |
| archive.org: nothing from Somnath | | none |
| freesound: nothing recorded at Somnath | | none |

Generic CC0 ambience that could layer under the synthesized aarti. **None was recorded at Somnath, so do not present any of it as the temple's own aarti.** Licenses were checked on each sound's page on 2026-10-04:
- Shiva Bells (Assam), CC0: https://freesound.org/people/grololo/sounds/34870/
- Indian Temple Bell, CC0: https://freesound.org/people/ganiket/sounds/466652/
- Shankh Sound, CC0: https://freesound.org/people/rsn267/sounds/746592/
- One-Beat Damaru, CC0: https://freesound.org/people/pbimal/sounds/813255/
- Chanting people in Indian Hindu temple, CC0: https://freesound.org/people/nickcase/sounds/553169/
- Mahamrityunjay mantra (vocal), CC0: https://freesound.org/people/afleetingspeck/sounds/256992/ (the search listing showed "Attribution" but the sound page says CC0; re-check before use)
- hindu ritual (Puja) in the temple with bells, CC-BY 4.0: https://freesound.org/people/bohitomi/sounds/261867/
- Damaru & Conch, CC-BY 3.0: https://freesound.org/people/baba108/sounds/550446/
- Avoid: Sankh_conch (Odiasites.com) is CC-BY-NC 3.0.

**Recommendation**: write to the Shree Somnath Trust for permission to use a 7 pm aarti recording. Failing that, commission a new performance of the public-domain texts above, which you would own outright.

## 6. Open questions
- The exact aarti hymn sequence and instruments, and whether a nagara/dhol is used (ask the trust).
- The exact foundation date in 1950.
- An authoritative date, if any, for the Baan Stambh text.
