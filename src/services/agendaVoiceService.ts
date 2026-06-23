export interface ExtractedAgendaData {
  targetDate: 'today' | 'tomorrow' | 'specific_date';
  specificDate?: string;
}

export interface AgendaExtractionResult {
  success: boolean;
  data: ExtractedAgendaData | null;
  rawText: string;
  error: string | null;
}

const SYSTEM_PROMPT = `Eres un asistente especializado en interpretar consultas de agenda para un salón de belleza de uñas. Tu tarea es identificar qué día o fechas quiere consultar la usuaria.

Analiza el texto y determina el valor de targetDate y si aplica specificDate:
- "today": La usuaria menciona "hoy", "el día de hoy", "esta jornada", "para hoy", "hoy día", etc.
- "tomorrow": La usuaria menciona "mañana", "el día de mañana", "para mañana", "mañana en la mañana/tarde", etc.
- "specific_date": La usuaria menciona una fecha específica como "el 25 de junio", "el 15 del corriente", "para el 30", "el miercoles 2", etc.

Cuando targetDate sea "specific_date", DEVES incluir specificDate en formato ISO (YYYY-MM-DD).
Calcula la fecha correcta basándote en la fecha actual del sistema y el contexto proporcionado.

REGLAS IMPORTANTES:
1. targetDate solo puede ser: "today", "tomorrow" o "specific_date"
2. Para "specific_date", SIEMPRE calcula y devuelve la fecha en format YYYY-MM-DD
3. Reconoce expresiones como:
   - "el 25" o "el 25 de junio" (si dice solo día, asume el mes actual si ya pasó, o el siguiente si aún no ha llegado)
   - "para el [día]" o "el [día] de [mes]"
   - "miercoles 2" o "martes 15"
4. Ignora preguntas que no sean sobre consultar agenda (ej: "hola", "gracias", "¿qué tal?")
5. La consulta debe ser claramente sobre ver/consultar la agenda
6. Devuelve SOLO el JSON, sin texto adicional, sin explicaciones, sin marcadores de código`;

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

export class AgendaVoiceService {
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

  async extractAgendaQuery(transcribedText: string): Promise<AgendaExtractionResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        data: null,
        rawText: transcribedText,
        error: 'Groq API no está configurada. Agrega VITE_GROQ_API_KEY a tu archivo .env',
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
            max_tokens: 100,
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
        };
      }

      let parsedData: ExtractedAgendaData;

      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        const jsonString = jsonMatch ? jsonMatch[0] : content;
        parsedData = JSON.parse(jsonString) as ExtractedAgendaData;
      } catch {
        return {
          success: false,
          data: null,
          rawText: transcribedText,
          error: 'Error al parsear la respuesta como JSON',
        };
      }

      if (!parsedData.targetDate ||
        (parsedData.targetDate !== 'today' &&
         parsedData.targetDate !== 'tomorrow' &&
         parsedData.targetDate !== 'specific_date')) {
        return {
          success: false,
          data: null,
          rawText: transcribedText,
          error: 'No se pudo identificar el día. Intenta decir "las citas de hoy", "la agenda de mañana" o "las citas del 25 de junio".',
        };
      }

      if (parsedData.targetDate === 'specific_date' && !parsedData.specificDate) {
        return {
          success: false,
          data: null,
          rawText: transcribedText,
          error: 'No se pudo determinar la fecha específica. Intenta decir "las citas del 25 de junio".',
        };
      }

      return {
        success: true,
        data: parsedData,
        rawText: transcribedText,
        error: null,
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        rawText: transcribedText,
        error: this.getErrorMessage(error),
      };
    }
  }
}

let agendaVoiceServiceInstance: AgendaVoiceService | null = null;

export function getAgendaVoiceService(): AgendaVoiceService {
  if (!agendaVoiceServiceInstance) {
    agendaVoiceServiceInstance = new AgendaVoiceService();
  }
  return agendaVoiceServiceInstance;
}