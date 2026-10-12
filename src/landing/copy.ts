/**
 * Every visible word on the landing page, in one place (placeholder English — final wording to come).
 * Temple names and places come from src/temples/stories/catalog.ts; only their one-liners live here.
 */
export const copy = {
  pageTitle: 'The Twelve Jyotirlingas',
  eyebrow: 'Where light has no end',
  /** the hub's title, in gold: the Devanagari line shows when titleDevanagari is on (default on, for this title only) */
  title: '12 Jyotirlinga',
  titleHi: '१२ ज्योतिर्लिंग',
  /** the hub's visible heading (Cinzel capitals, widely spaced, in gold), the Devanagari name beneath */
  mark: 'The Twelve Jyotirlingas',
  markHi: '१२ ज्योतिर्लिंग',
  titleDevanagari: true,
  /** the word on each medallion's ring */
  jyotirlinga: 'Jyotirlinga',
  subtitle: 'Twelve flames across Bharat. Choose one to begin.',

  /** the journey "Through the Third Eye": one label and one line per chapter */
  chapters: [
    { label: 'Shiva', line: 'Before time, there was only this light.' },
    { label: 'The Third Eye', line: '…turns the eye within…' },
    { label: 'The Universe', line: '…and sees the universe inside it.' },
    { label: 'Earth', line: 'In it, a small blue world.' },
    { label: 'Bharat', line: 'On it, a land of rivers and light.' },
    { label: 'The Twelve', line: 'Twelve places where the light touched the earth.' },
  ] as { label: string; line: string }[],
  scrollHint: 'Scroll down',
  /** the hub: India is taller than the screen */
  scrollMap: 'Scroll through Bharat',

  skip: 'Skip',
  /** the opening screen: its click is the gesture browsers need before any sound may play */
  gateEnter: 'Om Namah Shivaya',
  soundOn: 'Sound on',
  soundOff: 'Sound off',
  // the sound button's hover credit, for a recording whose licence asks for one (none: the drums are synthesized)
  soundCredit: '',
  /** the twelve, as a list (keyboard / mobile alternative to the map) */
  listTitle: 'The Twelve',
  listOpen: 'All twelve',
  listClose: 'Close',
  close: 'Close',
  enter: 'Enter',
  /** the footer's About / Contribute panels and the repository */
  repo: 'https://github.com/Purva-Chaudhari/jyotirlingas',
  aboutLink: 'About',
  contributeLink: 'Contribute',
  githubLink: 'GitHub',
  /** the About section below the India map: why Divya Yatra exists */
  about: {
    title: 'About',
    paras: [
      'India’s temples are more than stone and spire. Each one carries centuries of devotion: the rituals at dawn, the songs of the aarti, the festivals that fill its lanes, and the stories passed from grandparents to grandchildren. They have always been mesmerising.',
      'The twelve Jyotirlingas, where Shiva is said to have revealed himself as an endless pillar of light, are among the most sacred of them all. This site is an invitation to know them: explore the mandirs in the metaverse, walk their courtyards, learn the story behind each one, and understand the traditions that keep them alive.',
      'Whether you have visited a hundred times, are planning your first yatra, or are discovering Sanatana Dharma for the first time, you are welcome here. It is free and open to all. Mahakaleshwar in Ujjain is open now; the other eleven are on their way.',
    ],
    blessing: 'ॐ नमः शिवाय',
    help: 'Help it grow',
  },
  contribute: {
    title: 'Contribute',
    intro: 'This site is open source and grows with the people who care about these places. Three ways to help:',
    ways: [
      { head: 'Code', text: 'Fix a bug, improve a temple, build a feature. The whole site is on GitHub, so open an issue or send a pull request.' },
      { head: 'Stories', text: 'Know a legend, a local tradition, or a better source for one? Each temple’s stories live in the repository with their sources; suggest one in an issue.' },
      { head: 'Pictures', text: 'Your own photos of the temples help make each place truer. Share them in an issue, with permission to publish them under an open licence.' },
    ],
    cta: 'Open an issue on GitHub',
  },
  /** shown on a temple that cannot be entered yet */
  soon: 'Coming this week',
  visited: 'Visited',
  notVisited: 'Not yet visited',
  storiesHeard: (n: number) => (n === 1 ? '1 story heard' : `${n} stories heard`),
  stotramOrder: 'In the Stotram',

  /** show each temple's Devanagari name next to the English one */
  showDevanagari: false,

  /**
   * small credit for the landing music, shown only while the recorded theme
   * (public/audio/landing/theme.mp3|m4a) is what plays; empty → hidden
   */
  musicCredit: '',

  /**
   * Thoughts that surface on the map one at a time (~8 s each). Translations are our own renderings of
   * public-domain Sanskrit; the rest are short original contemplations.
   */
  thoughts: [
    { text: 'Consciousness is the Self.', source: 'after the Shiva Sutras, 1.1' },
    { text: 'The sudden upsurge of awareness: that is Bhairava.', source: 'after the Shiva Sutras, 1.5' },
    { text: 'The Self is the dancer. The inner self is the stage.', source: 'after the Shiva Sutras, 3.9–10' },
    { text: 'Formless as freedom itself, all-pervading, the very form of the Veda.', source: 'after the Rudrashtakam' },
    { text: 'Beyond qualities, beyond thought, beyond desire: I bow to the one who wears the sky.', source: 'after the Rudrashtakam' },
    { text: 'From the forest of his locks the Ganga falls, and washes his throat.', source: 'after the Shiva Tandava Stotram' },
    { text: 'Garlanded with the king of serpents, three-eyed, dusted with ash.', source: 'after the Shiva Panchakshara Stotram' },
    { text: 'Brahma flew up, Vishnu dove down. The light had no end, and no beginning.', source: 'on the Lingodbhava' },
    { text: 'Stillness is not the absence of movement. It is its source.', source: 'a contemplation' },
    { text: 'Mahakal: the time that swallows time.', source: 'a contemplation' },
    { text: 'What he destroys, he makes room for.', source: 'a contemplation' },
    { text: 'Na · ma · śi · vā · ya: five syllables, one stillness.', source: 'on the Panchakshara' },
  ] as { text: string; source: string }[],

  /** each temple's own thought, shown while it is hovered or chosen */
  templeThoughts: {
    somnath: 'Broken and rebuilt, again and again: the light at the edge of the sea returns.',
    mallikarjuna: 'Jasmine and the white arjuna: Parvati and Shiva, side by side on one hill.',
    mahakaleshwar: 'The Lord of Time, to whom time itself bows.',
    omkareshwar: 'The river writes Om around an island; he listens.',
    vaidyanath: 'The physician of all beings, where pain is offered and set down.',
    bhimashankar: 'In the forest the Bhima rises, they say, from his sweat after battle.',
    rameshwaram: 'Before the bridge, Rama shaped a linga of sand and bowed.',
    nageshwar: 'Lord of the serpents, who answers those who call from the forest.',
    'kashi-vishwanath': 'In Kashi, it is said, he whispers the word that sets one free.',
    trimbakeshwar: 'Three faces in one linga, where the Godavari begins.',
    kedarnath: 'The mountain does not move. Neither does he.',
    grishneshwar: "For Ghushma's devotion he returned what was lost: the twelfth light.",
  } as Record<string, string>,

  /** one line per temple, by site id */
  lines: {
    somnath: 'On the shore of the western sea, the first of the twelve.',
    mallikarjuna: 'On the Srisailam hill above the Krishna.',
    mahakaleshwar: 'The Lord of Time, in the ancient city of Ujjain.',
    omkareshwar: 'On an Om-shaped island in the Narmada.',
    vaidyanath: 'The healer, worshipped at Deoghar.',
    bhimashankar: 'In the forests of the Sahyadri, where the Bhima rises.',
    rameshwaram: 'On an island at the southern sea, worshipped by Rama.',
    nageshwar: 'Lord of the serpents, near Dwarka.',
    'kashi-vishwanath': 'On the ghats of the Ganga at Varanasi.',
    trimbakeshwar: 'Below Brahmagiri, near the source of the Godavari.',
    kedarnath: 'High in the Garhwal Himalaya, at the head of the Mandakini.',
    grishneshwar: 'Beside the caves of Ellora, the twelfth.',
  } as Record<string, string>,
};
