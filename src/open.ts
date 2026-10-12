/**
 * The temples that can be entered for now. Each opens at its own address, /<id> (e.g. /mahakaleshwar); the
 * others are "coming soon" on the landing page and their addresses lead back there. Dev tools can still open
 * any temple with ?temple=<id>&preview=1.
 */
export const OPEN_TEMPLES: ReadonlySet<string> = new Set(['mahakaleshwar']);

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
};
