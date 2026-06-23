export interface ExtractedClientSearchData {
  clientName: string | null;
}

export interface ClientSearchResult {
  success: boolean;
  data: ExtractedClientSearchData | null;
  rawText: string;
  error: string | null;
  confidence: number;
}

const CLIENT_SEARCH_SYSTEM_PROMPT = `Eres un asistente especializado en buscar clientas en un salón de belleza de uñas.

Tu única tarea es extraer el NOMBRE de la clienta que la manicurista está buscando.

Analiza el texto hablado y extrae el nombre de la clienta siguiendo estas reglas:

REGLAS ESTRICTAS:
1. Busca patrones como: "buscar a [nombre]", "encontrar a [nombre]", "dónde está [nombre]", "mostrar [nombre]", "ficha de [nombre]", "datos de [nombre]"
2. El nombre puede estar al inicio, medio o final del texto
3. Si la frase tiene múltiples nombres, toma el más probable (generalmente el último mencionado o el más completo)
4. Devuelve SOLO el nombre completo de la clienta, sin títulos como "señora", "srta", etc.
5. Si no puedes identificar un nombre claro, devuelve null
6. NO inventes nombres - si no hay un nombre en el texto, usa null

Ejemplos:
- "Buscar a Laura Estévez" → "Laura Estévez"
- "Encontrar la ficha de María González" → "María González"
- "Dónde está Rosa" → "Rosa"
- "Mostrar datos de Ana" → "Ana"
- "Hola qué tal" → null
- "Quiero agendar una cita" → null

Devuelve SOLO el JSON con este formato exacto, sin texto adicional:
{"clientName": "nombre completo de la clienta o null"}`;

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

export class ClientSearchGroqService {
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

  async extractClientName(transcribedText: string): Promise<ClientSearchResult> {
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
                content: CLIENT_SEARCH_SYSTEM_PROMPT,
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
          confidence: 0,
        };
      }

      let parsedData: ExtractedClientSearchData;

      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        const jsonString = jsonMatch ? jsonMatch[0] : content;
        parsedData = JSON.parse(jsonString) as ExtractedClientSearchData;
      } catch {
        return {
          success: false,
          data: null,
          rawText: transcribedText,
          error: 'Error al parsear la respuesta como JSON',
          confidence: 0,
        };
      }

      const hasClientName = parsedData.clientName && parsedData.clientName.trim().length > 0;
      const confidence = hasClientName ? 1 : 0;

      return {
        success: hasClientName,
        data: parsedData,
        rawText: transcribedText,
        error: hasClientName ? null : 'No se pudo identificar un nombre de clienta en el comando de voz',
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
}

let clientSearchGroqServiceInstance: ClientSearchGroqService | null = null;

export function getClientSearchGroqService(): ClientSearchGroqService {
  if (!clientSearchGroqServiceInstance) {
    clientSearchGroqServiceInstance = new ClientSearchGroqService();
  }
  return clientSearchGroqServiceInstance;
}