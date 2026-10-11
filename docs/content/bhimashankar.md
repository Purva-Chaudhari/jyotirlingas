# Bhimashankar (Bhorgiri, Khed taluka, Pune district, Maharashtra): research notes

Story data: `src/temples/stories/bhimashankar.json`. Researched 2026-10-07.

Primary source: the **Shree Kshetra Bhimashankar Trust** site, https://shreebhimashankar.com (pages: en/ home, about-temple, bhimashankar-temple-history, temple-schedule, places-around-bhimashankar, trustee; Hindi and Marathi versions). The English pages are machine-translated and garbled in places; facts were taken only where the meaning is clear.

**Stotram numbering.** In the short hymn the app uses for its order ("Saurashtre Somanatham cha … Paralyam Vaidyanatham cha **Dakinyam Bhimashankaram**"), Bhimashankar is **sixth**. In the longer Dvadasha Jyotirlinga Stotram the Bhima verse ("यं डाकिनिशाकिनिकासमाजे …") is printed as **verse 10** by sanskritdocuments.org (the long stotram has a different order). The narration quotes the long verse without numbering it, then says "The shorter hymn of the twelve names him sixth" and "Bhimashankar is the sixth Jyotirlinga of the Stotram."

**Location dispute.** The Shiva Purana sets the king Sudakshina in Kamarupa, and the Assam government (Feb 2023) claimed the Jyotirlinga for the Bhimashankar temple at Pamohi near Guwahati, reading "Dakinyam" as the Dakini hills; Maharashtra objected (Outlook, Sentinel Assam, EastMojo, 2023). The Purana also says Bhima lived on the **Sahya** mountain. The narration mentions the Assam claim neutrally once (stop 3). No `note` was added in `catalog.ts`: this is a recent claim, not an established yatra tradition like Parli or Aundha.

## Stop map (walking order from the spawn at the head of the stairway)

| # | id | at (zone / anchor) | kind | Topic |
|---|----|--------------------|------|-------|
| 1 | bhima-village | village (spawn) | history | Sahyadri crest; Wildlife Sanctuary (1985, ~131 km²), shekru; fireflies; the Bhima's source in the hollow |
| 2 | bhima-stairs | stairs | legend | Bhima, son of Kumbhakarna; penance, Brahma's boon; King Sudakshina imprisoned, worships an earthen linga |
| 3 | bhima-mokshakund | mokshakund (behind the temple) | legend | Shiva rises from the clay linga ("I am Bhimeshvara"), "Hum", ash becomes herbs; Assam claim |
| 4 | bhima-kusharanya | kusharanya | legend | Trust tradition: Tripurasura, Kamalaja, Ardhanarishvara on Kartik Purnima; sweat becomes the Bhima; Dakini and Shakini |
| 5 | bhima-bell | bell | history | Chimaji Appa's Vasai bell (cast 1729, brought after 1739); 13th-c. mention; Shivaji's endowment; Nana Phadnavis |
| 6 | bhima-mandapa | mandapa | ritual | New sabhamandapa (closed 9 Jan – 15 Jun 2026); five steps down; Ganesha and Kalabhairava; daily times; festival maha-aarti and palkhi |
| 7 | bhima-garbhagriha | garbhagriha | ritual | Darshan: the cleft linga; Stotram verse; yatra line; aarti cue |

Anchors (site metres, +z east, +x north, origin = courtyard floor at the temple's centre; `layout.ts`): village [126, 29.7, -21.75] (STAIR_TOP_X = 111.4, STAIR_TOP_Y = 29.7), stairs [103.8, 27.72, -21.75] (first landing: flight 13, y = 14 × 1.98), mokshakund [-3.5, 0, -19.5] (rim; MOKSHA x −12.5…−4.5), kusharanya [-10, 0, -9.2] (beside the kerb; KUSHA at −12.3, −6.5), bell [-6.6, 0, 15] (BELL at −8.4, 16.5), mandapa [0, 0.6, 7], garbhagriha [0, −0.3, −6.6] (the antarala at the foot of the steps; AZ0 = −7.05). DARSHAN at [0, −0.3, −6.6] r 2. Walk-tested route: stairs along z −21.75 → (8, −21.5) → (−3.5, −19.5) → (−3, −14) → (−10.3, −14) → (−10, −9.2) → (−10, 12) → bell (−6.6, 15) → (−5, 12.4) → (−2.2, 13.4) → (0, 13.4) → up the east steps → round the Nandi (0.8, 5) → (0, −3.5) → down to (0, −6.4), source = the linga (bx −0.32, cz −8.75 in `sanctum.ts`).

## 1. Legends

### Shiva Purana, Kotirudra Samhita ch. 20–21
- Ch. 20: https://www.wisdomlib.org/hinduism/book/shiva-purana-english/d/doc226521.html
  - vv. 4–6: Bhima, born of the ogress Karkati and **Kumbhakarna**, lives on the **Sahya mountain** after his father's death at Rama's hands.
  - vv. 7–18: he asks his mother about his father; she tells him.
  - vv. 19–24: he resolves to harass Vishnu; penance for a thousand years, on one foot with arms lifted.
  - vv. 25–31: Brahma grants unequalled strength.
  - vv. 32–39: he conquers the gods and **King Sudakshina of Kamarupa**, imprisons him.
  - vv. 40–47: the king makes an earthen Shiva image and worships with his wife **Dakshina**.
- Ch. 21: https://www.wisdomlib.org/hinduism/book/shiva-purana-english/d/doc226522.html
  - vv. 23–31: Bhima strikes the earthen idol with his sword.
  - vv. 32–34: Shiva emerges: "See, I am Bhīmeśvara. I have revealed myself to protect my devotee." He splits the sword.
  - vv. 35–43: battle; Narada pleads; Shiva burns Bhima to ash with "Hum".
  - vv. 44–50: the ash spreads through the forest, producing herbs.
  - vv. 51–54: the gods ask him to stay; he is worshipped as Bhimashankara.
- Names kept to Bhima, Kumbhakarna, Rama, Sudakshina (the mother and the queen are unnamed in the narration).

### Trust tradition: Tripurasura (shreebhimashankar.com home and history pages)
- Tripurasura does penance in the Bhimashankar forest (Tretayuga) and is granted near-immortality on condition he works for people's welfare; he breaks it.
- Shiva asks Parvati (**Kamalaja Mata**, worshipped with lotus flowers; about page: "Kamalaja was worshiped by Brahma with offerings of lotus flowers") to help; together as **Ardhanarinateshwara** they kill Tripurasura on **Kartik Purnima** ("Tripurari Purnima").
- "The Bhima river originated from where the sweat streams were coming from the body of God as they were sitting for rest." (home page). The about page has another version: the name comes from the Bhima river "which evaporated due to the war". Wikipedia: "the sweat that spilled from his body after the battle is said to have formed the Bhimarathi river."
- **Dakini and Shakini**: history page: Tripurasura's **wives**, given immortality by Shiva; home page: Shiva promises their names come before his ("Dakinyam Bhimashankaram"); about page: "deities who helped Shiva". The narration follows the history page (wives) and the home page (the name).
- Kusharanya Tirtha: "where the Bhima river starts flowing towards the east" (about page). Mokshakund: "associated with sage Kaushik".

## 2. History

| Date | Event | Source |
|------|-------|--------|
| 13th c. | "Bhimashankaram shrine and the Bhimarathi river have been talked about in writings as far back as the 13th century" | Wikipedia "Bhimashankar Temple" |
| 17th c. | Chhatrapati Shivaji Maharaj "is said to have donated this temple to facilitate worship services"; Shivaji and Rajaram visited | trust about page; Wikipedia |
| 1729 | The bell is cast (date on the bell, with a cross and an image of Mary with Jesus) | Wikipedia; gulfnews / morungexpress (PTI) "Portuguese-era church bells adorn Maharashtra temples" |
| 1739 | Chimaji Appa, brother of Bajirao I, takes Vasai fort from the Portuguese and gives the bell | Wikipedia; trust about page ("five big bells from the Vasai Fort … offered one here"; weight 5 maunds; the trust says "1721 AD is inscribed" — **conflict** with 1729 elsewhere; the site model's label says 1729) |
| 18th c. | Nana Phadnavis builds the sabhamandapa and the shikhara | Wikipedia; trust about page |
| 1985 | Bhimashankar Wildlife Sanctuary notified (10 Oct 1985), 130.78 km², to protect the Indian giant squirrel (shekru, *Ratufa indica elphinstonii*), the state animal | Wikipedia "Bhimashankar Wildlife Sanctuary"; JoTT 2017 |
| 9 Jan – 15 Jun 2026 | Temple closed while a new sabhamandapa ("assembly hall") is built; reopened 15 June with mandatory online passes, a daily limit | punekarnews.in |

- Not used: "This temple was restored in 1212" and "In 1437 AD, a Durbar Hall was built by a Pune businessman … Chimanjiantajinayakbhinde" (trust home/about pages; garbled, unverified). "Built in the 13th century" (trust) is stated only as "mentioned … as early as the thirteenth century".
- Architecture (trust): sanctum below the hall, five steps down; Ganesha on the left, Kalabhairava on the right of the door; a Parvati image faces the linga; the swayambhu linga has "a vertical hole … two parts", Shiva and Shakti. Narration says the hall is new without claiming its material (the news does not say).

## 3. Rituals and living culture (trust temple-schedule page)
- 05:00 temple opens; 05:00–05:30 worship; 05:30–12:00 darshan and abhishek; 12:00–12:20 naivedya; 12:20–14:45 darshan; 14:45–15:20 worship; 15:20–19:30 darshan; **19:30–20:00 worship**; 20:00–21:30 darshan; 21:30 closes.
- Festivals with Mahaposhak, **Maha-aarti (7:30 PM)** and the Lord's palanquin: Gudhi Padwa, Akshaya Tritiya, Dussehra (palkhi 4:30 PM), Diwali days, **Tripurari Purnima** (Mahaarti 8 PM; Kamalaja palkhi 9:30 PM; Bhimashankar palkhi after 10 PM via Kokan Kada to Kamalaja), Makar Sankranti, **Mahashivratri** (Mahaarti 7:30 PM, palkhi 10 PM), Holi.
- Do's: silence inside, chant "Om Namah Shivaya" (used in a "did you know").
- Places (trust): Gupt Bhimashankar (2 km; a small waterfall of the Bhima on a Shivalinga), Kokan Kada / Nagphani (~3,000 ft over the Konkan), Hanuman Lake, Bhima river source "50 metres from the stairs", Kamalaja Devi temple, Sakshi Vinayak.
- Fireflies before the monsoon (trust about page).

## 4. Aarti
- **Lyrics in the JSON**: "Lavathavati Vikrala", Samarth Ramdas's Marathi Shiva aarti (17th c., public domain), text from tring.co.in (matches common printings). Marked as the region's common Shiva aarti, **not** documented as Bhimashankar's own.
- **YouTube: none set.** The trust site links no YouTube channel (only Facebook SDK; its homepage background video `o0Y4WNFzjRo` is "Bhimashankar Wildlife Sanctuary Documentary" by AVF World, not an aarti). YouTube searches found only private vloggers and music labels ("Shree Kshetra Bhimashankar Ayurved" is an unrelated clinic). Without an official source, `aarti.youtube` is left empty and the synthesized ambience plays.

### Audio licensing
No freely licensed recording found. Trust contact: office@shreebhimashankar.com, 02135 222880.

## 5. Open questions
- The bell's date (1729 on the bell per Wikipedia/PTI; the trust says 1721).
- Whether the new 2026 sabhamandapa is of stone (the site model's label says so; the news only says "new assembly hall").
- What is sung at the 7:30 PM worship.
- Dakini and Shakini: the demon's wives (trust history page) or deities who helped Shiva (trust about page).
