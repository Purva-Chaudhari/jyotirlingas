# Kashi Vishwanath (Varanasi, Uttar Pradesh): research notes

Story data: `src/temples/stories/kashi-vishwanath.json`. Researched 2026-10-07.

The official site is shrikashivishwanath.org, run by the Shri Kashi Vishwanath Temple Trust. It is script-rendered, so I read it in headless Chrome. Quotes marked "official" come from its /mythology and pooja pages.

## Stop map (walking order from the spawn in the Parisar)

| # | id | at (zone / anchor) | kind | Topic |
|---|----|--------------------|------|-------|
| 1 | kashi-parisar | parisar (spawn) | legend | Kashi as Shiva's city: Shiva and Shakti, five kroshas, the trident at pralaya, Avimukta, Anandavana; the official "merit of all Jyotirlingas"; first to the Ganga |
| 2 | kashi-chowk | chowk | history | Kashi Vishwanath Dham, 13 Dec 2021: 3,000 to about 5 lakh sq ft, about 300 properties, 40+ temples found; Kashi Tamil Sangamam |
| 3 | kashi-ganga | ganga (Ganga Dwar plaza; the zone covers the whole descent) | legend | Uttaravahini Ganga; Bhagiratha, Sagara's sons, Kapila; Shiva catches Ganga in his hair |
| 4 | kashi-ghat | anchor `ghat` only (the lowest dry treads) | ritual | **Kashi–Rameshwaram**: sand given to the Ganga, Ganga jal carried south for Ramanathaswamy's abhishekam, the yatra complete only then; Manikarnika and the Taraka mantra (left, north); Ganga aarti at Dashashwamedh (right, south) |
| 5 | kashi-gyanvapi | gyanvapi | history | Gyanvapi well (Kashi Khanda: dug by Shiva's trident); the Nepali Nandi facing north; 1585 Todar Mal; 1669 Aurangzeb's demolition and the mosque; the priest and the well (tradition); 1828 Baiza Bai's colonnade |
| 6 | kashi-temple | temple (east verandah) | history | Ahilyabai Holkar, 1780; Ranjit Singh's gold in the 1830s; two crowns gilt, the third stone (official) |
| 7 | kashi-garbhagriha | garbhagriha | ritual | Darshan; the silver basin; the Saptarishi aarti; Ganga jal to Rameshwaram; Stotram verse; "ninth Jyotirlinga"; the yatra line; aarti cue |

The ghat stop has no zone, so it does not fire together with the Ganga stop: while the Ganga story is still being told and the pilgrim is still in the `ganga` zone, the ghat story waits and the engine shows "press N". When facing the river (east, +z), north (+x, Manikarnika, downstream, since the Ganga flows north here) is on the left, and Dashashwamedh (south) is on the right.

## 1. Legends
- **Shiva Purana, Kotirudra Samhita, ch. 22** (https://www.wisdomlib.org/hinduism/book/shiva-purana-english/d/doc226523.html): the formless Shiva becomes Shiva and Shakti and makes a city five kroshas wide for their penance. Vishnu's penance fills it with water, and a jewel falls from *Vishnu's* ear (Manikarnika). At dissolution Kashi is held on Shiva's trident. The Avimukteshvara linga is here, and liberation (sayujya) is granted. **Variant**: in the Kashi Khanda the earring is Shiva's. The narration only says "Manikarnika" and does not tell the earring story.
- **Avimukta / Anandavana**: "never forsaken" (Shiva never leaves it); "forest of bliss" (Stotram: "आनन्दवने").
- **Taraka mantra**: the belief that Shiva whispers it to the dying at Kashi. This is a living tradition (Kashi Khanda), and the narration says "Kashi believes".
- **Gyanvapi**: in the Kashi Khanda, Shiva (as Ishana) digs the well with his trident to bathe the linga, and its water is jnana. The narration attributes this to the Kashi Khanda.
- **Descent of Ganga**: Valmiki Ramayana, Bala Kanda: Bhagiratha, the 60,000 sons of Sagara burned by Kapila, and Shiva receiving Ganga in his matted locks.
- **Official**: "Tradition has it that the merits earned by the darshan of other jyotirlinga … accrue to devotee by a single visit to Kashi Vishwanath Temple."

## 2. Documented history (told neutrally, as dated events)

| Date | Event | Source |
|------|-------|--------|
| 1194 | The original temple is destroyed by the Ghurid army (after Chandawar) | Wikipedia; not narrated by date, covered as "destroyed and rebuilt more than once" |
| 1585 | Raja Todar Mal helps rebuild the temple (the scholar Narayana Bhatta is also credited) | Wikipedia; Narayana Bhatta is left out to keep to three named people |
| 1669 | Aurangzeb orders the temple demolished, and the Gyanvapi mosque is built on its site | Wikipedia ("destroyed the temple and built the Gyanvapi Mosque in its place") |
| — | A priest jumps into the Gyanvapi well with the linga to protect it | Wikipedia, as tradition ("the main priest … jumped in the well") |
| 1780 | Ahilyabai Holkar builds the present temple | official; Wikipedia |
| 1785 | A Naubatkhana is built in front of the temple by Collector Mohd. Ibrahim Khan at Warren Hastings' instance | official |
| 1828 | Baiza Bai, widow of Daulat Rao Scindia, builds a colonnade of 40+ pillars at the Gyanvapi | search results (Wikipedia-derived) |
| 19th c. | The Nandi at the Gyanvapi is gifted by Nepal's ruler. **Dates conflict**: 1800–04 (Rana Bahadur Shah), 1824–25, or c. 1860 | multiple; narrated as "nineteenth century" |
| 1835 / 1839 | Ranjit Singh's gold for the domes. **Conflict**: Wikipedia says 1835 ("1 tonne"); the official site says 1839, "two domes … covered by gold … Third dome still remains uncovered" | narrated as "in the 1830s"; the tonnage is not used |
| 28 Jan 1983 | The UP government takes over; a trust manages the temple | official |
| 13 Dec 2021 | Kashi Vishwanath Dham inaugurated: about 5 lakh sq ft (formerly about 3,000 sq ft), about 300 properties acquired, 40+ old temples found and restored, 50,000–75,000 devotees | PIB New India Samachar; narendramodi.in; Wikipedia |
| Nov 2022 → | Kashi Tamil Sangamam editions | news |
| Jul 2025 | Holy-water and sand exchange with Rameshwaram | Drishti IAS |

**Handling of Gyanvapi**: dates and the actors' roles only, with no adjectives about motives and no reference to current court proceedings. The priest-and-well story is labelled as tradition.

## 3. Rituals
- **Official**: Mangala Aarti "begins between 3:00–4:00 AM", with entry from 2:30–3:00 AM. The booking page also lists Mid-day Bhog, Sapt Rishi and Shringaar/Bhog aartis without times.
- **Secondary** (approximate, seasonal): Bhog about 11:15–12:20; Saptarishi about 7:00–8:15 PM; Shringar/Bhog about 9:00–10:15 PM; Shayan about 10:30–11:00 PM.
- **Saptarishi Aarti**: seven priests (of different gotras) stand for the seven sages, who by tradition come each evening (varanasitemples.in, isha.sadhguru.org). The ritual is said to be over 750 years old (not used).
- **Ganga Aarti** at Dashashwamedh every evening. This is a riverfront ceremony, not run by the temple trust.

## 4. Aarti and YouTube
- **Text**: the Stotram verse "सानन्दमानन्दवने वसन्तमानन्दकन्दं हतपापवृन्दम्। वाराणसीनाथमनाथनाथं श्रीविश्वनाथं शरणं प्रपद्ये॥" (sanskritdocuments.org). It is **verse 11** of the full stotra. Kashi is **9th** in the short list used by `catalog.ts`, so the narration says "ninth Jyotirlinga of the Stotram".
- **Official channel**: "Shree Kashi Vishwanath Mandir Trust", @ShreeKashiVishwanathMandir, UCdMj2twWfMHXrWgX5oVdoyA. Verified because shrikashivishwanath.org/online/live_darshan embeds its live stream (5CRYVeeJC9w), and oEmbed for that stream returns this channel as the author.
- **Primary**: j56iOJwk4Zo, "Shayan Aarti at Shri Kashi Vishwanath Temple" (16:47, audio over a still card; the first ~10 s is a title card). Loop 12–1000 s. oEmbed 200, playableInEmbed true. It played in the walk test ("Now playing").
- **Backup**: j44KiuUJGp8, Saptarishi/Sandhya aarti by the trust's archakas (9 May 2020, 2:34). Loop 2–152 s. oEmbed 200, embeddable. Other recordings: AwgrhpizbAg (8 May 2020, 1:18), _3TJWtqkd_s (Bhog Aarti short), fYywP7mNsq4 (Mangla Aarti short).
- **Live**: the channel's live stream (kind `live`).

## 5. Uncertain facts
- The date of the Nepali Nandi (see above) and which way it faces "toward the old temple". That second point is commonly said, and the model shows it facing north.
- The 1830s gilding: 1835 vs 1839.
- The Saptarishi priests as descendants of the sages, and the "750 years": popular claims, not used.
- That the Ganga flows "north at Kashi" is well known (uttaravahini), and it is narrated as "people say this is part of what makes this bank so holy".
