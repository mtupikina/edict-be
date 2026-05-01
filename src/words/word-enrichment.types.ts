import type { AiEnrichedWordDto } from './dto/ai-enriched-word.dto';

export type WordEnrichErrorCode = 'AI_UPSTREAM' | 'AI_PARSE' | 'WORD_UNKNOWN';

export type WordEnrichSuccessResponse = {
  success: true;
  data: AiEnrichedWordDto;
};

export type WordEnrichErrorBody = {
  success: false;
  error: {
    code: WordEnrichErrorCode;
    message: string;
  };
};

export type WordEnrichResult =
  | { ok: true; data: AiEnrichedWordDto }
  | {
      ok: false;
      code: WordEnrichErrorCode;
      message: string;
      httpStatus: number;
    };
