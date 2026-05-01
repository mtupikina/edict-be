import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type { AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';

import { buildWordEnrichmentPrompt } from './prompts/word-enrichment.prompt';
import type { WordEnrichResult } from './word-enrichment.types';
import { parseAndValidateAiEnrichedWordJson } from './word-enrichment-parse.util';

const DEFAULT_MISTRAL_MODEL = 'mistral-small-latest';

/** Per-request axios timeout for Mistral chat completions (full request cycle). */
const MISTRAL_HTTP_TIMEOUT_MS = 15_000;

const MISTRAL_CHAT_URL = 'https://api.mistral.ai/v1/chat/completions';

interface MistralChatCompletionResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
  message?: string;
  detail?: string | string[];
}

function mistralHttpErrorMessage(
  parsed: MistralChatCompletionResponse,
  status: number,
): string {
  if (typeof parsed.message === 'string' && parsed.message !== '') {
    return parsed.message;
  }
  if (typeof parsed.detail === 'string' && parsed.detail !== '') {
    return parsed.detail;
  }
  const detailList = parsed.detail;
  if (Array.isArray(detailList) && detailList.length > 0) {
    return detailList.map(String).join('; ');
  }
  return `Mistral request failed with status ${String(status)}`;
}

@Injectable()
export class WordEnrichmentService {
  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpService,
  ) {}

  async enrich(requestedWord: string): Promise<WordEnrichResult> {
    const normalizedWord =
      typeof requestedWord === 'string' ? requestedWord.trim() : '';
    const apiKey = this.config.get<string>('MISTRAL_KEY')?.trim();
    if (!apiKey) {
      return {
        ok: false,
        code: 'AI_UPSTREAM',
        message: 'MISTRAL_KEY is not configured',
        httpStatus: 502,
      };
    }

    const model =
      this.config.get<string>('MISTRAL_MODEL')?.trim() || DEFAULT_MISTRAL_MODEL;
    const prompt = buildWordEnrichmentPrompt(normalizedWord);
    const body = {
      model,
      messages: [{ role: 'user' as const, content: prompt }],
      temperature: 0.2,
      response_format: { type: 'json_object' as const },
    };

    let response: AxiosResponse<unknown>;
    try {
      response = await firstValueFrom(
        this.http.post<unknown>(MISTRAL_CHAT_URL, body, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          timeout: MISTRAL_HTTP_TIMEOUT_MS,
          validateStatus: () => true,
        }),
      );
    } catch (e: unknown) {
      const message = axios.isAxiosError(e)
        ? e.message
        : e instanceof Error
          ? e.message
          : 'Network error';
      return {
        ok: false,
        code: 'AI_UPSTREAM',
        message,
        httpStatus: 502,
      };
    }

    const parsed = response.data as MistralChatCompletionResponse;
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      response?.status >= 400
    ) {
      return {
        ok: false,
        code: 'AI_UPSTREAM',
        message: mistralHttpErrorMessage(parsed, response?.status),
        httpStatus: 502,
      };
    }

    const text = parsed.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || text.length === 0) {
      return {
        ok: false,
        code: 'AI_PARSE',
        message: 'No text in Mistral model response',
        httpStatus: 422,
      };
    }

    return parseAndValidateAiEnrichedWordJson(normalizedWord, text);
  }
}
