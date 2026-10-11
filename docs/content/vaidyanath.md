# Vaidyanath (Baba Baidyanath Dham, Deoghar, Jharkhand): research notes

Story data: `src/temples/stories/vaidyanath.json`. Researched 2026-10-07.

Sources used most: the Deoghar district administration site (https://deoghar.nic.in/history/), the Shiva Purana Kotirudra Samhita ch. 28 (wisdomlib, Shastri translation), babadham.org (presents itself as the "Baba Baidyanath Dham Temple Trust" site; its quality is uneven: it calls Vaidyanath "9th of 12" and tells the Ganesha version of the legend, so it was used only for timings, festivals and the healer etymology), Wikipedia "Baidyanath Temple", Incredible India, and news.

**Parli dispute.** The short Jyotirlinga hymn ("Saurashtre Somanatham cha…") reads "Paralyam Vaidyanatham cha", which Parli Vaijnath (Beed, Maharashtra) takes as its own. The longer Dvadasha Jyotirlinga Stotram verse 5 reads "Purvottare prajvalikanidhane" ("in the north-east, at the place of the blazing pyre"), with a recorded variant "पारलिकाभिधाने" ("at the place called Parlika"; sanskritdocuments.org prints it in brackets). Deoghar reads "prajvalika" as the cremation ground (the Shiva Purana's list has "Vaidyanatha in the cremation ground", citābhūmau). The darshan stop states both readings without judging. `catalog.ts` already carries the Parli note; it is accurate and was left unchanged.

## Stop map (walking order from the spawn in the lane)

| # | id | at (zone / anchor) | kind | Topic |
|---|----|--------------------|------|-------|
| 1 | vaid-lane | lane (spawn) | ritual | Kanwars, Sultanganj Ganga jal (~105 km), never set down, Bol Bam, Dak Bam, 2025 numbers |
| 2 | vaid-ravana | prangan (inside the Singh Dwar) | legend | Ravana's penance and nine heads (Shiva Purana); healer etymology (tradition); the cowherd sets the linga down; Vishnu as Baiju (local tradition) |
| 3 | vaid-parvati | parvati (west flank of Maa Parvati) | ritual | Gathbandhan; Sati's heart, Hridaya Peetha, Jaya Durga; "cremation ground" in the Purana's list |
| 4 | vaid-tower | anchor `tower`, behind the main temple | history | 72-ft tower, Gidhaur kalashas, Panchshool; Puran Mal 1596; Keating 1788 |
| 5 | vaid-porch | temple (porch anchor) | ritual | Kancha Jal at 4 AM, Shringar Puja; Basant Panchami Tilak by Mithila devotees; Mahashivratri sindoor |
| 6 | vaid-garbhagriha | garbhagriha | ritual | Darshan: broken top (Ravana's thumb, tradition), Stotram v.5, Parli note, yatra line, aarti cue |

Anchors (site metres, +z east, +x north, origin = sanctum centre): lane [0,0,50], prangan [0,0,34], parvati [9.6,0,20] (the crowd's clear path ends there), tower [0,0,-7.8] (the circuit behind the temple), porch [3.5,0.45,8.8], garbhagriha [1.2,0.45,1.4]. DARSHAN at [0,0.45,1.8] r 2.2, source = linga (-0.25, 0.6, -0.15) per `sanctum.ts` (SANCTUM.lx/lz).

Walk-tested route (the queue rails at x = ±1.3 and the serpentine shape it): lane → (0, 32) → through the serpentine (2.4, 32) → (2.4, 35.3) → (7, 35.3) → (7, 25.8) → (9.3, 25.8) → Parvati (9.6, 20) → (5, 15) → (5, 12.6) → (8.4, 12.6) → (9.6, 10.3) → behind the temple (9.6, −6.75) → (0, −7.8) → (−8.3, −6.75) → (−8.3, 7.8) → (−9, 8.4) → (−9, 11.8) → (0, 11.8) → up the porch steps → (3.5, 8.8) → (0, 5) → sanctum (0.8, 1.6). The plinth (0.4 m) can only be climbed by the front steps.

## 1. Legend

### Shiva Purana, Kotirudra Samhita ch. 28 ("The glory of Vaidyanatheshvara")
https://www.wisdomlib.org/hinduism/book/shiva-purana-english/d/doc226529.html
- vv. 1–6: Ravana propitiates Shiva on Kailasa, then digs a pit "among the groves of trees on the southern side of Himavat", kindles fire; pañcāgni in summer, sleeping on the ground in the rains, standing in water in winter.
- vv. 7–10: he cuts his heads one by one; after nine, Shiva appears and "reinstated the severed heads without causing pain", granting a boon.
- vv. 14–15: Shiva lets him carry the linga, warning it will stay wherever it is set on the ground.
- vv. 17–21: on the way Ravana needs to pass urine, hands it to a cowherd; "about an hour" passes, the cowherd sets it down; it becomes fixed, "known as Vaidyanātheśvara".
- vv. 24–25: Brahma, Vishnu and the gods come, worship it and call it Vaidyanatha (used in a "did you know").
- The Purana translation does not itself say "physician"; the healer etymology ("Shiva healed Ravana's wounds as the divine physician, Vaidya") is from babadham.org and general tradition, so the narration says "Tradition says".

### Variants (not used as fact)
- Vishnu as a cowherd/shepherd named **Baiju** (Baiju Gadariya); Ravana presses the linga with his thumb (Wikipedia, rkmvdeoghar.org). Used, attributed to "many here say" / "tradition says".
- Varuna enters Ravana's belly via achaman so he must stop (Wikipedia, shubhpanchang). Not used.
- Ganesha as a Brahmin boy (babadham.org, behindeverytemple.org: that is the Gokarna story's form). Not used.
- Ravana digging Shivganga for water: common lore, not sourced well. Not used; Shivganga appears only in a "did you know" (Kartik Purnima bath, babadham.org festivals).

### Shakti Peetha
- Heart of Sati: Hridaya Peetha; Jaya (Jai) Durga (babadham.org about page; deoghar.nic.in "one of the 51 Shakti Peethas"; IANS 2025, chief priest: "her heart fell here").
- Shiva Purana's list: "Vaidyanātha in the cremation ground" (citābhūmau). The link to Sati's pyre ("Chitabhumi") is local tradition, hedged in the text.

## 2. History

| Date | Event | Source |
|------|-------|--------|
| 1596 | "certain parts of the front portion of the temple are said to have been built by Puran Mal, an ancestor of the Maharaja of Giddhour" | deoghar.nic.in/history |
| — | Three gold kalashas "donated by the Maharaja of Giddhaur" (behindeverytemple: Raja Puran Singh) | deoghar.nic.in; behindeverytemple.org |
| 1788 | Keating, first English collector of Birbhum, sends his assistant Hesilrigg to supervise collection of pilgrim offerings; later visits, abandons direct interference, hands control to the high priest | Wikipedia "Baidyanath Temple" (from the old district gazetteer) |
| 8th c. (claimed) | "Historical records suggest the temple's existence as early as the 8th century AD, during the reign of the Gupta dynasty" | Incredible India. **Not used**: the Gupta dynasty had ended long before; the claim is muddled. |
| — | Raja Man Singh of Amber "contributed" | Incredible India; not used (no detail). |
| 2025 | About 53 lakh kanwariyas during the Shravani Mela | The Week (PTI), 7 Aug 2025 |

- Structure: east-facing, plain stone, pyramidal tower 72 ft; Panchshool; Chandrakanta Mani (eight-petalled lotus jewel) on the inner top (deoghar.nic.in). The complex: main shrine + 21 other temples (Incredible India), "22 shrines" (babadham.org).
- Linga: about 5 in. across, raised about 4 in. over a stone slab (behindeverytemple.org).

## 3. Rituals and living culture
- **Timings (babadham.org/timings)**: 4:00 AM pat opens; 4:10 Kancha Jal; 4:00 PM pat closes; 6:00 PM reopens; 6:10 PM Shringar Puja; 8:00 PM pat closes (header says "Open daily 4 AM – 9 PM"). JharGov TV's broadcast graphic: morning 4:45–5:30, evening 7:30–8:15; its videos are titled "संध्या-7:30 से बाबा श्रृंगार पूजा". **Conflict**: Shringar Puja 6:10 PM vs 7:30 PM.
- **Shravani Mela**: Shravan (July–August); Ganga jal from Sultanganj (Ajgaibinath); distance given as 105 km (babadham.org, Amar Ujala 2026), "almost 108 km" (deoghar.nic.in), 112 km (Aaj Tak). Narration: "about a hundred and five kilometres". "Bol Bam". The custom that the kanwar is not set on the ground, and the **Dak Bam** who finish within about a day, are widely reported but I did not find them on an official page (flagged).
- **Gathbandhan**: red threads offered by devotees, tied by volunteers who climb the spires of Baba's and Parvati's temples (behindeverytemple.org, Incredible India: "the Maa Parvati temple is tied up with the main temple with huge red sacred threads … Gathbandhan (nuptial knot)").
- **Panchshool**: five-pronged; "Before Mahashivaratri, the Panchshul is opened and placed on the temple spires during the occasion" (IANS, chief priest). Narration: "taken down for worship, and then raised again for the festival". Aaj Tak (2026): darshan of the Panchshool alone is held meritorious; Ravana's Lanka guarded by Panchshools (not used).
- **Mahashivratri**: Chatushprahar (four-watch) puja; sindoor offered "symbolising the completion of Shiva's marriage" (IANS).
- **Basant Panchami Tilkotsav**: devotees "especially from the Mithila region" bring kanwars for jalabhishek and the Tilak, "the ceremonial beginning of Lord Shiva's divine wedding festivities" (babadham.org/festivals).
- Kartik Purnima: deep daan and ritual baths in Shivganga (babadham.org/festivals).

## 4. Aarti
- **Lyrics in the JSON**: "Om Jai Shiv Omkara" (as in Omkareshwar), marked as a common Shiva aarti, **not** documented as the text sung at the Shringar Puja.
- **YouTube** (verified 2026-10-07):
  - No temple-trust channel could be verified: babadham.org has placeholder (`href="#"`) social icons and announces a "24x7 live darshan on YouTube" without a link.
  - The **Deoghar district site** (deoghar.nic.in, run by the district administration, which administers the temple) embeds video `8br8t_ulbkA` ("देवघर स्थित बाबा वैद्यनाथ मंदिर के गर्भगृह से प्रातः श्रृंगार पूजन - 26-07-21"), from **JharGov TV** (channel UCSXD7-uvfR7bizvymaxR-9Q, the Jharkhand government's channel). That confirms the channel. The district's own channels (@TheBabadham "DC DEOGHAR", @DCDeoghar123) carry no aarti.
  - Primary: `5xLkWfStYkw`, "देवघर स्थित बाबा वैद्यनाथ मंदिर के गर्भगृह से संध्या आरती - 29-07-21" (24:40). oEmbed 200, playableInEmbed true. The aarti, sung with lamps by the priests, runs **1249–1449 s** (contact sheets every 6 s and 2-s loudness: singing starts at ~20:49 after a pause, lamp waved at ~23:00–23:30, silence from 24:09, then the outro).
  - Backup: `0vn8hwYz60w`, "बाबा बैद्यनाथ की संध्या पूजा-आरती | LIVE" (27:05). oEmbed 200. A lamp is offered under the red shringar cloth at ~22:30, then the priests' aarti at the door to the end: **1350–1620 s**.
  - Rejected: `8br8t_ulbkA` (morning shringar; chanting throughout, no aarti visible), `Oz3pWJz3yD4` (morning puja; no clear aarti).
  - Both entries are `official: false` (shown as a broadcaster): JharGov TV is a government channel, not the temple's. No `live` entry: JharGov TV streams many unrelated events.

### Audio licensing
No freely licensed recording found. JharGov TV / district material: needs permission.

## 5. Open questions
- Whether babadham.org is really run by the temple's management board (the "Baba Baidyanath Dham Temple Trust" footer; no registration details).
- The evening Shringar Puja time (6:10 vs 7:30 PM).
- The Dak Bam "within a day" and "never set down" customs: widely reported, not found on an official page.
- The exact text sung at the Shringar Puja aarti.
