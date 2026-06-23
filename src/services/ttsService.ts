export type TTSVoiceStatus = 'idle' | 'speaking' | 'error';

export interface TTSServiceState {
  status: TTSVoiceStatus;
  error: string | null;
}

export class TextToSpeechService {
  private static instance: TextToSpeechService | null = null;
  private synth: SpeechSynthesis;
  private voices: SpeechSynthesisVoice[] = [];
  private isSpanishConfigured: boolean = false;

  private constructor() {
    this.synth = window.speechSynthesis;
    this.loadVoices();
    
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = () => this.loadVoices();
    }
  }

  static getInstance(): TextToSpeechService {
    if (!TextToSpeechService.instance) {
      TextToSpeechService.instance = new TextToSpeechService();
    }
    return TextToSpeechService.instance;
  }

  private loadVoices(): void {
    this.voices = this.synth.getVoices();
    const spanishVoice = this.voices.find(v => 
      v.lang.startsWith('es') && (v.localService || v.name.includes('Spanish'))
    );
    this.isSpanishConfigured = spanishVoice !== null;
  }

  isAvailable(): boolean {
    return 'speechSynthesis' in window;
  }

  async speak(text: string, rate: number = 0.9): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('Text-to-Speech no está disponible en este navegador');
    }

    this.synth.cancel();

    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      
      utterance.rate = rate;
      utterance.pitch = 1;
      utterance.volume = 1;

      const spanishVoice = this.voices.find(v => 
        v.lang.startsWith('es') && (v.localService || v.name.includes('Spanish'))
      );
      
      if (spanishVoice) {
        utterance.voice = spanishVoice;
      } else {
        const defaultVoice = this.voices[0];
        if (defaultVoice) {
          utterance.voice = defaultVoice;
        }
      }

      utterance.onend = () => resolve();
      utterance.onerror = (event) => reject(new Error(`TTS error: ${event.error}`));

      this.synth.speak(utterance);
    });
  }

  cancel(): void {
    if (this.isAvailable()) {
      this.synth.cancel();
    }
  }

  isSpeaking(): boolean {
    return this.synth.speaking;
  }
}

export function getTTSService(): TextToSpeechService {
  return TextToSpeechService.getInstance();
}