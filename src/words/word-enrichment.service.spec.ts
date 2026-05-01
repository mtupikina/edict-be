import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import type { AxiosResponse } from 'axios';
import { AxiosError } from 'axios';
import { of, throwError } from 'rxjs';

import { WordEnrichmentService } from './word-enrichment.service';

function axResponse<T>(data: T, status: number): AxiosResponse<T> {
  return {
    data,
    status,
    statusText: status < 400 ? 'OK' : 'Error',
    headers: {},
    config: {} as never,
  };
}

function postAxiosConfig(
  mockPost: jest.Mock,
): Record<string, unknown> | undefined {
  const row = mockPost.mock.calls[0] as
    | [string, unknown, Record<string, unknown>?]
    | undefined;
  return row?.[2];
}

function postUrl(mockPost: jest.Mock): string {
  const row = mockPost.mock.calls[0] as [string] | undefined;
  return row?.[0] ?? '';
}

function postBody<T>(mockPost: jest.Mock): T {
  const row = mockPost.mock.calls[0] as [string, T] | undefined;
  return row?.[1] as T;
}

function successPayload(word: string) {
  return {
    word,
    translation: 'стілець; krzesło',
    description: 'A piece of furniture for sitting.',
    examples: ['She pulled up a chair.', 'He fixed the broken chair.'],
    partOfSpeech: 'n',
    synonyms: ['seat'],
    antonyms: ['floor'],
    tags: ['furniture'],
    transcription: '/tʃeə(r)/',
  };
}

describe('WordEnrichmentService', () => {
  let service: WordEnrichmentService;
  const mockHttp = { post: jest.fn() };

  const mockConfig = {
    get: jest.fn((key: string, defaultValue?: string) => {
      if (key === 'MISTRAL_KEY') {
        return 'test-mistral-key';
      }
      if (key === 'MISTRAL_MODEL') {
        return defaultValue;
      }
      return defaultValue;
    }),
  };

  async function compileService(): Promise<WordEnrichmentService> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WordEnrichmentService,
        { provide: ConfigService, useValue: mockConfig },
        { provide: HttpService, useValue: mockHttp },
      ],
    }).compile();
    return module.get(WordEnrichmentService);
  }

  beforeEach(async () => {
    mockHttp.post.mockReset();
    mockConfig.get.mockImplementation((key: string, defaultValue?: string) => {
      if (key === 'MISTRAL_KEY') {
        return 'test-mistral-key';
      }
      if (key === 'MISTRAL_MODEL') {
        return defaultValue;
      }
      return defaultValue;
    });
    service = await compileService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return AI_UPSTREAM when MISTRAL_KEY is missing', async () => {
    const localConfig = {
      get: jest.fn((key: string, defaultValue?: string) => {
        if (key === 'MISTRAL_KEY') {
          return '  ';
        }
        return defaultValue;
      }),
    };
    const mod = await Test.createTestingModule({
      providers: [
        WordEnrichmentService,
        { provide: ConfigService, useValue: localConfig },
        { provide: HttpService, useValue: mockHttp },
      ],
    }).compile();
    const s = mod.get(WordEnrichmentService);
    const result = await s.enrich('chair');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('AI_UPSTREAM');
      expect(result.message).toContain('MISTRAL_KEY');
    }
    expect(mockHttp.post).not.toHaveBeenCalled();
  });

  it('should return enriched data when Mistral returns valid JSON', async () => {
    const payload = successPayload('chair');
    mockHttp.post.mockReturnValue(
      of(
        axResponse(
          {
            choices: [{ message: { content: JSON.stringify(payload) } }],
          },
          200,
        ),
      ),
    );

    const result = await service.enrich('chair');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.word).toBe('chair');
    }
    expect(mockHttp.post).toHaveBeenCalledTimes(1);
    const url = postUrl(mockHttp.post);
    expect(url).toContain('api.mistral.ai');
    expect(postAxiosConfig(mockHttp.post)?.headers).toMatchObject({
      Authorization: 'Bearer test-mistral-key',
    });
    expect(postAxiosConfig(mockHttp.post)).toMatchObject({ timeout: 15_000 });
  });

  it('should use MISTRAL_MODEL from config when set', async () => {
    mockConfig.get.mockImplementation((key: string, defaultValue?: string) => {
      if (key === 'MISTRAL_KEY') {
        return 'k';
      }
      if (key === 'MISTRAL_MODEL') {
        return 'mistral-large-latest';
      }
      return defaultValue;
    });
    const s = await compileService();
    mockHttp.post.mockReturnValue(
      of(
        axResponse(
          {
            choices: [
              { message: { content: JSON.stringify(successPayload('a')) } },
            ],
          },
          200,
        ),
      ),
    );
    await s.enrich('a');
    const body = postBody<{ model: string }>(mockHttp.post);
    expect(body.model).toBe('mistral-large-latest');
  });

  it('should return AI_UPSTREAM when Mistral returns detail array', async () => {
    mockHttp.post.mockReturnValue(
      of(
        axResponse(
          {
            detail: ['invalid model', 'check docs'],
          },
          400,
        ),
      ),
    );

    const result = await service.enrich('x');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('invalid model');
    }
  });

  it('should return AI_UPSTREAM when Mistral HTTP status is not ok', async () => {
    mockHttp.post.mockReturnValue(
      of(axResponse({ message: 'Unauthorized' }, 401)),
    );

    const result = await service.enrich('x');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('AI_UPSTREAM');
      expect(result.message).toContain('Unauthorized');
    }
  });

  it('should return AI_PARSE when Mistral response has no message content', async () => {
    mockHttp.post.mockReturnValue(of(axResponse({ choices: [{}] }, 200)));

    const result = await service.enrich('chair');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('AI_PARSE');
      expect(result.message).toContain('Mistral');
    }
  });

  it('should return AI_UPSTREAM when http post throws AxiosError (non-timeout)', async () => {
    mockHttp.post.mockReturnValue(
      throwError(
        () => new AxiosError('Service Unavailable', 'ERR_BAD_RESPONSE'),
      ),
    );
    const result = await service.enrich('chair');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('Service Unavailable');
    }
  });

  it('should return AI_UPSTREAM when http post throws a non-Abort error', async () => {
    mockHttp.post.mockReturnValue(throwError(() => new Error('ECONNRESET')));
    const result = await service.enrich('chair');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('ECONNRESET');
    }
  });

  it('should return AI_UPSTREAM when http post throws a non-Error', async () => {
    mockHttp.post.mockReturnValue(throwError(() => 'boom'));
    const result = await service.enrich('chair');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe('Network error');
    }
  });

  it('should return AI_UPSTREAM when Mistral returns detail string', async () => {
    mockHttp.post.mockReturnValue(
      of(axResponse({ detail: 'bad request body' }, 422)),
    );

    const result = await service.enrich('x');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('bad request body');
    }
  });

  it('should fall back to status when Mistral error has no message or detail', async () => {
    mockHttp.post.mockReturnValue(of(axResponse({}, 503)));

    const result = await service.enrich('x');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('503');
    }
  });

  it('should return AI_UPSTREAM with 502 when request times out (axios error)', async () => {
    mockHttp.post.mockReturnValue(
      throwError(() => new AxiosError('timeout', 'ECONNABORTED')),
    );
    const result = await service.enrich('chair');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.httpStatus).toBe(502);
      expect(result.message).toBe('timeout');
    }
  });
});
