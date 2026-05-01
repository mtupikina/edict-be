import { PART_OF_SPEECH_VALUES } from '../schemas/word.schema';

function formatPosList(): string {
  return PART_OF_SPEECH_VALUES.map((p) => `'${p}'`).join(', ');
}

/**
 * Instruction prompt for enriching an English headword or **phrase** (translation + metadata).
 * The model must return JSON only; shape must match {@link AiEnrichedWordDto} (Mistral uses `response_format: json_object`).
 *
 * When the input cannot be resolved as English, the model returns `{ enrichmentFailed: true, reason?: string }`
 * (handled before {@link AiEnrichedWordDto} validation).
 */
export function buildWordEnrichmentPrompt(word: string): string {
  const quoted = JSON.stringify(word);
  const pos = formatPosList();
  return `You enrich English headwords and phrases for Ukrainian/Polish learners (dictionary-style metadata).

User input (may be a typo or a multi-word phrase): ${quoted}

Spelling and whether the expression exists:
- If the input is probably a **misspelling** of a real English word or fixed phrase, infer the intended lemma or phrase and enrich **that**. Put **standard dictionary spelling** in JSON field "word" (trimmed; single spaces inside phrases). The "word" field may therefore differ from the raw user input when you corrected a typo.
- If the input is **not** meaningful English—gibberish, random characters, or no defensible guess at a real lexeme or known expression—do **not** invent definitions or translations. Return **only** this JSON object:
  {"enrichmentFailed":true,"reason":"Such a word or expression does not exist or could not be identified."}
  You may replace "reason" with one short English sentence that says the same thing.

Treat multi-word items as one lexical unit (collocation, idiom, phrasal verb, or fixed expression), e.g. "play the guitar", "give up", "sleep like a log". Translate and explain **as a phrase** in Ukrainian and Polish (natural equivalents, not a word-by-word gloss unless that is correct).

Output rules for successful enrichment (single JSON object, no markdown or commentary):
- "word": canonical English spelling you enriched (after typo resolution). For phrases, preserve internal spacing.
- "translation": Ukrainian glosses first, then Polish glosses, in one string. **Do not** prefix with language names or tags (no "Ukrainian:", "Polish:", "UK:", "PL:", etc.). Within each language, separate synonyms or alternatives with commas. Put a **semicolon** between the Ukrainian block and the Polish block. Example shape: "святкувати, відзначати; świętować, obchodzić". Cover the one or two most natural equivalents per language when helpful.
- "description": English definition / explanation.
- "examples": 2–3 sentences at B1–B2 level demonstrating usage (array of strings).
- "partOfSpeech": one of: ${pos} (multi-word idioms or fixed expressions often use **ph** or **ph v**).
- "synonyms" / "antonyms": if meaningful, 2–3 strings each; otherwise [].
- "tags": short semantic tags (e.g. occupation, body part, furniture).
- "transcription": IPA or common dictionary-style transcription for the full English expression (phrase as a whole where applicable).

Morphology (required accuracy):
- **Nouns** (when \`partOfSpeech\` is \`n\`): Set "plural" when the usual plural is **not** formed only by adding **-s** or **-es** to the singular—include **irregular** and stem-changing plurals (e.g. **foot** → **feet**, **child** → **children**, **mouse** → **mice**). For regular plurals such as **book** → **books**, omit "plural".
- **Verbs** (\`v\` or \`ph v\`): Always set "simplePast" and "pastParticiple" to the **correct standard English forms**, including irregular verbs (e.g. **build** → simplePast **built**, pastParticiple **built**; **go** → **went**, **gone**; **sing** → **sang**, **sung**) and regular spelling patterns (**-ed**, consonant doubling, **y→ied**). For **phrasal verbs**, include the particle in both strings (e.g. **give up** → **gave up**, **given up**).

Do not include: studentId, lastVerifiedAt, _id, createdAt, updatedAt, canSpell, canEToU, canUToE, toVerifyNextTime, enrichmentFailed, reason (except in the failure-only response above), or any fields not listed for the success shape.`;
}
