export interface ExtractedAppointmentData {
  clientName: string | null;
  serviceName: string | null;
  date: string | null;
  time: string | null;
  workerName: string | null;
  locationType: 'Salón' | 'Domicilio' | null;
  address: string | null;
  notes: string | null;
}

export interface ExtractionResult {
  success: boolean;
  data: ExtractedAppointmentData | null;
  rawText: string;
  error: string | null;
  confidence: number;
}

const SYSTEM_PROMPT = `Eres un asistente especializado en agendar citas para un salón de belleza de uñas. Tu tarea es analizar texto spoken por una manicurista y extraer los datos relevantes para crear una cita.

Analiza el texto y extrae los siguientes campos en JSON:
- clientName: Nombre del cliente (string o null si no se mencionó)
- serviceName: Nombre del servicio solicitado (string o null si no se mencionó). Valores comunes: "Uñas Acrílicas", "Uñas Gel", "Manicure", "Pedicure", "Relleno", "Diseño", "Extensiones", "Belleza de manos"
- date: Fecha de la cita en formato ISO (YYYY-MM-DD) o null si no se pudo determinar. Calcula la fecha correcta basándote en expresiones como "hoy", "mañana", "próximo martes", "el 15", etc. Ten en cuenta la fecha actual del sistema.
- time: Hora de la cita en formato 24 horas (HH:MM) o null si no se mencionó. Interpreta expresiones como "a las 3 de la tarde", "a las 10", "en la mañana", etc.
- workerName: Nombre del trabajador/asignado o null si no se mencionó
- locationType: "Salón" o "Domicilio" basándote en el contexto (null si no está claro)
- address: Dirección si es domicilio, null otherwise
- notes: Notas adicionales mencionadas en la conversación (null si no hay)

REGLAS IMPORTANTES:
1. Si el texto no contiene suficiente información para agendar (ej: solo dice "hola" o "qué tal"), devuelve el JSON con todos los campos en null y success=false
2. La fecha debe ser calculada correctamente considerando el día actual
3. El nombre del cliente y servicio son los más importantes - si faltan ambos, considera que no es un agendamiento válido
4. No inventes información - si no hay información, usa null
5. Devuelve SOLO el JSON, sin texto adicional, sin explicaciones, sin marcadores de código`;

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

export class GroqService {
  private apiKey: string | null = null;
  private model: string = 'llama-3.3-70b-versatile';

  constructor() {
    this.apiKey = import.meta.env.VITE_GROQ_API_KEY || null;
  }

  isConfigured(): boolean {
    return this.apiKey !== null && this.apiKey.length > 0;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    retries: number = 3
  ): Promise<T> {
    let lastError: Error | null = null;
    let delay = 1000;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt === retries) {
          throw lastError;
        }

        const isRetryable = this.isRetryableError(error);

        if (isRetryable) {
          console.warn(`Groq API retryable error, waiting ${delay}ms... (attempt ${attempt + 1}/${retries})`);
          await this.sleep(delay);
          delay *= 2;
        } else {
          throw lastError;
        }
      }
    }

    throw lastError;
  }

  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('429') ||
        message.includes('rate limit') ||
        message.includes('overloaded') ||
        message.includes('too many requests') ||
        message.includes('timeout') ||
        message.includes('503')
      );
    }
    return false;
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      if (message.includes('429') || message.includes('rate limit')) {
        return 'Límite de uso alcanzado. Espera unos segundos e intenta de nuevo.';
      }
      if (message.includes('overloaded')) {
        return 'Groq está sobrecargado. Espera un momento e intenta de nuevo.';
      }
      if (message.includes('invalid api key') || message.includes('unauthorized')) {
        return 'API key de Groq inválida. Verifica tu VITE_GROQ_API_KEY.';
      }
      if (message.includes('model')) {
        return 'Modelo no disponible. Verifica el nombre del modelo.';
      }
      return error.message;
    }
    return 'Error desconocido de Groq';
  }

  async extractAppointmentData(transcribedText: string): Promise<ExtractionResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        data: null,
        rawText: transcribedText,
        error: 'Groq API no está configurada. Agrega VITE_GROQ_API_KEY a tu archivo .env',
        confidence: 0,
      };
    }

    try {
      const response = await this.executeWithRetry(async () => {
        const res = await fetch(GROQ_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.model,
            messages: [
              {
                role: 'system',
                content: SYSTEM_PROMPT,
              },
              {
                role: 'user',
                content: transcribedText,
              },
            ],
            temperature: 0.1,
            max_tokens: 500,
            response_format: { type: 'json_object' },
          }),
        });

        if (!res.ok) {
          const errorBody = await res.text();
          throw new Error(`Groq API error ${res.status}: ${errorBody}`);
        }

        return res.json();
      });

      const content = response.choices?.[0]?.message?.content;

      if (!content) {
        return {
          success: false,
          data: null,
          rawText: transcribedText,
          error: 'Respuesta vacía de Groq',
          confidence: 0,
        };
      }

      let parsedData: ExtractedAppointmentData;

      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        const jsonString = jsonMatch ? jsonMatch[0] : content;
        parsedData = JSON.parse(jsonString) as ExtractedAppointmentData;
      } catch {
        return {
          success: false,
          data: null,
          rawText: transcribedText,
          error: 'Error al parsear la respuesta como JSON',
          confidence: 0,
        };
      }

      const hasRequiredFields = parsedData.clientName && parsedData.serviceName;
      const confidence = this.calculateConfidence(parsedData);

      return {
        success: hasRequiredFields && confidence > 0.3,
        data: parsedData,
        rawText: transcribedText,
        error: hasRequiredFields ? null : 'Faltan campos requeridos (nombre del cliente o servicio)',
        confidence,
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        rawText: transcribedText,
        error: this.getErrorMessage(error),
        confidence: 0,
      };
    }
  }

  private calculateConfidence(data: ExtractedAppointmentData): number {
    let score = 0;
    const total = 6;

    if (data.clientName) score++;
    if (data.serviceName) score++;
    if (data.date) score++;
    if (data.time) score++;
    if (data.locationType) score++;
    if (data.workerName) score++;

    return score / total;
  }
}

let groqServiceInstance: GroqService | null = null;

export function getGroqService(): GroqService {
  if (!groqServiceInstance) {
    groqServiceInstance = new GroqService();
  }
  return groqServiceInstance;
}