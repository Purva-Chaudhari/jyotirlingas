# Nageshwar (Daarukavana, near Dwarka, Devbhumi Dwarka district, Gujarat): research notes

Story data: `src/temples/stories/nageshwar.json`. Researched 2026-10-07.

There is **no official temple-trust website** for the Dwarka Nageshwar temple. `nageshwarjyotirling.com` (which comes up in searches as "the official website") is a priest's booking site for **Aundha Nagnath** in Maharashtra, not Dwarka. Sources used: the Shiva Purana (Shastri translation on wisdomlib), Gujarat Tourism, Wikipedia, and travel and devotional sites (marked as such).

## Stop map (walking order from the spawn outside the gate)

| # | id | at (zone / anchor) | kind | Topic |
|---|----|--------------------|------|-------|
| 1 | nagesh-dwar | dwar | history | The coast, Dwarka and Bet Dwarka; the Purana's Darukavana; Gulshan Kumar and the 1996 rebuild |
| 2 | nagesh-statue | statue | legend | The 25 m seated Shiva; Daruka and Daruki, Parvati's boon, Aurva's curse, the city carried into the sea |
| 3 | nagesh-prangan | anchor `prangan` (forecourt before the porch) | legend | The boats; Supriya in the prison; the earthen linga and "Namah Shivaya" for six months |
| 4 | nagesh-temple | temple (hall) | legend | Daruka confronts Supriya; Shiva rises from a cleft with a four-door temple; the Pashupata |
| 5 | nagesh-nandi | anchor `nandi` (head of the stair) | legend | Daruki's prayer; the Shiva–Parvati compromise; Nageshwara and Nageshwari |
| 6 | nagesh-garbhagriha | garbhagriha | ritual | Darshan; Stotram v.8 plus "Nagesham Darukavane"; the Dwarka, Aundha and Jageshwar claims; the yatra line; the aarti cue |

`prangan` and `nandi` are anchor-only stops (no zone). The `prangan` zone covers the whole compound, and the `temple` zone covers the Nandi spot. When you arrive at Nandi while the hall story is still playing, the Nandi story waits until it ends, or until you press N.

## 1. The legend: Shiva Purana, Kotirudra Samhita, ch. 29–30 (Shastri translation)

- ch. 29: https://www.wisdomlib.org/hinduism/book/shiva-purana-english/d/doc226530.html
  - v.2: the rakshasi **Dārukā** (popularly **Daruki**) is "arrogant by the boon granted by Pārvatī"; her husband is **Dāruka**.
  - v.4: "His fertile and flourishing forest was on the shores of the Western ocean. It extended to sixteen Yojanas in every direction."
  - vv.5–6: wherever she went the land "acquired all requisites and became full of trees"; the goddess had entrusted the forest to her.
  - vv.8–14: the people seek refuge with the sage **Aurva**, who says: "If the Rākṣasas torture living beings on the earth they will die themselves."
  - vv.16–31: the gods come to fight; Dārukā uses the boon; "flew like the winged king of mountains" and takes the city into the ocean.
  - vv.34–40: the rakshasas seize boats and imprison the travellers.
  - vv.42–52: **Supriya**, a vaishya (merchant) and their leader; "If on any day he could not worship Śiva he did not take his food"; worships an **earthen (parthiva) linga** in prison; teaches the others; those who knew no rite repeat "Namaḥ Śivāya"; six months pass.
- ch. 30: https://www.wisdomlib.org/hinduism/book/shiva-purana-english/d/doc226531.html
  - vv.1–5: an attendant sees "the beautiful form of Śiva"; Dāruka asks Supriya what he meditates on; "I do not know."
  - vv.7–9: Supriya's prayer ("you alone are my entire possession. I belong to you").
  - v.10: "Śiva appeared out of the crevice with an excellent temple with four doors."
  - vv.12–13: Shiva gives him the **Pāśupata**; all the rakshasas are slain.
  - vv.14–16: Shiva blesses the forest.
  - vv.17–25: Dārukā praises Pārvatī; Pārvatī promises to protect her race; a quarrel; Śiva: "Do as you please"; Pārvatī: Shiva's word holds "at the end of this Yuga", and Dārukā rules the rakshasas meanwhile.
  - v.27: "I will stay in this forest with pleasure for protecting the devotees."
  - v.32: "The Jyotirliṅga form of Śiva came to be known as **Nāgeśvara**. Goddess Śivā became **Nāgeśvarī**."
  - vv.29–39: the prophecy of King **Vīrasena**, son of Mahāsena, who sails in a "fish-like canoe" to the island. Used only in a did-you-know.
- Other summaries agree (Wikipedia "Daruka"; greenmesg.org, which says Shiva "appeared from within a pit").
- **Not used**: the "Namdev made the linga turn" story, which some sites attach to Dwarka. It belongs to Aundha Nagnath, where the temple is said to have turned.

## 2. The Stotram and the rival claims

- **Dvadasha Jyotirlinga Stotram, verse 8** (traditionally attributed to Adi Shankaracharya): "Yāmye sadaṅge nagare'tiramye vibhūṣitāṅgaṁ vividhaiśca bhogaiḥ | sadbhaktimuktipradam īśam ekaṁ śrī-nāganāthaṁ śaraṇaṁ prapadye ||". Translated in the story as: "In the south, in the lovely town of Sadanga, his form adorned with many splendours, the one Lord who grants true devotion and liberation: in Shri Naganatha I take refuge." (*Bhoga* can also mean a serpent's coils; the translation keeps "splendours".)
- The short "Saurashtre Somanatham…" verse has **"Nāgeśaṁ Dārukāvane"**, the 8th name.
- The claims (Wikipedia, Nageshwar Jyotirlinga): **Dwarka** in Gujarat (this site, linked by devotees to the Purana's forest by the western sea); **Aundha Nagnath** in Hingoli, Maharashtra (whose claim draws on "yāmye", the south, and Sadanga); and **Jageshwar** in Almora, Uttarakhand. The narration names all three with equal respect and takes no side. The catalog note (`catalog.ts`) now names Aundha and Jageshwar.

## 3. The modern temple

| What | Detail | Source and confidence |
|------|--------|-----------------------|
| Rebuild | Funded by **Gulshan Kumar** (Super Cassettes Industries / T-Series), who saw the old shrine in poor repair during a pilgrimage to the 12 Jyotirlingas; begun around **1996**; completed by his family and charitable trust after his death | thedivineindia.com, thrillingtravel.in, behindeverytemple.org: secondary only, so the narration says "accounts of the temple say" |
| Gulshan Kumar | Born 5 May 1956, Delhi; his father was a fruit-juice vendor in Daryaganj; founded Super Cassettes (T-Series); ran free meals for Vaishno Devi pilgrims; killed 12 August 1997 in Mumbai | Wikipedia. The narration says only "he died in 1997". |
| Portrait | A large portrait of him is said to hang near the entrance | travel site; not narrated |
| Statue | Seated Shiva, about 25 m (sources give 80–85 ft; one says 125 ft) | Gujarat travel sites; the site model uses about 25 m. The narration says "about twenty-five metres". No year or donor for the statue was found, so none is stated. |
| Location | About 17–18 km from Dwarka, on the road to Bet Dwarka; Gopi Talav nearby | Gujarat Tourism (18 km) |
| Linga | Of "Dwarka shila" with small chakra marks, under a silver serpent; Parvati (Nageshwari) behind | travel sites and the site model; narrated as "Pilgrims are told…" |
| Sanctum | Below the hall level ("underground sanctum") | Gujarat Tourism, travel sites |

## 4. Aarti and timings (unofficial)

- Darshan about 6 AM–9 PM (some sources say 5 AM). Shringar Darshan 4:00–4:30 PM. Evening aarti about 7 PM (given as 6:45–7:45 or 7:00–7:30). Sources: yatradham, shubhpanchang, bhaktibharat. Confirm locally.
- Lyrics: "Om Jai Shiv Omkara" (public domain, the same text used for Omkareshwar). It is not documented as Nageshwar's own text.

## 5. YouTube: none added

- No official website exists to verify a channel against. Candidates found:
  - **"Nageshwar Jyotirlinga official"**, @nageshwarjyotirlingofficial, `UChehm1WKmChFGvnwhYurctg`: about 10.5K subscribers; live streams titled "Nageshwar Jyotirlinga Aarti - Dwarika GUJARAT" (for example C9SaYuauPUI, AXqSBlXdbfU, C3sVbh3slKg); no description or links.
  - **"Nageshwar Jyotirling 108"**, @nageshwarjyotirling, `UCUhNBjN65iH_SQcBEWUUgdw`: "Sandhya Shringar Aarti" uploads; it links only an Instagram account.
- A travel blog says "the Nagnath Mahadev Trust streams the evening aarti on its official YouTube channel", but names no channel. Without a trust or government link, neither channel is used. If the trust confirms one, add it as `kind: 'recorded'` (or `'live'` with its channelId).

## 6. Uncertain facts

- The Gulshan Kumar rebuild (1996, and the family completing it) comes from secondary sites only, hence "accounts say".
- The statue's height varies by source (about 25 m is used); its date and donor are unknown.
- The aarti times are unofficial.
- "Dwarka shila" for the linga is a pilgrims' tradition, narrated with "pilgrims are told".
