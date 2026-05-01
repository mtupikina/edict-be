import { parseAndValidateAiEnrichedWordJson } from './word-enrichment-parse.util';

describe('parseAndValidateAiEnrichedWordJson', () => {
  it('returns WORD_UNKNOWN when model signals enrichmentFailed', async () => {
    const text = JSON.stringify({
      enrichmentFailed: true,
      reason: 'Custom reason.',
    });
    const result = await parseAndValidateAiEnrichedWordJson('xyzabc', text);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('WORD_UNKNOWN');
      expect(result.message).toBe('Custom reason.');
      expect(result.httpStatus).toBe(404);
    }
  });

  it('returns WORD_UNKNOWN with default message when reason is missing', async () => {
    const text = JSON.stringify({ enrichmentFailed: true });
    const result = await parseAndValidateAiEnrichedWordJson('qwertyui', text);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('WORD_UNKNOWN');
      expect(result.message).toContain('does not exist');
    }
  });

  it('allows word field to differ from request when typo corrected', async () => {
    const text = JSON.stringify({
      word: 'build',
      translation: 'будувати; budować',
      partOfSpeech: 'v',
      simplePast: 'built',
      pastParticiple: 'built',
      examples: ['They built a house.', 'It was built last year.'],
    });
    const result = await parseAndValidateAiEnrichedWordJson('buuld', text);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.word).toBe('build');
    }
  });

  it('returns ok for valid payload', async () => {
    const text = JSON.stringify({
      word: 'chair',
      translation: 'стілець; krzesło',
      partOfSpeech: 'n',
    });
    const result = await parseAndValidateAiEnrichedWordJson('chair', text);
    expect(result.ok).toBe(true);
  });

  it('returns AI_PARSE for invalid JSON', async () => {
    const result = await parseAndValidateAiEnrichedWordJson(
      'chair',
      'not json',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('AI_PARSE');
    }
  });

  it('should return AI_PARSE when validation has nested errors', async () => {
    const text = JSON.stringify({
      word: 'chair',
      synonyms: [{ not: 'a string' } as unknown as string],
    });
    const result = await parseAndValidateAiEnrichedWordJson('chair', text);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('AI_PARSE');
    }
  });
});
