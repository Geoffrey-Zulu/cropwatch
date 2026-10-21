import { GoogleGenAI, type GoogleGenAIOptions } from '@google/genai'
import type { Env } from '../env'
import { DIAGNOSIS_RESPONSE_SCHEMA, type GenerateFn } from './diagnosisModel'

// Gemini through the Google Gen AI SDK on Vertex AI (CLAUDE.md invariant 7), in the project's
// region. On Cloud Run it authenticates as the service account; local tools may pass their
// own auth client.
export function geminiDiagnosisModel(
  env: Pick<Env, 'projectId' | 'location' | 'geminiModel'>,
  googleAuthOptions?: GoogleGenAIOptions['googleAuthOptions']
): GenerateFn {
  const ai = new GoogleGenAI({
    vertexai: true,
    project: env.projectId,
    location: env.location,
    googleAuthOptions,
  })

  return async ({ system, user, photos }) => {
    const response = await ai.models.generateContent({
      model: env.geminiModel,
      contents: [
        {
          role: 'user',
          parts: [
            ...photos.map(photo => ({
              inlineData: { mimeType: photo.mimeType, data: photo.data },
            })),
            { text: user },
          ],
        },
      ],
      config: {
        systemInstruction: system,
        responseMimeType: 'application/json',
        responseJsonSchema: DIAGNOSIS_RESPONSE_SCHEMA,
        temperature: 0.2,
        maxOutputTokens: 4096,
        // Bounded thinking keeps a diagnosis well inside the 30 s demo budget.
        thinkingConfig: { thinkingBudget: 1024 },
        httpOptions: { timeout: 45_000 },
      },
    })
    return { text: response.text ?? '', modelVersion: response.modelVersion ?? null }
  }
}
