/**
 * The temples that can be entered for now. Each opens at its own address, /<id> (e.g. /mahakaleshwar); the
 * others are "coming soon" on the landing page and their addresses lead back there. Dev tools can still open
 * any temple with ?temple=<id>&preview=1.
 */
export const OPEN_TEMPLES: ReadonlySet<string> = new Set(['mahakaleshwar', 'kedarnath', 'somnath']);

/** every temple's address (/<id>): the open ones enter, the rest lead back to the landing page */
export const ALL_TEMPLES: readonly string[] = [
  'somnath', 'mallikarjuna', 'mahakaleshwar', 'omkareshwar', 'vaidyanath', 'bhimashankar',
  'rameshwaram', 'nageshwar', 'kashi-vishwanath', 'trimbakeshwar', 'kedarnath', 'grishneshwar',
];

const scan = (...ids: string[]) => ids.flatMap((id) => ['diff', 'nor', 'arm'].map((s) => `assets/tex/${id}_${s}.webp`));

/**
 * The heavy files each open temple downloads (sky, trees, scanned stone), largest first: fetched into the
 * browser cache ahead of time (on the landing page, and the moment the temple page opens) so entering is quick.
 */
export const TEMPLE_FILES: Readonly<Record<string, readonly string[]>> = {
  mahakaleshwar: [
    'assets/models/neem.glb',
    'assets/hdri/qwantani_sunset_puresky.hdr',
    'assets/models/neem_lod.glb',
    ...scan('large_sandstone_blocks_01', 'sandstone_blocks_08', 'red_sandstone_pavement', 'asphalt_02', 'dirty_concrete',
      'stone_wall_04', 'pavement_01', 'painted_plaster_wall', 'bark_brown_02', 'marble_01'),
    'data/osm/mahakaleshwar.json',
  ],
  kedarnath: [
    'assets/hdri/kloofendal_48d_partly_cloudy_puresky_2k.hdr',
    'assets/models/shankaracharya.glb',
    ...scan('large_grey_tiles', 'aerial_rocks_02'),
    'assets/tex/rocky_terrain_02_diff.webp', 'assets/tex/gray_rocks_diff.webp', 'assets/tex/aerial_rocks_02_diff.webp',
    'assets/tex/snow_02_diff.webp',
  ],
  somnath: [
    'assets/hdri/syferfontein_18d_clear_puresky.hdr',
    'assets/models/digvijay_dwar.glb', 'assets/models/somnath_torana.glb', 'assets/models/somnath_deity.glb', 'assets/models/sardar_patel.glb',
    ...scan('sandstone_blocks_08', 'rectangular_paving'),
  ],
};

/** What the temple page shows while a temple loads: its name, its place, and a few facts (from its stories) in turn. */
export const TEMPLE_INTRO: Readonly<Record<string, { hi: string; en: string; place: string; facts: readonly string[] }>> = {
  mahakaleshwar: {
    hi: 'श्री महाकालेश्वर',
    en: 'Mahakaleshwar Jyotirlinga',
    place: 'Ujjain · on the banks of the Kshipra',
    facts: [
      'Mahakaleshwar is one of the twelve Jyotirlingas, and the only one that faces south: Dakshinamukhi.',
      'Ujjain, on the river Kshipra, is ancient Avantika, one of India’s seven sacred cities.',
      'To Ujjain, Mahakal is not only God. He is its king, the true ruler of the city.',
      'Every day before dawn, Mahakal is worshipped with sacred ash in the Bhasma Aarti.',
      'Some 1,500 years ago, Kalidasa’s Meghaduta asked a rain-cloud to wait at Mahakala and be the drum at Shiva’s evening worship.',
      'The Nagchandreshwar shrine, on the temple’s top storey, opens only once a year, on Nag Panchami.',
      'Every twelve years Ujjain hosts the Simhastha Kumbh on the Kshipra; the next is due in 2028.',
      'Shri Mahakal Lok, the corridor of carved pillars and Shiva Purana murals beside the temple, opened in October 2022.',
    ],
  },
  kedarnath: {
    hi: 'श्री केदारनाथ',
    en: 'Kedarnath Jyotirlinga',
    place: 'Garhwal Himalaya · at the head of the Mandakini valley',
    facts: [
      'At about 3,583 metres, Kedarnath is the highest of the twelve Jyotirlingas.',
      'The last 16 km to the temple, from Gaurikund, are walked on foot, or by pony, palki or helicopter.',
      'The Lord here is no carved linga but a broad rock like a bull’s hump: the Pandavas’ story says Shiva sank into the earth here as a bull.',
      'The temple is open only half the year. On Bhai Dooj the doors close, and Baba Kedar is carried down to Ukhimath for the winter.',
      'The temple is built of great grey stone slabs on a raised platform; tradition credits Adi Shankaracharya with building it in the 8th century.',
      'In the June 2013 flood a huge boulder, now worshipped as Bhim Shila, came to rest behind the temple, and the torrent passed it by.',
      'Behind the temple, Adi Shankaracharya’s 12-foot statue sits in a sunken court; it was unveiled in November 2021.',
      'Kedarnath is one of the Char Dham of Uttarakhand, and one of the Panch Kedar.',
    ],
  },
  somnath: {
    hi: 'श्री सोमनाथ',
    en: 'Somnath Jyotirlinga',
    place: 'Prabhas Patan, Gujarat · on the shore of the Arabian Sea',
    facts: [
      'Somnath is honoured as the first of the twelve Jyotirlingas.',
      'Soma, the Moon, was freed from Daksha’s curse by worshipping Shiva here: so the Lord is Somnath, Lord of the Moon.',
      'In January 1026 Mahmud of Ghazni raided the temple; over the centuries it was destroyed and raised again many times.',
      'In 1782–83 Ahilyabai Holkar built a temple close by, so that worship here could go on.',
      'On Diwali, 12 November 1947, Sardar Patel stood among the ruins and resolved that Somnath would rise again.',
      'The new temple was consecrated on 11 May 1951, in the presence of President Rajendra Prasad.',
      'Its 150-foot shikhara carries a 10-tonne kalash and a 27-foot flagpole.',
      'The Baan Stambh on the sea wall says that from this shore to the South Pole, no land breaks the path over the sea.',
    ],
  },
};
