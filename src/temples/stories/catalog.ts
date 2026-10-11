import type { Bi } from './types';

/**
 * The twelve Jyotirlingas in the order of the Dvadasha Jyotirlinga Stotram
 * ("Saurashtre Somanatham cha, Shrishaile Mallikarjunam..."), with the site ids used by ?temple=.
 * `note` carries the yatra tradition for that temple (shown in the progress panel); the order is a guide,
 * not a lock: pilgrims usually travel region by region between the first and the last.
 */
export const JYOTIRLINGAS: { id: string; name: Bi; place: string; note?: Bi }[] = [
  {
    id: 'somnath', name: { en: 'Somnath', hi: 'सोमनाथ' }, place: 'Prabhas Patan, Gujarat',
    note: { en: 'The first Jyotirlinga: traditionally the yatra begins here', hi: 'प्रथम ज्योतिर्लिंग: परंपरा से यात्रा यहीं से आरंभ होती है' },
  },
  { id: 'mallikarjuna', name: { en: 'Mallikarjuna', hi: 'मल्लिकार्जुन' }, place: 'Srisailam, Andhra Pradesh' },
  { id: 'mahakaleshwar', name: { en: 'Mahakaleshwar', hi: 'महाकालेश्वर' }, place: 'Ujjain, Madhya Pradesh' },
  {
    id: 'omkareshwar', name: { en: 'Omkareshwar', hi: 'ओंकारेश्वर' }, place: 'Mandhata, Madhya Pradesh',
    note: { en: '"Omkaram Amaleshwaram": darshan of Mamleshwar across the Narmada completes it', hi: '"ओंकारम् अमलेश्वरम्": नर्मदा पार ममलेश्वर के दर्शन से यह दर्शन पूर्ण होता है' },
  },
  {
    id: 'vaidyanath', name: { en: 'Vaidyanath', hi: 'वैद्यनाथ' }, place: 'Deoghar, Jharkhand',
    note: { en: 'The Stotram\'s "Paralyam Vaidyanatham": Parli Vaijnath (Maharashtra) is also revered as this Jyotirlinga', hi: 'स्तोत्र का "परल्यां वैद्यनाथम्": परली वैजनाथ (महाराष्ट्र) को भी यही ज्योतिर्लिंग माना जाता है' },
  },
  { id: 'bhimashankar', name: { en: 'Bhimashankar', hi: 'भीमाशंकर' }, place: 'Sahyadri, Maharashtra' },
  {
    id: 'rameshwaram', name: { en: 'Rameshwaram', hi: 'रामेश्वरम्' }, place: 'Rameswaram, Tamil Nadu',
    note: { en: 'Kashi–Rameshwaram yatra: sand from Agni Theertham goes to the Ganga; Ganga jal returns for Ramanathaswamy\'s abhishekam', hi: 'काशी–रामेश्वरम यात्रा: अग्नितीर्थ की रेत गंगा में, और गंगाजल से रामनाथस्वामी का अभिषेक' },
  },
  {
    id: 'nageshwar', name: { en: 'Nageshwar', hi: 'नागेश्वर' }, place: 'Dwarka, Gujarat',
    note: { en: '"Nagesham Darukavane": Aundha Nagnath (Maharashtra) and Jageshwar (Uttarakhand) are also revered as this Jyotirlinga', hi: '"नागेशं दारुकावने": औंढा नागनाथ (महाराष्ट्र) और जागेश्वर (उत्तराखंड) को भी यही ज्योतिर्लिंग माना जाता है' },
  },
  {
    id: 'kashi-vishwanath', name: { en: 'Kashi Vishwanath', hi: 'काशी विश्वनाथ' }, place: 'Varanasi, Uttar Pradesh',
    note: { en: 'Linked with Rameshwaram: Ganga jal carried from here completes that yatra', hi: 'रामेश्वरम से जुड़ी: यहाँ से ले गया गंगाजल वह यात्रा पूर्ण करता है' },
  },
  { id: 'trimbakeshwar', name: { en: 'Trimbakeshwar', hi: 'त्र्यंबकेश्वर' }, place: 'Nashik, Maharashtra' },
  { id: 'kedarnath', name: { en: 'Kedarnath', hi: 'केदारनाथ' }, place: 'Garhwal Himalaya, Uttarakhand' },
  {
    id: 'grishneshwar', name: { en: 'Grishneshwar', hi: 'घृष्णेश्वर' }, place: 'Ellora, Maharashtra',
    note: { en: 'The twelfth and last: the yatra is held incomplete without this darshan', hi: 'बारहवाँ और अंतिम: मान्यता है कि इसके दर्शन बिना यात्रा अधूरी है' },
  },
];

/** The next Jyotirlinga on the yatra (first not yet visited, in Stotram order), or null when all twelve are done. */
export function nextOnYatra(visited: (id: string) => boolean) {
  return JYOTIRLINGAS.find((j) => !visited(j.id)) ?? null;
}
