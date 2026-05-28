import { BulkImportData } from '../types';

interface VocabularyCsvRow {
  word: string;
  translation: string;
  context?: string;
  contextTranslated?: string;
  occurrences?: string;
  forms?: string;
}

const HEADER_ALIASES: Record<keyof VocabularyCsvRow, string[]> = {
  word: ['word', 'lemma', 'term', 'front'],
  translation: ['translation', 'meaning', 'definition', 'back'],
  context: ['context', 'source_context', 'sentence', 'example'],
  contextTranslated: ['context_translated', 'context_translation', 'translated_context'],
  occurrences: ['occurrences', 'occurrence_count', 'count'],
  forms: ['forms', 'surface_forms', 'inflected_forms'],
};

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (char === '"') {
      if (inQuotes && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(field);
      field = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && text[index + 1] === '\n') {
        index += 1;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }

    field += char;
  }

  if (inQuotes) {
    throw new Error('CSV has an unterminated quoted field.');
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((cell) => cell.trim().length > 0));
}

export function vocabularyCsvToCards(text: string): BulkImportData['cards'] {
  const rows = parseCsv(text);
  if (rows.length < 2) {
    throw new Error('CSV must include a header row and at least one vocabulary row.');
  }

  const headers = rows[0].map(normalizeHeader);
  const wordIndex = findHeaderIndex(headers, 'word');
  const translationIndex = findHeaderIndex(headers, 'translation');

  if (wordIndex === -1 || translationIndex === -1) {
    throw new Error('CSV must include word and translation columns.');
  }

  const cards = rows
    .slice(1)
    .map((cells) =>
      buildVocabularyRow(cells, {
        word: wordIndex,
        translation: translationIndex,
        context: findHeaderIndex(headers, 'context'),
        contextTranslated: findHeaderIndex(headers, 'contextTranslated'),
        occurrences: findHeaderIndex(headers, 'occurrences'),
        forms: findHeaderIndex(headers, 'forms'),
      })
    )
    .filter((row) => row.word.length > 0 && row.translation.length > 0)
    .map((row) => ({
      front: row.word,
      back: buildCardBack(row),
    }));

  if (cards.length === 0) {
    throw new Error('CSV did not contain any importable vocabulary rows.');
  }

  return cards;
}

function buildVocabularyRow(
  cells: string[],
  indexes: Record<keyof VocabularyCsvRow, number>
): VocabularyCsvRow {
  return {
    word: valueAt(cells, indexes.word),
    translation: valueAt(cells, indexes.translation),
    context: valueAt(cells, indexes.context),
    contextTranslated: valueAt(cells, indexes.contextTranslated),
    occurrences: valueAt(cells, indexes.occurrences),
    forms: valueAt(cells, indexes.forms),
  };
}

function buildCardBack(row: VocabularyCsvRow): string {
  const sections = [row.translation];

  if (row.context) {
    sections.push(`**Context**\n\n${toBlockquote(row.context)}`);
  }

  if (row.contextTranslated) {
    sections.push(`**Context translation**\n\n${toBlockquote(row.contextTranslated)}`);
  }

  const facts = [
    row.occurrences ? `Occurrences: ${row.occurrences}` : undefined,
    row.forms ? `Forms: ${row.forms}` : undefined,
  ].filter((fact): fact is string => Boolean(fact));

  if (facts.length > 0) {
    sections.push(facts.join('\n'));
  }

  return sections.join('\n\n');
}

function findHeaderIndex(headers: string[], key: keyof VocabularyCsvRow): number {
  const aliases = HEADER_ALIASES[key].map(normalizeHeader);
  return headers.findIndex((header) => aliases.includes(header));
}

function normalizeHeader(header: string): string {
  return header
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function valueAt(cells: string[], index: number): string {
  return index === -1 ? '' : (cells[index] ?? '').trim();
}

function toBlockquote(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => `> ${line}`)
    .join('\n');
}
