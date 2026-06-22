const ASSEMBLYAI_API_URL = 'https://api.assemblyai.com/v2';

export interface TranscriptionResult {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  text?: string;
  error?: string;
}

export interface AssemblyAIError {
  error: string;
  message: string;
  status: number;
}

export class AssemblyAIService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private get headers(): HeadersInit {
    return {
      'Authorization': this.apiKey,
      'Content-Type': 'application/json',
    };
  }

  async uploadAudio(audioBlob: Blob): Promise<string> {
    const arrayBuffer = await audioBlob.arrayBuffer();
    const response = await fetch(`${ASSEMBLYAI_API_URL}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': this.apiKey,
      },
      body: arrayBuffer,
    });

    if (!response.ok) {
      const error: AssemblyAIError = await response.json();
      throw new Error(`AssemblyAI upload error: ${error.error || response.statusText}`);
    }

    const result = await response.json();
    return result.upload_url;
  }

  async transcribeAudio(
    audioUrl: string,
    options: {
      languageCode?: string;
      punctuate?: boolean;
      formatText?: boolean;
    } = {}
  ): Promise<TranscriptionResult> {
    const { languageCode = 'es', punctuate = true, formatText = true } = options;

    const response = await fetch(`${ASSEMBLYAI_API_URL}/transcript`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        audio_url: audioUrl,
        language_code: languageCode,
        punctuate,
        format_text: formatText,
      }),
    });

    if (!response.ok) {
      const error: AssemblyAIError = await response.json();
      throw new Error(`AssemblyAI transcription error: ${error.error || response.statusText}`);
    }

    const transcript = await response.json();
    return {
      id: transcript.id,
      status: transcript.status,
    };
  }

  async getTranscriptionResult(transcriptId: string): Promise<TranscriptionResult> {
    const response = await fetch(`${ASSEMBLYAI_API_URL}/transcript/${transcriptId}`, {
      method: 'GET',
      headers: this.headers,
    });

    if (!response.ok) {
      const error: AssemblyAIError = await response.json();
      throw new Error(`AssemblyAI polling error: ${error.error || response.statusText}`);
    }

    const transcript = await response.json();
    return {
      id: transcript.id,
      status: transcript.status,
      text: transcript.text,
      error: transcript.error,
    };
  }

  async transcribeAudioFile(
    audioBlob: Blob,
    onProgress?: (status: string) => void,
    pollIntervalMs: number = 2000
  ): Promise<string> {
    onProgress?.('Subiendo audio...');
    const audioUrl = await this.uploadAudio(audioBlob);

    onProgress?.('Transcribiendo audio...');
    const transcript = await this.transcribeAudio(audioUrl, { languageCode: 'es' });

    onProgress?.('Procesando transcripción...');
    let result: TranscriptionResult;

    while (true) {
      await this.sleep(pollIntervalMs);
      result = await this.getTranscriptionResult(transcript.id);

      if (result.status === 'completed') {
        break;
      }

      if (result.status === 'error') {
        throw new Error(`Transcription failed: ${result.error}`);
      }

      onProgress?.(`Estado: ${result.status}`);
    }

    if (!result.text) {
      throw new Error('No se получил текст из транскрипции');
    }

    onProgress?.('Transcripción completada');
    return result.text;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

let assemblyAIServiceInstance: AssemblyAIService | null = null;

export function getAssemblyAIService(): AssemblyAIService | null {
  const apiKey = import.meta.env.VITE_ASSEMBLYAI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!assemblyAIServiceInstance) {
    assemblyAIServiceInstance = new AssemblyAIService(apiKey);
  }
  return assemblyAIServiceInstance;
}