import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';

import { AiEnrichedWordDto } from './dto/ai-enriched-word.dto';
import type { WordEnrichResult } from './word-enrichment.types';

function flattenValidationErrors(errors: ValidationError[]): string[] {
  const out: string[] = [];
  for (const err of errors) {
    if (err.constraints) {
      out.push(...Object.values(err.constraints));
    }
    if (err.children?.length) {
      out.push(...flattenValidationErrors(err.children));
    }
  }
  return out;
}

/**
 * Parses model JSON text and validates it as {@link AiEnrichedWordDto}.
 * Used by {@link WordEnrichmentService}.
 */
export async function parseAndValidateAiEnrichedWordJson(
  normalizedWord: string,
  text: string,
): Promise<WordEnrichResult> {
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    return {
      ok: false,
      code: 'AI_PARSE',
      message: 'Model output is not valid JSON',
      httpStatus: 422,
    };
  }

  if (
    typeof raw === 'object' &&
    raw !== null &&
    (raw as Record<string, unknown>).enrichmentFailed === true
  ) {
    const r = (raw as Record<string, unknown>).reason;
    const message =
      typeof r === 'string' && r.trim() !== ''
        ? r.trim()
        : 'Such a word or expression does not exist, or it could not be identified.';
    return {
      ok: false,
      code: 'WORD_UNKNOWN',
      message,
      httpStatus: 404,
    };
  }

  const dto = plainToInstance(AiEnrichedWordDto, raw, {
    enableImplicitConversion: true,
  });
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  if (errors.length > 0) {
    const messages = flattenValidationErrors(errors);
    return {
      ok: false,
      code: 'AI_PARSE',
      message: messages.length > 0 ? messages.join('; ') : 'Invalid payload',
      httpStatus: 422,
    };
  }

  return { ok: true, data: dto };
}
