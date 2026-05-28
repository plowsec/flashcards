import { parseCsv, vocabularyCsvToCards } from './CsvImportService';

describe('CsvImportService', () => {
  test('parses quoted commas, quotes, and multiline fields', () => {
    const rows = parseCsv('word,translation,context\nход,"move, turn","He said ""check""\nthen moved"');

    expect(rows).toEqual([
      ['word', 'translation', 'context'],
      ['ход', 'move, turn', 'He said "check"\nthen moved'],
    ]);
  });

  test('converts vocabulary CSV rows into markdown cards', () => {
    const cards = vocabularyCsvToCards(
      [
        'word,translation,context,context_translated,occurrences,forms',
        'слон,bishop,"Белый слон берет коня.","The white bishop takes the knight.",135,"слон; слона"',
      ].join('\n')
    );

    expect(cards).toHaveLength(1);
    expect(cards[0].front).toBe('слон');
    expect(cards[0].back).toContain('bishop');
    expect(cards[0].back).toContain('**Context**');
    expect(cards[0].back).toContain('> Белый слон берет коня.');
    expect(cards[0].back).toContain('**Context translation**');
    expect(cards[0].back).toContain('> The white bishop takes the knight.');
    expect(cards[0].back).toContain('Occurrences: 135');
    expect(cards[0].back).toContain('Forms: слон; слона');
  });

  test('requires word and translation columns', () => {
    expect(() => vocabularyCsvToCards('front_only\nслон')).toThrow(
      'CSV must include word and translation columns.'
    );
  });
});
