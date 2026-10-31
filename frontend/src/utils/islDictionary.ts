// Indian Sign Language (ISL) & Hindi Translation Dictionary

export interface ISLTranslation {
  english: string;
  hindi: string;
  transliteration: string;
  spokenPhonetic: string;
  category: string;
  icon: string;
  islDescription: string;
  spokenHindi: string;
}

export const ISL_TRANSLATIONS: Record<string, ISLTranslation> = {
  hello: {
    english: 'Hello',
    hindi: 'नमस्ते',
    transliteration: 'Namaste',
    spokenPhonetic: 'Namaste',
    spokenHindi: 'नमस्ते',
    category: 'Greetings',
    icon: '🙏',
    islDescription: 'Join both palms in traditional greeting at chest level or wave open hand.',
  },
  eat: {
    english: 'Eat',
    hindi: 'खाना',
    transliteration: 'Khaana',
    spokenPhonetic: 'Khaana',
    spokenHindi: 'खाना',
    category: 'Daily Needs',
    icon: '🍽️',
    islDescription: 'Bring all five fingertips together and tap lightly toward mouth twice.',
  },
  drink: {
    english: 'Drink',
    hindi: 'पीना (पानी)',
    transliteration: 'Paani',
    spokenPhonetic: 'Paani',
    spokenHindi: 'पानी पीना',
    category: 'Daily Needs',
    icon: '🥤',
    islDescription: 'Form a C-shape with palm mimicking a cup and tip it toward mouth.',
  },
  say: {
    english: 'Say / Speak',
    hindi: 'बोलना',
    transliteration: 'Bolna',
    spokenPhonetic: 'Bolna',
    spokenHindi: 'बोलना',
    category: 'Dialogue',
    icon: '🗣️',
    islDescription: 'Point index finger forward from near the chin or mouth outward.',
  },
  what: {
    english: 'What',
    hindi: 'क्या',
    transliteration: 'Kya',
    spokenPhonetic: 'Kya',
    spokenHindi: 'क्या',
    category: 'Questions',
    icon: '❓',
    islDescription: 'Hold open palms facing upward and gently shake outward.',
  },
  where: {
    english: 'Where',
    hindi: 'कहाँ',
    transliteration: 'Kahaan',
    spokenPhonetic: 'Kahaan',
    spokenHindi: 'कहाँ',
    category: 'Questions',
    icon: '📍',
    islDescription: 'Hold index finger pointing upward and sway side-to-side.',
  },
  why: {
    english: 'Why',
    hindi: 'क्यों',
    transliteration: 'Kyun',
    spokenPhonetic: 'Kyun',
    spokenHindi: 'क्यों',
    category: 'Questions',
    icon: '💡',
    islDescription: 'Extend thumb and pinky in Y-shape and wiggle near chest.',
  },
  who: {
    english: 'Who',
    hindi: 'कौन',
    transliteration: 'Kaun',
    spokenPhonetic: 'Kaun',
    spokenHindi: 'कौन',
    category: 'Questions',
    icon: '👤',
    islDescription: 'Form an L-shape (thumb and index finger at 90°) circling near mouth.',
  },
  which: {
    english: 'Which',
    hindi: 'कौनसा',
    transliteration: 'Kaunsa',
    spokenPhonetic: 'Kaunsa',
    spokenHindi: 'कौनसा',
    category: 'Questions',
    icon: '⚖️',
    islDescription: 'Closed fists with thumbs up alternating up and down in comparison.',
  },
  okay: {
    english: 'Okay',
    hindi: 'ठीक है',
    transliteration: 'Theek Hai',
    spokenPhonetic: 'Theek Hai',
    spokenHindi: 'ठीक है',
    category: 'Responses',
    icon: '👌',
    islDescription: 'Join tips of thumb and index finger into an O-circle, other fingers extended.',
  },
  peace: {
    english: 'Peace / Victory',
    hindi: 'शांति',
    transliteration: 'Shanti',
    spokenPhonetic: 'Shanti',
    spokenHindi: 'शांति',
    category: 'Expressions',
    icon: '✌️',
    islDescription: 'Extend index and middle fingers in a clear V-shape.',
  },
  'i love you': {
    english: 'I Love You',
    hindi: 'प्यार',
    transliteration: 'Pyaar',
    spokenPhonetic: 'Pyaar',
    spokenHindi: 'प्यार',
    category: 'Emotions',
    icon: '🤟',
    islDescription: 'Extend thumb, index, and pinky finger outward while folding middle and ring fingers.',
  },
  'thank you': {
    english: 'Thank You',
    hindi: 'धन्यवाद',
    transliteration: 'Dhanyavaad',
    spokenPhonetic: 'Dhanyavaad',
    spokenHindi: 'धन्यवाद',
    category: 'Greetings',
    icon: '🙏',
    islDescription: 'Move flat open palm outward from chin toward viewer in gratitude.',
  },
  yes: {
    english: 'Yes',
    hindi: 'हाँ',
    transliteration: 'Haan',
    spokenPhonetic: 'Haan',
    spokenHindi: 'हाँ',
    category: 'Responses',
    icon: '👍',
    islDescription: 'Give a firm Thumbs Up gesture or nod fist up and down.',
  },
  no: {
    english: 'No',
    hindi: 'नहीं',
    transliteration: 'Nahin',
    spokenPhonetic: 'Nahin',
    spokenHindi: 'नहीं',
    category: 'Responses',
    icon: '👎',
    islDescription: 'Close index and middle finger against thumb or wave palm side-to-side.',
  },
  help: {
    english: 'Help',
    hindi: 'मदद',
    transliteration: 'Madad',
    spokenPhonetic: 'Madad',
    spokenHindi: 'मदद',
    category: 'Emergency',
    icon: '🆘',
    islDescription: 'Place closed fist on flat open palm and lift both hands slightly together.',
  },
  point: {
    english: 'Point / One',
    hindi: 'एक',
    transliteration: 'Ek',
    spokenPhonetic: 'Ek',
    spokenHindi: 'एक',
    category: 'Numbers',
    icon: '☝️',
    islDescription: 'Hold single index finger straight pointing up.',
  },
  fist: {
    english: 'Fist',
    hindi: 'मुट्ठी',
    transliteration: 'Mutthi',
    spokenPhonetic: 'Mutthi',
    spokenHindi: 'मुट्ठी',
    category: 'Postures',
    icon: '✊',
    islDescription: 'Fold all fingers tightly into palm forming solid fist.',
  },
};

export function getISLTranslation(signKey: string | null | undefined): ISLTranslation | null {
  if (!signKey) return null;
  const raw = signKey.toLowerCase().trim();
  if (ISL_TRANSLATIONS[raw]) return ISL_TRANSLATIONS[raw];

  // Try first part before slash (e.g. "say / speak" -> "say", "hello / namaste" -> "hello")
  const firstPart = raw.split('/')[0].trim();
  if (ISL_TRANSLATIONS[firstPart]) return ISL_TRANSLATIONS[firstPart];

  // Check matching english values
  for (const [, v] of Object.entries(ISL_TRANSLATIONS)) {
    if (v.english.toLowerCase() === raw || v.english.toLowerCase().startsWith(firstPart)) {
      return v;
    }
  }
  return null;
}
