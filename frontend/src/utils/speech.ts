// Browser native Web Speech API utility with robust ISL / Hindi & Bilingual pronunciation
import { getISLTranslation } from './islDictionary';

export type SpeechAudioMode = 'hindi' | 'bilingual' | 'english';

export class SpeechService {
  private static synth: SpeechSynthesis | null =
    typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
  private static cachedVoices: SpeechSynthesisVoice[] = [];
  private static lastSpokenWord: string = '';
  private static lastSpokenTime: number = 0;

  // Initialize voice list caching
  static {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const updateVoices = () => {
        try {
          const list = window.speechSynthesis.getVoices();
          if (list && list.length > 0) {
            SpeechService.cachedVoices = list;
          }
        } catch {}
      };
      updateVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = updateVoices;
      }
    }
  }

  private static getAvailableVoices(): SpeechSynthesisVoice[] {
    if (this.cachedVoices.length > 0) return this.cachedVoices;
    if (this.synth && this.synth.getVoices) {
      this.cachedVoices = this.synth.getVoices() || [];
    }
    return this.cachedVoices;
  }

  /**
   * Speak a recognized sign in the desired audio mode.
   * - 'hindi': Speaks authentic Indian ISL term (e.g. "Namaste", "Khaana", "Paani", "Theek Hai")
   * - 'bilingual': Speaks combined "Hello, Namaste" / "Eat, Khaana" / "Drink, Paani"
   * - 'english': Speaks English word ("Hello", "Eat", "Drink")
   */
  public static speakSign(
    englishSign: string,
    mode: SpeechAudioMode = 'hindi',
    force: boolean = false
  ): boolean {
    if (!this.synth || !englishSign) return false;

    const now = Date.now();
    // Debounce duplicate utterances within 2.0 seconds unless explicitly forced by button click
    if (!force && englishSign.toLowerCase() === this.lastSpokenWord.toLowerCase() && now - this.lastSpokenTime < 2000) {
      return false;
    }

    try {
      this.synth.cancel(); // Stop any pending utterance cleanly

      const isl = getISLTranslation(englishSign);
      const phoneticHindi = isl?.spokenPhonetic || isl?.transliteration || englishSign;
      const devanagariHindi = isl?.spokenHindi || phoneticHindi;

      const voices = this.getAvailableVoices();

      // Look for native Hindi voice (e.g. Google हिन्दी, Microsoft Kalpana, hi-IN)
      const hindiVoice = voices.find(
        (v) =>
          v.lang.toLowerCase().startsWith('hi') ||
          v.name.toLowerCase().includes('hindi')
      );

      // Look for Indian English voice (e.g. en-IN, Microsoft Heera, Google Indian English)
      const indianEngVoice = voices.find(
        (v) =>
          (v.lang.toLowerCase() === 'en-in' || v.lang.toLowerCase().includes('india')) &&
          !v.lang.toLowerCase().startsWith('hi')
      );

      // Fallback English or system default voice
      const defaultVoice = voices.find((v) => v.lang.toLowerCase().startsWith('en')) || voices[0] || null;

      let utteranceText = '';
      let targetLang = 'en-US';
      let targetVoice: SpeechSynthesisVoice | null = null;

      if (mode === 'hindi') {
        // Speak authentic Indian / ISL phrase: "Namaste", "Khaana", "Paani", "Theek Hai", etc.
        if (hindiVoice) {
          utteranceText = devanagariHindi;
          targetLang = hindiVoice.lang || 'hi-IN';
          targetVoice = hindiVoice;
        } else {
          // If no native Hindi voice is installed in OS, speak Romanized phonetic string.
          // Any voice (US/UK/IN) pronounces "Namaste", "Khaana", "Paani" accurately!
          utteranceText = phoneticHindi;
          targetVoice = indianEngVoice || defaultVoice;
          targetLang = targetVoice?.lang || 'en-IN';
        }
      } else if (mode === 'bilingual') {
        // Combined spoken string: e.g. "Hello, Namaste", "Eat, Khaana", "Drink, Paani"
        utteranceText = `${englishSign}... ${phoneticHindi}`;
        targetVoice = indianEngVoice || defaultVoice;
        targetLang = targetVoice?.lang || 'en-IN';
      } else {
        // English only: "Hello", "Eat", "Drink"
        utteranceText = englishSign;
        targetVoice = defaultVoice;
        targetLang = targetVoice?.lang || 'en-US';
      }

      const utt = new SpeechSynthesisUtterance(utteranceText);
      utt.lang = targetLang;
      utt.rate = 0.95;
      utt.pitch = 1.0;
      utt.volume = 1.0;
      if (targetVoice) {
        utt.voice = targetVoice;
      }

      this.synth.speak(utt);

      this.lastSpokenWord = englishSign;
      this.lastSpokenTime = now;
      return true;
    } catch (err) {
      console.warn('[SpeechService] Synthesis error:', err);
      return false;
    }
  }

  /**
   * Speak an entire generated sentence in the selected audio mode.
   */
  public static speakSentence(
    englishText: string,
    hindiText: string,
    hindiPhonetic: string,
    mode: SpeechAudioMode = 'hindi'
  ): boolean {
    if (!this.synth) return false;

    try {
      this.synth.cancel();
      const voices = this.getAvailableVoices();

      const hindiVoice = voices.find(
        (v) =>
          v.lang.toLowerCase().startsWith('hi') ||
          v.name.toLowerCase().includes('hindi')
      );
      const indianEngVoice = voices.find(
        (v) =>
          (v.lang.toLowerCase() === 'en-in' || v.lang.toLowerCase().includes('india')) &&
          !v.lang.toLowerCase().startsWith('hi')
      );
      const defaultVoice = voices.find((v) => v.lang.toLowerCase().startsWith('en')) || voices[0] || null;

      let utteranceText = '';
      let targetLang = 'en-US';
      let targetVoice: SpeechSynthesisVoice | null = null;

      if (mode === 'hindi') {
        if (hindiVoice) {
          utteranceText = hindiText;
          targetLang = hindiVoice.lang || 'hi-IN';
          targetVoice = hindiVoice;
        } else {
          utteranceText = hindiPhonetic || englishText;
          targetVoice = indianEngVoice || defaultVoice;
          targetLang = targetVoice?.lang || 'en-IN';
        }
      } else if (mode === 'bilingual') {
        utteranceText = `${englishText}... ${hindiPhonetic || hindiText}`;
        targetVoice = indianEngVoice || defaultVoice;
        targetLang = targetVoice?.lang || 'en-IN';
      } else {
        utteranceText = englishText;
        targetVoice = defaultVoice;
        targetLang = targetVoice?.lang || 'en-US';
      }

      const utt = new SpeechSynthesisUtterance(utteranceText);
      utt.lang = targetLang;
      utt.rate = 0.95;
      utt.volume = 1.0;
      if (targetVoice) {
        utt.voice = targetVoice;
      }

      this.synth.speak(utt);
      return true;
    } catch (err) {
      console.warn('[SpeechService] Sentence synthesis error:', err);
      return false;
    }
  }

  /**
   * Directly speak any text string
   */
  public static speak(text: string, _force?: boolean): boolean {
    if (!this.synth || !text) return false;
    try {
      this.synth.cancel();
      const voices = this.getAvailableVoices();
      const preferredVoice =
        voices.find((v) => v.lang.toLowerCase().startsWith('hi')) ||
        voices.find((v) => v.lang.toLowerCase() === 'en-in') ||
        voices.find((v) => v.lang.toLowerCase().startsWith('en')) ||
        voices[0] ||
        null;

      const utt = new SpeechSynthesisUtterance(text);
      if (preferredVoice) {
        utt.voice = preferredVoice;
        utt.lang = preferredVoice.lang;
      }
      utt.rate = 0.95;
      this.synth.speak(utt);
      return true;
    } catch {
      return false;
    }
  }

  public static stop() {
    if (this.synth) {
      this.synth.cancel();
    }
  }
}
