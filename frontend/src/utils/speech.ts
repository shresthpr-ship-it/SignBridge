// Browser native Web Speech API utility supporting Hindi (ISL) & English pronunciation

export class SpeechService {
  private static synth: SpeechSynthesis | null =
    typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
  private static lastSpokenText: string = '';
  private static lastSpokenTime: number = 0;

  public static speak(text: string, force: boolean = false, requestedLang: string = 'hi-IN'): boolean {
    if (!this.synth || !text) return false;

    const now = Date.now();
    // Debounce duplicate utterances within 2.2 seconds unless explicitly forced
    if (!force && text.toLowerCase() === this.lastSpokenText.toLowerCase() && now - this.lastSpokenTime < 2200) {
      return false;
    }

    try {
      this.synth.cancel(); // Cancel any ongoing utterance
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      // Detect if text contains Hindi Devanagari characters or requestedLang is Hindi
      const isHindi = /[\u0900-\u097F]/.test(text) || requestedLang.toLowerCase().startsWith('hi');

      if (isHindi) {
        utterance.lang = 'hi-IN';
      } else {
        utterance.lang = requestedLang || 'en-US';
      }

      // Select appropriate voice if available in the browser
      if (this.synth.getVoices) {
        const voices = this.synth.getVoices();
        if (isHindi) {
          const hindiVoice = voices.find(
            (v) =>
              v.lang.startsWith('hi') ||
              v.lang.includes('IN') ||
              v.name.toLowerCase().includes('hindi') ||
              v.name.toLowerCase().includes('india')
          );
          if (hindiVoice) {
            utterance.voice = hindiVoice;
          }
        } else {
          const engVoice = voices.find((v) => v.lang.startsWith('en'));
          if (engVoice) {
            utterance.voice = engVoice;
          }
        }
      }

      this.synth.speak(utterance);
      this.lastSpokenText = text;
      this.lastSpokenTime = now;
      return true;
    } catch (err) {
      console.warn('[SpeechService] Synthesis error:', err);
      return false;
    }
  }

  public static stop() {
    if (this.synth) {
      this.synth.cancel();
    }
  }

  public static isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }
}
