import { GoogleGenAI, Type } from "@google/genai";

let genAI: GoogleGenAI | null = null;

function getGenAI() {
  if (!genAI) {
    // Tenta pegar de várias fontes possíveis
    const apiKey = (process.env?.VITE_GEMINI_API_KEY) || 
                   (process.env?.GEMINI_API_KEY);

    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey === '' || apiKey === 'undefined') {
      throw new Error("Chave Gemini não configurada. Verifique se a variável VITE_GEMINI_API_KEY está definida no seu ambiente e REFAÇA O DEPLOY (Netlify/Vercel).");
    }
    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
}

export interface ParallelismClass {
  deviationCm: number;
  totalPercentage: number;
  details: string[];
}

export interface AnalysisResult {
  classes: ParallelismClass[];
  rawExtractions: Array<{ side: string; deviation: number; percentage: number }>;
  modelUsed?: string;
}

function getDeepSeekApiKey() {
  return process.env?.VITE_DEEPSEEK_API_KEY;
}

async function analyzeWithDeepSeek(fileBase64: string, mimeType: string): Promise<AnalysisResult> {
  const apiKey = getDeepSeekApiKey();
  if (!apiKey) throw new Error("DeepSeek failover: Chave VITE_DEEPSEEK_API_KEY não configurada.");

  // DeepSeek essentially uses OpenAI API format. 
  // We use the chat endpoint with vision if possible, or we might need a specific model string.
  // Note: If using deepseek-chat, it might not support images directly in some API versions.
  // This is a placeholder for the logic.
  
  const prompt = `
    Analise este gráfico de paralelismo. Extraia os desvios (cm) e as porcentagens (%).
    Retorne um JSON com:
    {
      "rawExtractions": [{"side": string, "deviation": number, "percentage": number}],
      "classes": [{"deviationCm": number, "totalPercentage": number, "details": string[]}]
    }
  `;

  const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "deepseek-chat", // Or deepseek-vision if available
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { 
              type: "image_url", 
              image_url: { 
                url: `data:${mimeType};base64,${fileBase64}` 
              } 
            }
          ]
        }
      ],
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`DeepSeek API Error: ${errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const result = JSON.parse(data.choices[0].message.content) as AnalysisResult;
  return { ...result, modelUsed: "DeepSeek-Chat" };
}

export async function analyzeChartFile(
  fileBase64: string,
  mimeType: string
): Promise<AnalysisResult> {
  const model = "gemini-3-flash-preview";

  try {
    const ai = getGenAI();
    const prompt = `
      Analise este gráfico de paralelismo. Extraia todos os desvios de paralelismo mencionados.
      Para cada desvio, identifique:
      1. O valor do desvio em cm (pode ser positivo ou negativo).
      2. A porcentagem (%) associada a esse desvio.
      3. De qual lado ou parte do gráfico isso se refere (ex: esquerda, direita, lado A, lado B).

      Depois de extrair, agrupe os valores pelo VALOR ABSOLUTO do desvio (ex: +5cm e -5cm pertencem à classe de 5cm).
      Some as porcentagens de cada classe.

      Retorne os dados formatados em JSON conforme o esquema solicitado.
    `;

    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          {
            inlineData: {
              data: fileBase64,
              mimeType: mimeType,
            },
          },
          { text: prompt },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            rawExtractions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  side: { type: Type.STRING },
                  deviation: { type: Type.NUMBER },
                  percentage: { type: Type.NUMBER },
                },
                required: ["side", "deviation", "percentage"],
              },
            },
            classes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  deviationCm: { type: Type.NUMBER },
                  totalPercentage: { type: Type.NUMBER },
                  details: {
                     type: Type.ARRAY,
                     items: { type: Type.STRING }
                  }
                },
                required: ["deviationCm", "totalPercentage", "details"],
              },
            },
          },
          required: ["rawExtractions", "classes"],
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error("Falha na análise do modelo.");
    const result = JSON.parse(text) as AnalysisResult;
    return { ...result, modelUsed: "Gemini 3 Flash" };

  } catch (err: any) {
    console.warn("Gemini falhou, tentando DeepSeek...", err);
    
    // Verifica se temos a chave do DeepSeek antes de tentar
    if (!process.env.VITE_DEEPSEEK_API_KEY) {
      console.error("DeepSeek não configurado para fallback.");
      throw err;
    }

    try {
      return await analyzeWithDeepSeek(fileBase64, mimeType);
    } catch (fallbackErr: any) {
      console.error("Erro no fallback DeepSeek:", fallbackErr);
      // Lança um erro que menciona ambos os problemas
      throw new Error(`Falha em ambos os modelos. Gemini: ${err.message}. DeepSeek: ${fallbackErr.message}`);
    }
  }
}
