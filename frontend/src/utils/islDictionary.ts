// Indian Sign Language (ISL) & Hindi Translation Dictionary

export interface ISLTranslation {
  english: string;
  hindi: string;
  transliteration: string;
  category: string;
  icon: string;
  islDescription: string;
  spokenHindi: string;
}

export const ISL_TRANSLATIONS: Record<string, ISLTranslation> = {
  drink: {
    english: 'Drink',
    hindi: 'पीना (पानी)',
    transliteration: 'Peena (Paani)',
    category: 'जरूरी (Essentials)',
    icon: '🥤',
    islDescription: 'C-आकार की हथेली से कप पकड़ने जैसा इशारा कर मुँह की तरफ ले जाएँ।',
    spokenHindi: 'पानी पीना',
  },
  eat: {
    english: 'Eat',
    hindi: 'खाना',
    transliteration: 'Khaana',
    category: 'जरूरी (Essentials)',
    icon: '🍽️',
    islDescription: 'पाँचों उँगलियों के पोरों को एक साथ मिलाकर मुँह की तरफ दो बार छुएँ।',
    spokenHindi: 'खाना',
  },
  say: {
    english: 'Say / Speak',
    hindi: 'बोलना / कहना',
    transliteration: 'Bolna / Kehna',
    category: 'बातचीत (Dialogue)',
    icon: '🗣️',
    islDescription: 'तर्जनी (इंडेक्स) उँगली को ठोड़ी या मुँह के पास से आगे की ओर ले जाएँ।',
    spokenHindi: 'बोलना',
  },
  what: {
    english: 'What',
    hindi: 'क्या',
    transliteration: 'Kya',
    category: 'सवाल (Questions)',
    icon: '❓',
    islDescription: 'दोनों हथेलियों को ऊपर की ओर खुला रखकर उँगलियाँ फैलाएँ और हल्का हिलाएँ।',
    spokenHindi: 'क्या',
  },
  where: {
    english: 'Where',
    hindi: 'कहाँ',
    transliteration: 'Kahan',
    category: 'सवाल (Questions)',
    icon: '📍',
    islDescription: 'तर्जनी उँगली को ऊपर सीधा खड़ा रखकर दाएँ-बाएँ हिलाएँ।',
    spokenHindi: 'कहाँ',
  },
  why: {
    english: 'Why',
    hindi: 'क्यों',
    transliteration: 'Kyun',
    category: 'सवाल (Questions)',
    icon: '💡',
    islDescription: 'अंगूठे और कनिष्ठा (छोटी उँगली) को बाहर फैलाएँ (Y-आकार) और हिलाएँ।',
    spokenHindi: 'क्यों',
  },
  who: {
    english: 'Who',
    hindi: 'कौन',
    transliteration: 'Kaun',
    category: 'सवाल (Questions)',
    icon: '👤',
    islDescription: 'L-आकार की हथेली (अंगूठा और तर्जनी 90 डिग्री) बनाकर मुँह के पास रखें।',
    spokenHindi: 'कौन',
  },
  which: {
    english: 'Which',
    hindi: 'कौनसा / कौनसी',
    transliteration: 'Kaunsa',
    category: 'सवाल (Questions)',
    icon: '⚖️',
    islDescription: 'मुट्ठी बंद कर अँगूठे को ऊपर खड़ा रखें (A-हस्तमुद्रा) और तुलना करें।',
    spokenHindi: 'कौनसा',
  },
  okay: {
    english: 'Okay',
    hindi: 'ठीक है',
    transliteration: 'Theek Hai',
    category: 'सहमति (Responses)',
    icon: '👌',
    islDescription: 'अंगूठे और तर्जनी के सिरों को गोल जोड़ें, बाकी तीन उँगलियाँ सीधी ऊपर रखें।',
    spokenHindi: 'ठीक है',
  },
  peace: {
    english: 'Peace / Victory',
    hindi: 'शांति / जीत',
    transliteration: 'Shanti / Jeet',
    category: 'बातचीत (Conversational)',
    icon: '✌️',
    islDescription: 'तर्जनी और मध्यमा उँगलियों से स्पष्ट V का आकार बनाएँ।',
    spokenHindi: 'शांति',
  },
  'i love you': {
    english: 'I Love You',
    hindi: 'प्यार',
    transliteration: 'Pyar',
    category: 'भावना (Emotions)',
    icon: '🤟',
    islDescription: 'अंगूठा, तर्जनी और छोटी उँगली बाहर रखें, बीच की दो उँगलियाँ मोड़ें।',
    spokenHindi: 'प्यार',
  },
  hello: {
    english: 'Hello / Namaste',
    hindi: 'नमस्ते / प्रणाम',
    transliteration: 'Namaste',
    category: 'अभिवादन (Greetings)',
    icon: '🙏',
    islDescription: 'खुली सीधी हथेली से अभिवादन करें या सीने के पास दोनों हाथ जोड़ें।',
    spokenHindi: 'नमस्ते',
  },
  'thank you': {
    english: 'Thank You',
    hindi: 'धन्यवाद / शुक्रिया',
    transliteration: 'Dhanyawad / Shukriya',
    category: 'अभिवादन (Greetings)',
    icon: '🙏',
    islDescription: 'सपाट हथेली को ठोड़ी से आगे की ओर ले जाकर आभार व्यक्त करें।',
    spokenHindi: 'धन्यवाद',
  },
  yes: {
    english: 'Yes',
    hindi: 'हाँ',
    transliteration: 'Haan',
    category: 'सहमति (Responses)',
    icon: '👍',
    islDescription: 'अंगूठा ऊपर की ओर सीधा खड़ा करें (Thumbs Up) या मुट्ठी हिलाएँ।',
    spokenHindi: 'हाँ',
  },
  no: {
    english: 'No',
    hindi: 'नहीं',
    transliteration: 'Nahi',
    category: 'असहमति (Responses)',
    icon: '👎',
    islDescription: 'तर्जनी और मध्यमा को अंगूठे पर बंद करें या हाथ से मना करें।',
    spokenHindi: 'नहीं',
  },
  help: {
    english: 'Help',
    hindi: 'मदद',
    transliteration: 'Madad',
    category: 'आपातकालीन (Emergency)',
    icon: '🆘',
    islDescription: 'सपाट खुली हथेली के ऊपर दूसरे हाथ की मुट्ठी रखकर ऊपर उठाएँ।',
    spokenHindi: 'मदद',
  },
  point: {
    english: 'Point / One',
    hindi: 'इशारा / एक',
    transliteration: 'Ishara / Ek',
    category: 'संख्या (Numbers)',
    icon: '☝️',
    islDescription: 'तर्जनी उँगली सीधी ऊपर रखें, बाकी उँगलियाँ बंद रखें।',
    spokenHindi: 'एक',
  },
  fist: {
    english: 'Fist',
    hindi: 'मुट्ठी',
    transliteration: 'Mutthi',
    category: 'मुद्रा (Postures)',
    icon: '✊',
    islDescription: 'पाँचों उँगलियों को हथेली में कसकर बंद रखें।',
    spokenHindi: 'मुट्ठी',
  },
};

export function getISLTranslation(signKey: string | null | undefined): ISLTranslation | null {
  if (!signKey) return null;
  const normalized = signKey.toLowerCase().trim();
  return ISL_TRANSLATIONS[normalized] || null;
}
