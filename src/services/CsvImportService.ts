import { BulkImportData } from '../types';

interface VocabularyCsvRow {
  word: string;
  translation: string;
  context?: string;
  contextTranslated?: string;
  occurrences?: string;
  forms?: string;
}

export interface VocabularyCsvImportResult {
  cards: BulkImportData['cards'];
  skippedRows: number;
  delimiter: string;
  headerRowNumber: number;
}

type ColumnIndexes = Record<keyof VocabularyCsvRow, number>;

const DELIMITER_CANDIDATES = [',', ';', '\t', '|'] as const;
const MAX_HEADER_ROWS = 20;

const HEADER_ALIASES: Record<keyof VocabularyCsvRow, string[]> = {
  word: [
    'word',
    'lemma',
    'term',
    'front',
    'headword',
    'source_word',
    'source_term',
    'original_word',
    'vocabulary_word',
  ],
  translation: [
    'translation',
    'meaning',
    'definition',
    'back',
    'gloss',
    'target_word',
    'translated_word',
  ],
  context: [
    'context',
    'source_context',
    'sentence',
    'example',
    'source_sentence',
    'original_sentence',
    'example_sentence',
    'source_example',
    'original_example',
  ],
  contextTranslated: [
    'context_translated',
    'context_translation',
    'translated_context',
    'translated_sentence',
    'sentence_translation',
    'example_translation',
    'translated_example',
    'target_context',
    'target_sentence',
    'target_example',
  ],
  occurrences: [
    'occurrences',
    'occurrence_count',
    'occurrences_count',
    'count',
    'frequency',
    'frequency_count',
  ],
  forms: [
    'forms',
    'surface_forms',
    'inflected_forms',
    'word_forms',
    'variants',
  ],
};

/**
 * Decode an imported text file without assuming UTF-8. Excel and other desktop
 * tools commonly produce UTF-16 CSV files, which File.text() cannot detect.
 */
export async function readImportFileText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  return decodeText(buffer);
}

export function decodeText(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);

  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  }

  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  }

  const sampleLength = Math.min(bytes.length, 200);
  let evenNulls = 0;
  let oddNulls = 0;

  for (let index = 0; index < sampleLength; index += 1) {
    if (bytes[index] !== 0) continue;
    if (index % 2 === 0) evenNulls += 1;
    else oddNulls += 1;
  }

  if (sampleLength >= 4 && oddNulls > sampleLength / 6 && oddNulls > evenNulls * 2) {
    return new TextDecoder('utf-16le').decode(bytes);
  }

  if (sampleLength >= 4 && evenNulls > sampleLength / 6 && evenNulls > oddNulls * 2) {
    return new TextDecoder('utf-16be').decode(bytes);
  }

  return new TextDecoder('utf-8').decode(bytes);
}

export function parseCsv(text: string): string[][] {
  const source = prepareCsvSource(text);
  const delimiter = source.delimiter ?? detectDelimiter(source.text);
  return parseDelimitedText(source.text, delimiter);
}

export function inspectVocabularyCsv(text: string): VocabularyCsvImportResult {
  const source = prepareCsvSource(text);
  const delimiter = source.delimiter ?? detectDelimiter(source.text);
  const rows = parseDelimitedText(source.text, delimiter);

  if (rows.length < 2) {
    throw new Error('CSV must include a header row and at least one vocabulary row.');
  }

  const headerRowIndex = findHeaderRowIndex(rows);
  if (headerRowIndex === -1) {
    const foundColumns = rows[0].map((header) => header.trim()).filter(Boolean);
    const foundSuffix = foundColumns.length > 0 ? ` Found: ${foundColumns.join(', ')}.` : '';
    throw new Error(
      `CSV must include word and translation columns.${foundSuffix} ` +
        'Supported names include word/lemma/term/front and translation/meaning/definition/back.'
    );
  }

  const headers = rows[headerRowIndex].map(normalizeHeader);
  const indexes = resolveColumnIndexes(headers);
  let skippedRows = 0;

  const cards = rows
    .slice(headerRowIndex + 1)
    .map((cells) => buildVocabularyRow(cells, indexes))
    .filter((row) => {
      const importable = row.word.length > 0 && row.translation.length > 0;
      if (!importable) skippedRows += 1;
      return importable;
    })
    .map((row) => ({
      front: row.word,
      back: buildCardBack(row),
    }));

  if (cards.length === 0) {
    throw new Error(
      'CSV did not contain any importable vocabulary rows. Every card needs both a word and a translation.'
    );
  }

  return {
    cards,
    skippedRows,
    delimiter: displayDelimiter(delimiter),
    headerRowNumber: headerRowIndex + source.lineOffset + 1,
  };
}

export function vocabularyCsvToCards(text: string): BulkImportData['cards'] {
  return inspectVocabularyCsv(text).cards;
}

function prepareCsvSource(text: string): {
  text: string;
  delimiter?: string;
  lineOffset: number;
} {
  const withoutBom = text.replace(/^\uFEFF/, '');
  const firstLineEnd = withoutBom.search(/\r?\n/);
  const firstLine = firstLineEnd === -1 ? withoutBom : withoutBom.slice(0, firstLineEnd);
  const separatorDirective = firstLine.match(/^\s*sep\s*=\s*(.)\s*$/i);

  if (!separatorDirective) {
    return { text: withoutBom, lineOffset: 0 };
  }

  return {
    text: firstLineEnd === -1 ? '' : withoutBom.slice(firstLineEnd).replace(/^\r?\n/, ''),
    delimiter: separatorDirective[1],
    lineOffset: 1,
  };
}

function detectDelimiter(text: string): string {
  let bestDelimiter: string = ',';
  let bestScore = -1;

  for (const delimiter of DELIMITER_CANDIDATES) {
    let rows: string[][];

    try {
      rows = parseDelimitedText(text, delimiter).slice(0, MAX_HEADER_ROWS);
    } catch {
      continue;
    }

    const widths = rows.map((row) => row.length).filter((width) => width > 1);
    if (widths.length === 0) continue;

    const widthCounts = new Map<number, number>();
    for (const width of widths) {
      widthCounts.set(width, (widthCounts.get(width) ?? 0) + 1);
    }

    const [commonWidth, commonWidthRows] = [...widthCounts.entries()].sort(
      (left, right) => right[1] - left[1] || right[0] - left[0]
    )[0];
    const headerScore = rows.reduce(
      (highest, row) => Math.max(highest, scoreHeaderRow(row.map(normalizeHeader))),
      0
    );
    const score = headerScore * 1000 + commonWidthRows * 20 + Math.min(commonWidth, 20);

    if (score > bestScore) {
      bestScore = score;
      bestDelimiter = delimiter;
    }
  }

  return bestDelimiter;
}

function parseDelimitedText(text: string, delimiter: string): string[][] {
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
      } else if (inQuotes) {
        inQuotes = false;
      } else if (field.trim().length === 0) {
        inQuotes = true;
      } else {
        field += char;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
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
    throw new Error('CSV has an unterminated quoted field. Check the last quoted value.');
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((cell) => cell.trim().length > 0));
}

function findHeaderRowIndex(rows: string[][]): number {
  const rowsToInspect = rows.slice(0, MAX_HEADER_ROWS);
  let bestIndex = -1;
  let bestScore = -1;

  rowsToInspect.forEach((row, index) => {
    const headers = row.map(normalizeHeader);
    const indexes = resolveColumnIndexes(headers);
    if (indexes.word === -1 || indexes.translation === -1) return;

    const score = scoreHeaderRow(headers);
    if (score > bestScore) {
      bestIndex = index;
      bestScore = score;
    }
  });

  return bestIndex;
}

function scoreHeaderRow(headers: string[]): number {
  return (Object.keys(HEADER_ALIASES) as Array<keyof VocabularyCsvRow>).reduce(
    (score, key) => score + (findHeaderIndex(headers, key) === -1 ? 0 : 1),
    0
  );
}

function resolveColumnIndexes(headers: string[]): ColumnIndexes {
  return {
    word: findHeaderIndex(headers, 'word'),
    translation: findHeaderIndex(headers, 'translation'),
    context: findHeaderIndex(headers, 'context'),
    contextTranslated: findHeaderIndex(headers, 'contextTranslated'),
    occurrences: findHeaderIndex(headers, 'occurrences'),
    forms: findHeaderIndex(headers, 'forms'),
  };
}

function buildVocabularyRow(cells: string[], indexes: ColumnIndexes): VocabularyCsvRow {
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
  const exactIndex = headers.findIndex((header) => aliases.includes(header));
  if (exactIndex !== -1) return exactIndex;

  if (key === 'translation') {
    return headers.findIndex(
      (header) =>
        header.startsWith('translation_') ||
        header.startsWith('meaning_') ||
        header.startsWith('definition_')
    );
  }

  return -1;
}

function normalizeHeader(header: string): string {
  return header
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '');
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

function displayDelimiter(delimiter: string): string {
  return delimiter === '\t' ? 'tab' : delimiter;
}
