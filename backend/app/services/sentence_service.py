"""
SignBridge Sentence Generation Service.
Transforms temporal sequences of recognized sign glosses/tokens into natural,
grammatically correct sentences in English and Hindi (ISL translation).

Clearly distinguishes between:
  1. Raw Sign Gloss Sequence (transcription of recognized tokens)
  2. Grammatical Natural Language Translation (English & Hindi)
"""

import re
from typing import List, Dict, Optional, Tuple, Any
from pydantic import BaseModel


class GeneratedSentence(BaseModel):
    raw_sequence: List[str]
    gloss_display: str
    english_sentence: str
    hindi_sentence: str
    hindi_phonetic: str
    is_complete: bool
    confidence_avg: float
    grammar_pattern: str


class SentenceGenerationService:
    """
    Translates ordered sign token sequences into coherent sentences.
    Supports Indian Sign Language (ISL) discourse patterns (Subject-Object-Verb,
    topic-comment, wh-questions at end/start, polite particles) and maps them
    to standard English and Hindi translations.
    """

    # Pre-compiled multi-token semantic idioms and common sign conversational patterns
    IDIOMATIC_PATTERNS: List[Dict[str, Any]] = [
        # Greetings & Introductions
        {
            "pattern": ["hello", "how", "you"],
            "en": "Hello, how are you?",
            "hi": "नमस्ते, आप कैसे हैं?",
            "phonetic": "Namaste, aap kaise hain?",
            "type": "Greeting",
        },
        {
            "pattern": ["hello", "what"],
            "en": "Hello, what is going on?",
            "hi": "नमस्ते, क्या बात है?",
            "phonetic": "Namaste, kya baat hai?",
            "type": "Greeting-Question",
        },
        {
            "pattern": ["hello", "thank you"],
            "en": "Hello and thank you!",
            "hi": "नमस्ते और बहुत धन्यवाद!",
            "phonetic": "Namaste aur bahut dhanyavaad!",
            "type": "Polite-Greeting",
        },
        # Daily Needs (Food & Drink)
        {
            "pattern": ["eat", "drink"],
            "en": "I would like to eat food and drink water.",
            "hi": "मुझे खाना खाना है और पानी पीना है।",
            "phonetic": "Mujhe khaana khaana hai aur paani peena hai.",
            "type": "Needs-Compound",
        },
        {
            "pattern": ["drink", "eat"],
            "en": "I need some water and food.",
            "hi": "मुझे पानी और खाना चाहिए।",
            "phonetic": "Mujhe paani aur khaana chahiye.",
            "type": "Needs-Compound",
        },
        {
            "pattern": ["eat", "okay"],
            "en": "The food is good / I am finished eating.",
            "hi": "खाना ठीक है / खाना हो गया।",
            "phonetic": "Khaana theek hai / khaana ho gaya.",
            "type": "Statement",
        },
        {
            "pattern": ["drink", "okay"],
            "en": "The water is fine / I have had water.",
            "hi": "पानी ठीक है / पानी पी लिया।",
            "phonetic": "Paani theek hai / paani pee liya.",
            "type": "Statement",
        },
        {
            "pattern": ["what", "eat"],
            "en": "What is there to eat?",
            "hi": "खाने में क्या है?",
            "phonetic": "Khaane mein kya hai?",
            "type": "Wh-Question",
        },
        {
            "pattern": ["what", "drink"],
            "en": "What is available to drink?",
            "hi": "पीने के लिए क्या है?",
            "phonetic": "Peene ke liye kya hai?",
            "type": "Wh-Question",
        },
        {
            "pattern": ["eat", "what"],
            "en": "What are you eating?",
            "hi": "आप क्या खा रहे हैं?",
            "phonetic": "Aap kya khaa rahe hain?",
            "type": "ISL-Wh-Question",
        },
        {
            "pattern": ["drink", "what"],
            "en": "What would you like to drink?",
            "hi": "आप क्या पीना चाहते हैं?",
            "phonetic": "Aap kya peena chahte hain?",
            "type": "ISL-Wh-Question",
        },
        # Questions & Inquiries
        {
            "pattern": ["where", "help"],
            "en": "Where can I find help?",
            "hi": "मदद कहाँ मिल सकती है?",
            "phonetic": "Madad kahan mil sakti hai?",
            "type": "Emergency-Inquiry",
        },
        {
            "pattern": ["help", "where"],
            "en": "Where is assistance available?",
            "hi": "सहायता कहाँ उपलब्ध है?",
            "phonetic": "Sahaayata kahan uplabdh hai?",
            "type": "ISL-Emergency",
        },
        {
            "pattern": ["who", "say"],
            "en": "Who said that?",
            "hi": "यह किसने कहा?",
            "phonetic": "Yeh kisne kaha?",
            "type": "Inquiry",
        },
        {
            "pattern": ["why", "say"],
            "en": "Why did you say that?",
            "hi": "आपने ऐसा क्यों कहा?",
            "phonetic": "Aapne aisa kyon kaha?",
            "type": "Inquiry",
        },
        {
            "pattern": ["which", "okay"],
            "en": "Which one is okay?",
            "hi": "कौन सा वाला ठीक है?",
            "phonetic": "Kaunsa waala theek hai?",
            "type": "Choice-Question",
        },
        {
            "pattern": ["what", "say"],
            "en": "What did you say?",
            "hi": "आपने क्या कहा?",
            "phonetic": "Aapne kya kaha?",
            "type": "Inquiry",
        },
        {
            "pattern": ["say", "what"],
            "en": "What are you saying?",
            "hi": "आप क्या कह रहे हैं?",
            "phonetic": "Aap kya keh rahe hain?",
            "type": "ISL-Inquiry",
        },
        # Emergency & Urgent
        {
            "pattern": ["help", "please"],
            "en": "Please help me!",
            "hi": "कृपया मेरी मदद करें!",
            "phonetic": "Kripya meri madad karein!",
            "type": "Emergency",
        },
        {
            "pattern": ["help", "yes"],
            "en": "Yes, I urgently need help.",
            "hi": "हाँ, मुझे तुरंत मदद की जरूरत है।",
            "phonetic": "Haan, mujhe turant madad ki zaroorat hai.",
            "type": "Emergency-Affirmative",
        },
        {
            "pattern": ["help", "no"],
            "en": "No, I do not need help.",
            "hi": "नहीं, मुझे मदद की जरूरत नहीं है।",
            "phonetic": "Nahin, mujhe madad ki zaroorat nahin hai.",
            "type": "Emergency-Negative",
        },
        # Responses & Expressions
        {
            "pattern": ["yes", "okay"],
            "en": "Yes, that is completely fine.",
            "hi": "हाँ, यह बिल्कुल ठीक है।",
            "phonetic": "Haan, yeh bilkul theek hai.",
            "type": "Affirmation",
        },
        {
            "pattern": ["no", "okay"],
            "en": "No, that is not okay.",
            "hi": "नहीं, यह ठीक नहीं है।",
            "phonetic": "Nahin, yeh theek nahin hai.",
            "type": "Negation",
        },
        {
            "pattern": ["thank you", "peace"],
            "en": "Thank you, wish you peace.",
            "hi": "धन्यवाद, आपको शांति और शुभकामनाएं।",
            "phonetic": "Dhanyavaad, aapko shanti aur shubhkamnayein.",
            "type": "Expression",
        },
        {
            "pattern": ["i love you", "thank you"],
            "en": "I love you and thank you very much.",
            "hi": "मुझे आपसे बहुत प्यार है और धन्यवाद।",
            "phonetic": "Mujhe aapse bahut pyaar hai aur dhanyavaad.",
            "type": "Expression",
        },
        {
            "pattern": ["peace", "okay"],
            "en": "Peace, everything is okay.",
            "hi": "शांति, सब कुछ ठीक है।",
            "phonetic": "Shanti, sab kuch theek hai.",
            "type": "Expression",
        },
    ]

    # Single sign word translations and part-of-speech mappings
    WORD_MAP: Dict[str, Dict[str, str]] = {
        "hello": {"en": "Hello", "hi": "नमस्ते", "phonetic": "Namaste", "pos": "GREETING"},
        "namaste": {"en": "Hello", "hi": "नमस्ते", "phonetic": "Namaste", "pos": "GREETING"},
        "thank you": {"en": "thank you", "hi": "धन्यवाद", "phonetic": "Dhanyavaad", "pos": "POLITE"},
        "please": {"en": "please", "hi": "कृपया", "phonetic": "Kripya", "pos": "POLITE"},
        "sorry": {"en": "sorry", "hi": "माफ़ कीजिए", "phonetic": "Maaf Kijiye", "pos": "POLITE"},
        "welcome": {"en": "welcome", "hi": "स्वागत", "phonetic": "Swagat", "pos": "GREETING"},
        "good morning": {"en": "Good morning", "hi": "शुभ प्रभात", "phonetic": "Shubh Prabhat", "pos": "GREETING"},
        "good night": {"en": "Good night", "hi": "शुभ रात्रि", "phonetic": "Shubh Raatri", "pos": "GREETING"},
        "eat": {"en": "eat", "hi": "खाना", "phonetic": "Khaana", "pos": "VERB_NEED"},
        "eating": {"en": "eating", "hi": "खाना", "phonetic": "Khaana", "pos": "VERB_NEED"},
        "drink": {"en": "drink water", "hi": "पानी पीना", "phonetic": "Paani", "pos": "VERB_NEED"},
        "water": {"en": "water", "hi": "पानी", "phonetic": "Paani", "pos": "NOUN"},
        "say": {"en": "say / speak", "hi": "बोलना", "phonetic": "Bolna", "pos": "VERB"},
        "what": {"en": "what", "hi": "क्या", "phonetic": "Kya", "pos": "WH_QUESTION"},
        "where": {"en": "where", "hi": "कहाँ", "phonetic": "Kahaan", "pos": "WH_QUESTION"},
        "why": {"en": "why", "hi": "क्यों", "phonetic": "Kyun", "pos": "WH_QUESTION"},
        "who": {"en": "who", "hi": "कौन", "phonetic": "Kaun", "pos": "WH_QUESTION"},
        "which": {"en": "which", "hi": "कौनसा", "phonetic": "Kaunsa", "pos": "WH_QUESTION"},
        "how": {"en": "how", "hi": "कैसे", "phonetic": "Kaise", "pos": "WH_QUESTION"},
        "when": {"en": "when", "hi": "कब", "phonetic": "Kab", "pos": "WH_QUESTION"},
        "okay": {"en": "okay", "hi": "ठीक है", "phonetic": "Theek hai", "pos": "RESPONSE"},
        "yes": {"en": "yes", "hi": "हाँ", "phonetic": "Haan", "pos": "RESPONSE"},
        "no": {"en": "no", "hi": "नहीं", "phonetic": "Nahin", "pos": "RESPONSE"},
        "good": {"en": "good", "hi": "अच्छा", "phonetic": "Accha", "pos": "ADJECTIVE"},
        "bad": {"en": "bad", "hi": "बुरा", "phonetic": "Bura", "pos": "ADJECTIVE"},
        "happy": {"en": "happy", "hi": "खुश", "phonetic": "Khush", "pos": "EMOTION"},
        "sad": {"en": "sad", "hi": "उदास", "phonetic": "Udaas", "pos": "EMOTION"},
        "peace": {"en": "peace", "hi": "शांति", "phonetic": "Shanti", "pos": "NOUN"},
        "i love you": {"en": "I love you", "hi": "मैं आपसे प्यार करता हूँ", "phonetic": "Pyaar", "pos": "PHRASE"},
        "help": {"en": "help", "hi": "मदद", "phonetic": "Madad", "pos": "EMERGENCY"},
        "sleep": {"en": "sleep", "hi": "सोना", "phonetic": "Sona", "pos": "VERB"},
        "go": {"en": "go", "hi": "जाना", "phonetic": "Jaana", "pos": "VERB"},
        "come": {"en": "come", "hi": "आना", "phonetic": "Aana", "pos": "VERB"},
        "stop": {"en": "stop", "hi": "रुकना", "phonetic": "Rukna", "pos": "VERB"},
        "work": {"en": "work", "hi": "काम", "phonetic": "Kaam", "pos": "VERB"},
        "study": {"en": "study", "hi": "पढ़ाई", "phonetic": "Padhai", "pos": "VERB"},
        "mother": {"en": "mother", "hi": "माँ", "phonetic": "Maa", "pos": "NOUN"},
        "father": {"en": "father", "hi": "पिताजी", "phonetic": "Pitaji", "pos": "NOUN"},
        "friend": {"en": "friend", "hi": "दोस्त", "phonetic": "Dost", "pos": "NOUN"},
        "family": {"en": "family", "hi": "परिवार", "phonetic": "Parivaar", "pos": "NOUN"},
        "teacher": {"en": "teacher", "hi": "अध्यापक", "phonetic": "Adhyapak", "pos": "NOUN"},
        "doctor": {"en": "doctor", "hi": "डॉक्टर", "phonetic": "Doctor", "pos": "NOUN"},
        "today": {"en": "today", "hi": "आज", "phonetic": "Aaj", "pos": "TIME"},
        "tomorrow": {"en": "tomorrow", "hi": "कल", "phonetic": "Kal", "pos": "TIME"},
        "yesterday": {"en": "yesterday", "hi": "बीता हुआ कल", "phonetic": "Beeta kal", "pos": "TIME"},
        "time": {"en": "time", "hi": "समय", "phonetic": "Samay", "pos": "TIME"},
        "point": {"en": "this / one", "hi": "यह / एक", "phonetic": "Yeh / Ek", "pos": "PRONOUN"},
        "fist": {"en": "solidarity / strength", "hi": "मुट्ठी / शक्ति", "phonetic": "Mutthi", "pos": "NOUN"},
        "1": {"en": "one", "hi": "एक", "phonetic": "Ek", "pos": "NUMBER"},
        "2": {"en": "two", "hi": "दो", "phonetic": "Do", "pos": "NUMBER"},
        "3": {"en": "three", "hi": "तीन", "phonetic": "Teen", "pos": "NUMBER"},
        "4": {"en": "four", "hi": "चार", "phonetic": "Chaar", "pos": "NUMBER"},
        "5": {"en": "five", "hi": "पाँच", "phonetic": "Paanch", "pos": "NUMBER"},
        "6": {"en": "six", "hi": "छह", "phonetic": "Chhah", "pos": "NUMBER"},
        "7": {"en": "seven", "hi": "सात", "phonetic": "Saat", "pos": "NUMBER"},
        "8": {"en": "eight", "hi": "आठ", "phonetic": "Aath", "pos": "NUMBER"},
        "9": {"en": "nine", "hi": "नौ", "phonetic": "Nau", "pos": "NUMBER"},
        "10": {"en": "ten", "hi": "दस", "phonetic": "Das", "pos": "NUMBER"},
    }

    @classmethod
    def generate_sentence(
        cls,
        tokens: List[str],
        confidences: Optional[List[float]] = None
    ) -> GeneratedSentence:
        """
        Converts a list of recognized sign tokens (e.g. ['Hello', 'What', 'Drink'])
        into clean natural language sentences in English and Hindi.
        """
        if not tokens:
            return GeneratedSentence(
                raw_sequence=[],
                gloss_display="",
                english_sentence="",
                hindi_sentence="",
                hindi_phonetic="",
                is_complete=False,
                confidence_avg=0.0,
                grammar_pattern="Empty",
            )

        clean_tokens = [t.strip().lower() for t in tokens if t.strip()]
        avg_conf = (
            round(sum(confidences) / len(confidences), 1)
            if confidences and len(confidences) == len(tokens)
            else 92.0
        )

        gloss_display = " · ".join([t.upper() for t in clean_tokens])

        # 1. Exact or Subsequence Idiom Match
        for item in cls.IDIOMATIC_PATTERNS:
            p_len = len(item["pattern"])
            if len(clean_tokens) == p_len and clean_tokens == item["pattern"]:
                return GeneratedSentence(
                    raw_sequence=tokens,
                    gloss_display=gloss_display,
                    english_sentence=item["en"],
                    hindi_sentence=item["hi"],
                    hindi_phonetic=item["phonetic"],
                    is_complete=True,
                    confidence_avg=avg_conf,
                    grammar_pattern=f"Idiomatic:{item['type']}",
                )

        # 2. Check for Prefix/Suffix Idioms (e.g., [Hello, What, Drink] -> "Hello! What would you like to drink?")
        if len(clean_tokens) > 1 and clean_tokens[0] in ["hello", "namaste"]:
            rest = clean_tokens[1:]
            for item in cls.IDIOMATIC_PATTERNS:
                if rest == item["pattern"]:
                    return GeneratedSentence(
                        raw_sequence=tokens,
                        gloss_display=gloss_display,
                        english_sentence=f"Hello! {item['en']}",
                        hindi_sentence=f"नमस्ते! {item['hi']}",
                        hindi_phonetic=f"Namaste! {item['phonetic']}",
                        is_complete=True,
                        confidence_avg=avg_conf,
                        grammar_pattern=f"Greeting+{item['type']}",
                    )

        # 3. Rule-Based Grammatical Composition
        # Determine discourse structure:
        # Check if contains question sign
        has_wh = any(t in ["what", "where", "why", "who", "which"] for t in clean_tokens)
        has_greeting = any(t in ["hello", "namaste"] for t in clean_tokens)
        has_need = any(t in ["eat", "eating", "drink"] for t in clean_tokens)
        has_help = "help" in clean_tokens
        has_polite = "thank you" in clean_tokens

        # Single Token
        if len(clean_tokens) == 1:
            token = clean_tokens[0]
            mapped = cls.WORD_MAP.get(token, {"en": token.capitalize(), "hi": token, "phonetic": token, "pos": "NOUN"})
            
            if token in ["hello", "namaste"]:
                en = "Hello! Welcome."
                hi = "नमस्ते! आपका स्वागत है।"
                phonetic = "Namaste! Aapka swagat hai."
            elif token in ["eat", "eating"]:
                en = "I want to eat food."
                hi = "मुझे खाना खाना है।"
                phonetic = "Mujhe khaana khaana hai."
            elif token == "drink":
                en = "I want to drink water."
                hi = "मुझे पानी पीना है।"
                phonetic = "Mujhe paani peena hai."
            elif token == "help":
                en = "I need help, please."
                hi = "मुझे सहायता चाहिए।"
                phonetic = "Mujhe madad chahiye."
            elif token == "thank you":
                en = "Thank you very much!"
                hi = "आपका बहुत धन्यवाद!"
                phonetic = "Aapka bahut dhanyavaad!"
            elif token == "okay":
                en = "Everything is okay."
                hi = "सब ठीक है।"
                phonetic = "Sab theek hai."
            elif token == "yes":
                en = "Yes, confirmed."
                hi = "हाँ, बिल्कुल।"
                phonetic = "Haan, bilkul."
            elif token == "no":
                en = "No, that is not correct."
                hi = "नहीं, ऐसा नहीं है।"
                phonetic = "Nahin, aisa nahin hai."
            elif token == "peace":
                en = "Peace and harmony."
                hi = "शांति और सद्भाव।"
                phonetic = "Shanti aur sadbhav."
            elif token == "i love you":
                en = "I love you."
                hi = "मैं आपसे प्यार करता हूँ।"
                phonetic = "Main aapse pyaar karta hoon."
            elif token in ["what", "where", "why", "who", "which"]:
                en = f"{mapped['en'].capitalize()} is it?"
                hi = f"यह {mapped['hi']} है?"
                phonetic = f"Yeh {mapped['phonetic']} hai?"
            else:
                en = mapped["en"].capitalize()
                hi = mapped["hi"]
                phonetic = mapped["phonetic"]

            return GeneratedSentence(
                raw_sequence=tokens,
                gloss_display=gloss_display,
                english_sentence=en,
                hindi_sentence=hi,
                hindi_phonetic=phonetic,
                is_complete=False,
                confidence_avg=avg_conf,
                grammar_pattern="IsolatedSignMapping",
            )

        # Multi-Token Synthesis
        en_parts = []
        hi_parts = []
        ph_parts = []

        # Greeting prefix
        if has_greeting:
            en_parts.append("Hello!")
            hi_parts.append("नमस्ते!")
            ph_parts.append("Namaste!")

        # Question / Inquiries
        if has_wh:
            wh_word = next(t for t in clean_tokens if t in ["what", "where", "why", "who", "which"])
            wh_map = cls.WORD_MAP.get(wh_word, {"en": wh_word, "hi": wh_word, "phonetic": wh_word})
            other_words = [t for t in clean_tokens if t != wh_word and t not in ["hello", "namaste"]]

            if "drink" in other_words:
                en_parts.append(f"What would you like to drink?")
                hi_parts.append(f"आप क्या पीना चाहते हैं?")
                ph_parts.append("Aap kya peena chahte hain?")
            elif "eat" in other_words:
                en_parts.append(f"What would you like to eat?")
                hi_parts.append(f"आप क्या खाना चाहते हैं?")
                ph_parts.append("Aap kya khaana chahte hain?")
            elif "help" in other_words:
                en_parts.append(f"Where can assistance or help be found?")
                hi_parts.append(f"मदद या सहायता कहाँ मिल सकती है?")
                ph_parts.append("Madad ya sahaayata kahan mil sakti hai?")
            else:
                other_en = " ".join([cls.WORD_MAP.get(w, {}).get("en", w) for w in other_words])
                other_hi = " ".join([cls.WORD_MAP.get(w, {}).get("hi", w) for w in other_words])
                other_ph = " ".join([cls.WORD_MAP.get(w, {}).get("phonetic", w) for w in other_words])
                
                en_parts.append(f"{wh_map['en'].capitalize()} is {other_en}?" if other_en else f"{wh_map['en'].capitalize()} is it?")
                hi_parts.append(f"{other_hi} {wh_map['hi']} है?" if other_hi else f"यह {wh_map['hi']} है?")
                ph_parts.append(f"{other_ph} {wh_map['phonetic']} hai?" if other_ph else f"Yeh {wh_map['phonetic']} hai?")

        elif has_need:
            needs = [t for t in clean_tokens if t in ["eat", "eating", "drink"]]
            others = [t for t in clean_tokens if t not in needs and t not in ["hello", "namaste"]]
            
            need_en = " and ".join(["eat food" if "eat" in n else "drink water" for n in needs])
            need_hi = " और ".join(["खाना खाना" if "eat" in n else "पानी पीना" for n in needs])
            need_ph = " aur ".join(["khaana khaana" if "eat" in n else "paani peena" for n in needs])

            if "okay" in others:
                en_parts.append(f"I would like to {need_en}, is that okay?")
                hi_parts.append(f"मुझे {need_hi} है, क्या यह ठीक है?")
                ph_parts.append(f"Mujhe {need_ph} hai, kya yeh theek hai?")
            elif "thank you" in others:
                en_parts.append(f"Thank you, I would like to {need_en}.")
                hi_parts.append(f"धन्यवाद, मुझे {need_hi} है।")
                ph_parts.append(f"Dhanyavaad, mujhe {need_ph} hai.")
            elif "help" in others:
                en_parts.append(f"Please help me {need_en}.")
                hi_parts.append(f"कृपया मुझे {need_hi} में मदद करें।")
                ph_parts.append(f"Kripya mujhe {need_ph} mein madad karein.")
            else:
                en_parts.append(f"I need to {need_en}.")
                hi_parts.append(f"मुझे {need_hi} है।")
                ph_parts.append(f"Mujhe {need_ph} hai.")

        elif has_help:
            others = [t for t in clean_tokens if t != "help" and t not in ["hello", "namaste"]]
            if "please" in others or "thank you" in others:
                en_parts.append("Please help me, thank you.")
                hi_parts.append("कृपया मेरी सहायता करें, धन्यवाद।")
                ph_parts.append("Kripya meri sahaayata karein, dhanyavaad.")
            elif "yes" in others:
                en_parts.append("Yes, I urgently require help.")
                hi_parts.append("हाँ, मुझे तुरंत सहायता चाहिए।")
                ph_parts.append("Haan, mujhe turant sahaayata chahiye.")
            elif "no" in others:
                en_parts.append("No help is needed right now.")
                hi_parts.append("अभी किसी सहायता की आवश्यकता नहीं है।")
                ph_parts.append("Abhi kisi sahaayata ki aavashyakta nahin hai.")
            else:
                en_parts.append("Help is required.")
                hi_parts.append("सहायता की आवश्यकता है।")
                ph_parts.append("Sahaayata ki aavashyakta hai.")

        else:
            # General sequential concatenation with grammatical smoothing
            elements_en = []
            elements_hi = []
            elements_ph = []
            for t in clean_tokens:
                if t in ["hello", "namaste"] and has_greeting:
                    continue
                w_info = cls.WORD_MAP.get(t, {"en": t, "hi": t, "phonetic": t})
                elements_en.append(w_info["en"])
                elements_hi.append(w_info["hi"])
                elements_ph.append(w_info["phonetic"])

            if elements_en:
                en_parts.append(", ".join(elements_en).capitalize() + ".")
                hi_parts.append(" ".join(elements_hi) + "।")
                ph_parts.append(" ".join(elements_ph) + ".")

        final_en = " ".join(en_parts).strip()
        final_hi = " ".join(hi_parts).strip()
        final_ph = " ".join(ph_parts).strip()

        # Ensure terminal punctuation
        if final_en and not final_en.endswith((".", "!", "?")):
            final_en += "."
        if final_hi and not final_hi.endswith(("।", "!", "?")):
            final_hi += "।"

        return GeneratedSentence(
            raw_sequence=tokens,
            gloss_display=gloss_display,
            english_sentence=final_en,
            hindi_sentence=final_hi,
            hindi_phonetic=final_ph,
            is_complete=len(clean_tokens) >= 2,
            confidence_avg=avg_conf,
            grammar_pattern="RuleBasedLinguisticSynthesis",
        )


sentence_generation_service = SentenceGenerationService()
