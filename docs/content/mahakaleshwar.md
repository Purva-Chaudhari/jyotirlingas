# Mahakaleshwar (Ujjain, Madhya Pradesh): research notes

Story data: `src/temples/stories/mahakaleshwar.json`. Researched 2026-10-04.

The official site (shrimahakaleshwar.mp.gov.in) is a JavaScript app; its text, including the aarti table, history and festivals, ships in `/assets/index-*.js`, and I read it from there. Quotes marked "official" come from it.

## Stop map (walking order on the general darshan route)

| # | id | at (zone / anchor) | kind | Topic |
|---|----|--------------------|------|-------|
| 1 | mahakal-queue | queue | history | Mahakal Lok (2022), Avantika, Kalidasa's Meghaduta, Simhastha, "Mahakal as king" |
| 2 | mahakal-tunnel | tunnel (Mahakal Tunnel-1) | legend | Dushana and Vedapriya's sons; Shiva rises from the earth (Shiva Purana) |
| 3 | mahakal-ganesh-mandapam | ganesh-mandapam | ritual | Dakshinamukhi; the Bhasma Aarti sequence, ash, dress, veiling |
| 4 | mahakal-palki | palki (Palki Hall, exit) | ritual | Shravan–Bhadrapada Monday Sawari; Shahi Sawari; Vijayadashami Seemolanghan |
| 5 | mahakal-temple | zone `temple` + anchor `courtyard` | legend | The three-level shrine; Chandrasena, Chintamani, the cowherd boy Shrikar, Hanuman's prophecy |
| 6 | mahakal-kotitirtha | kund | history | Kotitirtha; Paramaras; Iltutmish 1234–35; Maratha rebuilding in the 1730s |
| 7 | mahakal-garbhagriha | garbhagriha | ritual | Invocation (Stotram v.3), then the aarti |

On the general route the darshan spot is the Ganesh Mandapam (the `DARSHAN` anchor in `anchors.ts`), so the aarti sound may already start at stop 3. Stop 7 fires in the sanctum (VIP mode) and works as the formal invocation.

## 1. Legends

### Dushana: Shiva Purana, Kotirudra Samhita, ch. 16
https://www.wisdomlib.org/hinduism/book/shiva-purana-english/d/doc226517.html
- vv. 5–12: In Avanti, the brahmin **Vedapriya** and his four sons **Devapriya, Priyamedhas, Sukrita, Dharmavahin** worship Shiva with an earthen (parthiva) linga.
- vv. 14–28: The asura **Dushana** of **Ratnamala** mountain, empowered by Brahma's boon, sends four daityas to stop Vedic worship.
- vv. 34–39: The ground near the linga opens and Shiva emerges: "I am Mahākāla … risen up against the wicked." He burns Dushana with a "Hum".
- vv. 45–49: He stays at the devotees' request as **Mahakaleshvara**; the linga's sanctity extends "three kilometres" around (a krosha measure in the translation).
- The official site's version says Shiva appeared "as a radiant Jyoti". That is a simplified retelling.

### Chandrasena and Shrikar: Shiva Purana, Kotirudra Samhita, ch. 17
https://www.wisdomlib.org/hinduism/book/shiva-purana-english/d/doc226518.html
- vv. 3–8: King **Chandrasena** receives the **Chintamani** gem from the gana **Manibhadra**.
- vv. 9–16: Jealous kings besiege Ujjayini; the king keeps worshipping.
- vv. 19–34: A cowherdess's **five-year-old son** worships a pebble; his mother throws it away; his grief is followed by the appearance of a jewelled "temple of Mahakala".
- vv. 38–56: The besiegers give up their hostility. **Hanuman** appears and names the boy (**Shrikara**).
- v. 68: "In his race, in the eighth generation, there will be … Nanda. Viṣṇu himself will be born as his son, Kṛṣṇa."
- **Variant**: Wikipedia's summary says Shiva "appeared in his Mahakala form and destroyed the enemies of King Chandrasena". In the Shiva Purana text the kings withdraw after the miracle, with no battle. The narration follows the Purana. https://en.wikipedia.org/wiki/Mahakaleshwar_Jyotirlinga

### Other traditions
- **Dakshinamukhi**: the only south-facing Jyotirlinga (official). Wikipedia adds that this is "upheld by the tantric shivnetra tradition". The narration's line that the south is the direction of death or Yama states a general Hindu belief, not a temple-specific claim.
- **Shakti Peetha**: Wikipedia says Sati's upper lip fell here, with the Shakti as Mahakali. Other lists place Ujjain's peetha at **Harsiddhi** (the elbow). Sources disagree, so this was not used.
- Local lore (official): Parvati did penance here.

## 2. Documented history

| Date | Event | Source |
|------|-------|--------|
| 6th c. BCE (claimed) | King Chandapradyota appoints his son Kumarasena to oversee the temple | official site ("historical records suggest"); not independently verified, not used |
| c. 4th–5th c. CE | Kalidasa's **Meghaduta** asks the cloud to stop at Mahakala in Ujjayini and act as the drum at the evening worship; the next verse describes dancers with chamaras | GRETIL text: Purvamegha v. 33–34 (numbering varies; Kale's edition differs by one). http://gretil.sub.uni-goettingen.de/gretil/1_sanskr/5_poetry/2_kavya/kmeghdpu.htm |
| 10th–12th c. | Height of the temple under the Paramaras (Udayaditya, Naravarman named) | official |
| 1234–35 | **Iltutmish** raids Ujjain and destroys the temple | official ("1235 CE"); Wikipedia ("1234–35"); Minhaj-i-Siraj, *Tabaqat-i-Nasiri*, as quoted on Wikiquote: https://en.wikiquote.org/wiki/Iltutmish |
| — | Fate of the linga: *Tabaqat-i-Nasiri* says images (including the "stone image of Mahakal") were carried to Delhi; **local tradition** says the Jyotirlinga was thrown into **Kotitirtha Kund** | **Conflict**: the narration gives both |
| 1730s | After the Maratha conquest of Malwa, **Ranoji Rao Shinde** entrusts the administration to his diwan **Ramchandra Baba Shenvi**, who rebuilds the temple "during the fourth decade of the 18th century" | official. Wikipedia names "Ramachandra Sukthankar"; a secondary source gives 1732–34 |
| — | **Internal inconsistency** on the official site: another passage says the present structure was built "around 150 years ago" by Shenvi. The 1730s date is the better-supported one. | |
| 11 Oct 2022 | **Shri Mahakal Lok**, phase 1, inaugurated by PM Modi: about 900 m corridor, 108 pillars, 50+ Shiva Purana murals, Rs 856 crore project | https://en.wikipedia.org/wiki/Shri_Mahakal_Mahalok ; Outlook / Deccan Herald |
| 5 Oct 2023 | Mahakal Lok phase 2 inaugurated by CM Shivraj Singh Chouhan | India TV |
| 27 Mar – 27 May 2028 | Next **Simhastha Kumbh** (Jupiter in Leo) | ujjaindarshan / The Week (dates are provisional) |

Architecture (official): a blend of Bhumija, Chalukya and Maratha styles. Three levels: Mahakaleshwar (lowest, below ground), Omkareshwar above it, **Nagchandreshwar** at the top (Shiva and Parvati seated on a ten-hooded serpent in most accounts; a few say seven), open only on Nag Panchami. After darshan the general queue is led up to Omkareshwar, directly above the sanctum.

## 3. Rituals and living culture (official unless noted)

**Daily aartis**

| Aarti | Chaitra–Ashwin | Kartik–Falgun |
|-------|----------------|---------------|
| Bhasma Aarti | 4:00–6:00 AM | 4:00–6:00 AM |
| Dadyodak Aarti (Bal Bhog) | 7:00–7:45 AM | 7:30–8:15 AM |
| Bhog Aarti | 10:00–10:45 AM | 10:30–11:15 AM |
| Sandhya Aarti | 7:00–7:45 PM | 6:30–7:15 PM |
| Shayan Aarti | 10:30–11:00 PM | 10:30–11:00 PM |

- **Bhasma**: "traditionally prepared from cow dung cakes (Gau-Upla)", offered by the Mahant of **Shri Panchayati Akhada Mahanirvani** or a representative; the same Akhada does the daily dhwajarohan. The popular claim that the ash comes from cremation grounds is **not** what the temple says today.
- **Sequence** (secondary guides, consistent with the official text): jalabhishek, then panchamrit abhishek, then shringar (sandal, flowers, bilva, often bhang), then bhasma, then the lamp aarti with bells, conch and drums.
- **Dress**: men in dhoti and sola, women in sari, for close or inner participation (secondary booking guides). **Women veil (ghoonghat) while the bhasma is offered** (Hindi news: khabargaon.com, indianews.in).
- **Viewing halls**: Nandi Mandapam (closest), Ganesh Mandapam (tiered), Kartikeya Mandapam (above, glass); a tunnel of about 250 m carries general devotees to the Ganesh Mandapam (secondary).
- **Mahakal Sawari**: every Monday from Shravan Krishna Pratipada to Bhadrapada Amavasya; the **Rajat Mukharavind** in a silver palki goes to **Ramghat** on the Kshipra; a grand Shahi Sawari on the last Monday.
- **Shiv Navratri**: Falgun Krishna Panchami to Trayodashi; daily abhishek at Kotitirtha; a new mukharavind each evening; on Mahashivratri a once-a-year **afternoon Bhasma Aarti** after the sehra darshan; **Panch Mukharavind darshan** on Chandra Dooj (Chhabina, Manmahesh, Uma-Mahesh, Holkar, Shiv Tandav).
- **Nag Panchami**: the Nagchandreshwar doors open; Sheshnag shringar at the Bhasma Aarti.
- **Vijayadashami**: Sawari with Seemolanghan; Shami puja at the Dussehra Maidan; Holkar Mukharavind darshan.
- **Uma Sanjhi Mahotsav** (Ashwin): Sanjhi rangoli, folk programmes, procession to the Kshipra.

## 4. Aarti
- **What is sung**: not published by the committee. The narration only describes the ritual (bath, shringar, bhasma, lamps, drums, conch, damaru).
- **Lyrics in the JSON** (public domain, labelled): Dwadasha Jyotirlinga Stotram v.3 ("अवन्तिकायां विहितावतारं…"; variant ending "वन्दे महाकालमहं सुरेशम्") and "Karpuragauram".

### Audio licensing

| Candidate | License | Usable? |
|-----------|---------|---------|
| Temple committee live darshan / Bhasma Aarti streams | no reuse licence found | **Needs permission** |
| Wikimedia Commons: 100 "Mahakaleshwar" file hits, all images; "Ujjain" videos are ISKCON Ujjain and a Ram Ghat dawn clip, not Mahakal | | none for Mahakal |
| archive.org: "Ye Kashi Mahakal Hai" is CC BY-NC-SA, a modern song | | not usable (NC/SA) |
| YouTube Bhasma Aarti uploads | | **Needs permission**, not usable |

Generic CC0 ambience is the same list as in `somnath.md` (bells, shankh, damaru, chanting).

## 5. Open questions
- The committee's permission for a Bhasma Aarti recording; whether the committee publishes a stotra or aarti text.
- The Wikipedia naming of Ramachandra "Sukthankar" vs the official "Shenvi".

## The surroundings: real map data (OpenStreetMap)

Map data © OpenStreetMap contributors, available under the Open Database License (ODbL 1.0),
https://www.openstreetmap.org/copyright. The credit is shown on every page (`#osm-credit` in `temples.html`).

- `scripts/fetch-osm.mjs <id> [radius_m=600] [lat lon]` queries the Overpass API (with fallback mirrors and
  retries) for a box round the site's `lat`/`lon` (read from `src/temples/sites/<id>/index.ts`) and writes
  `public/data/osm/<id>.json`: building footprints (with `building:levels` / `height` when mapped), highways
  (class, estimated width), water (lakes, ponds, the Shipra, clipped), green areas, named outlines (precincts,
  attractions), trees and named POIs, all in metres east/north of the centre, simplified (Douglas–Peucker).
  Mahakaleshwar was fetched with an 850 m radius so that Mahakal Lok's entrance plaza is included.
- Alignment (`ujjain.ts`): OSM's outline of the temple (way 1162958993) is centred on the model's temple;
  OSM's Kotitirtha pond then lies within 2.5 m of the model kund, and the precinct outline (way 373720479)
  matches the court's north–south extent (z −46…37 against −44…40). Checked against Esri World Imagery.
- What the map says, and the model now follows: Rudra Sagar lies **west and south-west** of the temple (not
  north); Shri Mahakal Lok runs ~900 m along its east shore from the precinct's south-west corner to the
  entrance plaza at Hari Phatak, where the Nandi Dwar (Wanderlog / plus code 5QGC+G57), the Kamal Kund with the
  seated Shiva (OSM artwork "Shiva") and the Saptarishi Mandal (OSM artwork "Saptarshi") are. The pilgrim
  spawns on the road along the north of the precinct at the north (queue) gate; the road leads west to the
  lakefront path and the corridor.
- OSM maps only ~770 buildings here (the old town is mostly unmapped), so `town.ts` fills the frontage of
  every real street with narrow attached plots and packs the block cores, on an occupancy grid that keeps
  streets, water, the precinct, Mahakal Lok and the Harsiddhi compound clear.
- Harsiddhi temple: not in OSM; placed from imagery (the red-orange temple north-west of Rudra Sagar) with
  its two deepstambhas (Commons: "Harsiddhi Temple, Deepstambha, Ujjain").
