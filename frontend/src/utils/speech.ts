// Browser native Web Speech API utility for pronouncing translated sign gestures

export class SpeechService {
  private static synth: SpeechSynthesis | null =
    typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
  private static lastSpokenText: string = '';
  private static lastSpokenTime: number = 0;

  public static speak(text: string, force: boolean = false): boolean {
    if (!this.synth || !text) return false;

    const now = Date.now();
    // Debounce duplicate utterances within 2.5 seconds unless user explicitly clicked Speak
    if (!force && text.toLowerCase() === this.lastSpokenText.toLowerCase() && now - this.lastSpokenTime < 2500) {
      return false;
    }

    try {
      this.synth.cancel(); // Cancel any ongoing utterance
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      utterance.lang = 'en-US';

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
