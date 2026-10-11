# Omkareshwar with Mamleshwar/Amareshwar (Khandwa district, Madhya Pradesh): research notes

Story data: `src/temples/stories/omkareshwar.json`. Researched 2026-10-04.

Primary source: the **Shri Omkareshwar Mandir Trust** site, https://shriomkareshwar.org (pages: MainTemple, Schedules, OtherTemples, Ghats, Bridges, Narmada, Parikrama, OmkarParvatParikrama, SomwarSawari, ShayanDaan, SayamKalinArti, Rules, Festivals). The older site omkareshwar.org is a separate, unofficial-looking site and was used only for the Mamleshwar naming note.

## Stop map (walking order from the spawn on the Jhoola pul)

| # | id | at (zone / anchor) | kind | Topic |
|---|----|--------------------|------|-------|
| 1 | omkar-jhoola | jhoola | history | Om-shaped Mandhata island; Mamleshwar/Amareshwar behind, with its Paramara inscriptions, Ahilyabai and ASI |
| 2 | omkar-vindhya | darshan (lane and galleries) | legend | Vindhya's penance; Omkara and Parameshvara/Amareshwar (Shiva Purana) |
| 3 | omkar-ghat | ghat (Koti Tirth) | ritual | Bathing, Narmada aarti and deepdaan, Somwar Sawari, island parikrama |
| 4 | omkar-temple | temple | history | Sixty-pillar hall, five storeys, unknown builder; Trust/Scindia/Holkar pujas; Shankara–Govindapada |
| 5 | omkar-upper | upper | legend | Mahakaleshwar above Omkareshwar; King Mandhata; Skanda Purana's "Vaidurya Mani Parvat" |
| 6 | omkar-garbhagriha | garbhagriha | ritual | Invocation (Stotram v.4), then the aarti |

Mamleshwar has no anchor in `anchors.ts`; it sits across the river (`MAMLESHWAR` in `layout.ts`). Its history was folded into stop 1, since the spawn on the bridge has it behind the pilgrim. Adding an anchor near `MAMLESHWAR` would allow a separate stop.

## 1. Legends

### Vindhya: Shiva Purana, Kotirudra Samhita, ch. 18
https://www.wisdomlib.org/hinduism/book/shiva-purana-english/d/doc226519.html
- vv. 4–10: Narada visits Vindhya, who boasts; Narada says "Meru is loftier" and "classified among gods".
- vv. 11–15: Vindhya goes to Omkara, makes an **earthen idol**, and meditates for six months.
- vv. 16–21: Shiva grants the boon he asks for, intellect to achieve his aim. The gods ask Shiva to stay.
- vv. 22–23: "In the Praṇava, Sadāśiva came to be known as **Oṃkāra**"; "what is born of the earthen idol became **Parameśvara**."
- **Variant (trust)**: "after the prayers of the gods, the lingam was divided into two parts: one became Omkareshwar and the other, Mamleshwar. The Jyotirlinga is located at Omkareshwar, while the physical (parthiva) lingam is at Mamleshwar or Amreshwar."
- The Shastri translation renders the second form as "Parameśvara"; the stotra line has "**Amaleshwaram**", and temple tradition says Amareshwar/Mamleshwar. The narration states the Purana's wording and the temple's identification separately.

### King Mandhata (trust, "another version")
"King Mandhata of the Ikshvaku dynasty meditated here, and Bhagwan Shiva appeared and blessed him." Hence the island's name.

### Skanda Purana, Reva (Narmada) Khanda
The island was earlier called "**Baidurya/Vaidurya (Mani) Parvat**" (puratattva.in; the trust's Narmada page says "Vaidurya Mani Parvat"). I did not read the Purana text directly.

### Other lore (trust)
- The northern channel around the island is "considered the Kaveri"; hence "Kaverika-Narmadayoh … samagame".
- Ganga bathes in the Narmada as a black cow to purify herself (Narmada page). Not used.
- Shayan: Shiva and Parvati come to Omkareshwar every night to rest. A silver swing, bed, chaupad, chamara and damru are set out (ShayanDaan page).

## 2. Documented history

| Date | Event | Source |
|------|-------|--------|
| 1055 | Paramara Jayasimha I grants the village of Bhima to brahmins "at the holy Amareshvara", the earliest epigraphic reference | https://puratattva.in/omkareshwar-a-shapeless-manifestation-of-the-non-manifest/ |
| 1063 | Inscriptions at Amareshvara (Mahimna and other hymns; the Halayudha-stotra dated in Vikram Samvat = 1063 CE) list five lingas: Amareshvara, Omkara, Avimukta, Kedara, Mahakala | puratattva; trust OtherTemples ("Mahimn Stotras … dating back to 1063 AD") |
| 1274 | Last Paramara record at Mandhata (Jayavarman II) | puratattva |
| (1165, by tradition) | Bharat Singh Chauhan marries the daughter of the Bhil chief Natthu Bhil and settles at Mandhata; the Rao family later hold Mandhata | secondary (search snippet); the trust says the Rao family managed the region "for centuries" |
| late 18th c. | The Peshwas rebuild the Amareshvara temple from fallen fragments | puratattva |
| 18th c. | Ahilyabai Holkar (d. 1795) worships at Mamleshwar; Holkar-paid priests perform daily puja from then on; today managed by the "Ahilyabai Khasgi (Khansgi) Trust"; protected by the ASI | trust OtherTemples |
| 1824 | Mandhata passes from the Scindia to the British | secondary (puratattva / Village Square); not used |
| 31 May 1979 | Cantilever footbridge (200 m, Rs 28 lakh) completed by the MP government | trust Bridges |
| 2004 | **Mamleshwar Setu** (235 m × 4 m, Rs 7.2 crore) built by NHDC, "connecting directly to the main temple gate" | trust Bridges. The page discusses it alongside the "Jhula Bridge" but does not say plainly that they are the same bridge, so the narration does not name the Jhoola pul's build date. |
| 1989 | Govindeshwar temple renovated; foundation stone laid by President R. Venkataraman | trust |
| 2023 | Ekatma Dham with the 108-ft Statue of Oneness (Shankara as a boy) | trust Parikrama page (the year is from general knowledge; the page gives no date) |

- **The temple's own builder or date is unknown**: "There is no authentic record of who built the temple or when" (trust MainTemple). Wikipedia says "constructed by the Paramara Kings during the 11th century" and has a garbled line about "Mahmud Ghazni" in the 13th century. **Do not use the Wikipedia history here.** https://en.wikipedia.org/wiki/Omkareshwar_Temple
- Architecture (trust): the old sanctum faces north, the newer hall faces south, so the linga is not aligned with the door or the spire. The hall is about 14 ft high on 60 pillars. Five storeys: Omkareshwar, Mahakaleshwar, Siddhnath, Gupteshwar, and the flag deity (Dhwajeshwar).
- **Gauri Somnath temple**: the trust cites Col. James Tod that it was "destroyed by Aurangzeb". Not used.
- **Siddhnath temple**: elephant frieze (about 50 elephants of about 5 ft, two in the Nagpur museum); the trust says Lord Curzon declared it protected (garbled as "Bhagwan Curzon" on the page).

## 3. Rituals and living culture (trust)

**Timetable**
- 04:30–05:00 Mangal Aarti and Bhog
- 05:00–12:20 Mangal Darshan
- 12:20–13:15 Madhyanha Bhog
- 13:15–16:00 Madhyanha Darshan
- 16:00–16:15/16:30 Sayamkalin Shringar
- to 21:30 Shringar Darshan
- **21:30–22:00 Shayan Shringar and Aarti**
- 22:00–22:30 Shayan Darshan

**Conflict**: the ShayanDaan page says "After the Shayan Aarti (9:00–9:30 PM)". Some travel sites give Mangal Aarti 05:00–05:30.

- **Three daily pujas**: morning by the Trust, afternoon by priests of the **Scindia** family, evening by priests of the **Holkar** family.
- **Rules**: no dress code ("simple and modest clothes"); **touching the Shivling is strictly prohibited**; only darshan and water offering inside the garbhagriha.
- **Somwar Sawari**: Mondays at 16:00; a golden palanquin with the three-faced (trimukhi) image goes via the Shankaracharya temple to Koti Tirth Ghat, then a boat ride, then a tour of the town; especially grand in Shravan; chants of "Om Shambhu Bholenath".
- **Narmada Aarti** daily at Koti Tirth Ghat; deepdaan, especially at Narmada Jayanti.
- **Island parikrama**: about 7 km; the trust runs guided walks from 07:00 to 09:00. Sites: Siddhnath, Gauri Somnath, Rin Mukteshwar (Kaveri–Narmada sangam; chickpea offering to clear debts), Kedareshwar, Aashapuri Devi, the Chand-Suraj and Bhim-Arjun gates, Ekatma Dham.
- **Narmada Parikrama**: about 2,600 km, Bharuch to Amarkantak and back on the other bank; "the only Jyotirlinga along the way is in Omkareshwar".
- Festivals (trust calendar 2026): Mahashivratri on 15 Feb, Nag Panchami on 17 Aug, the Shravan Mondays, and others.

## 4. Aarti
- **Lyrics in the JSON**: "**Om Jai Shiv Omkara**", the most widely sung traditional Shiva aarti, given as a common core text of eight stanzas. Its signature line is "कहत शिवानन्द स्वामी". Some sources credit Pandit Shardha Ram Phillauri (1837–1881), who is better known for "Om Jai Jagdish Hare". Either way the text is long out of copyright. **Variants**: many printings add stanzas ("लक्ष्मी व सावित्री पार्वती संगा…", "पर्वत सोहैं पार्वती…", "जटा में गंग बहत है…", "काशी में विराजे विश्वनाथ…") and differ in small words. Check against a print edition such as Gita Press "Aarti Sangrah" before final publication.
- It is **not documented** as the specific text of Omkareshwar's Shayan Aarti; the JSON says so.
- Shankara's stotra verse (v.4, "कावेरिकानर्मदयोः…") is used in the sanctum invocation. The trust's MainTemple page quotes it in transliteration and attributes it to Adi Shankaracharya.

### Audio licensing

| Candidate | License | Usable? |
|-----------|---------|---------|
| Trust Live Darshan (shriomkareshwar.org/LiveDarshan.aspx) | no reuse licence; trust copyright policy | **Needs permission** (shriomkareshwar@gmail.com, +91 8989998686) |
| Wikimedia Commons / archive.org / freesound recordings from Omkareshwar | none found | none |

Generic CC0 ambience is the same list as in `somnath.md`.

## 5. Open questions
- Whether the Jhoola pul is the 2004 Mamleshwar Setu (likely, but not stated plainly by the trust).
- The Shayan Aarti time (21:00 or 21:30).
- What is chanted or sung at the Shayan Aarti.
