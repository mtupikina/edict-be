import { isKnownWell, WordSchema } from './word.schema';

describe('WordSchema knownWell', () => {
  it('is an optional boolean with no default', () => {
    const path = WordSchema.path('knownWell');

    expect(path.instance).toBe('Boolean');
    expect(path.isRequired).toBeFalsy();
    expect(path.options.default).toBeUndefined();
  });
});

describe('isKnownWell', () => {
  it('is true only when the stored value is true', () => {
    expect(isKnownWell(true)).toBe(true);
  });

  it('treats false, null, and a missing value as not known well', () => {
    expect(isKnownWell(false)).toBe(false);
    expect(isKnownWell(null)).toBe(false);
    expect(isKnownWell(undefined)).toBe(false);
  });
});
