describe('vocabulary file import', () => {
  beforeEach(() => {
    cy.visit('/import');
    cy.clearLocalStorage();
    cy.reload();
  });

  it('imports an Excel-style semicolon CSV into a new deck', () => {
    const csv = [
      'sep=;',
      'lemma;translation_ru;source_sentence;translated_sentence;frequency;word_forms',
      'compiler;компилятор;The compiler emitted a warning.;Компилятор выдал предупреждение.;3;compilers',
    ].join('\r\n');

    cy.get('#file-input').selectFile(
      {
        contents: Cypress.Buffer.from(csv),
        fileName: 'vocabulary.csv',
        mimeType: 'text/csv',
      },
      { force: true }
    );

    cy.contains('Imported 1 vocabulary card.').should('be.visible');
    cy.window().should((window) => {
      const decks = JSON.parse(window.localStorage.getItem('flashcards_decks') ?? '[]');
      expect(decks).to.have.length(1);
      expect(decks[0].cards[0].front).to.equal('compiler');
      expect(decks[0].cards[0].back).to.contain('компилятор');
    });
  });

  it('shows the parser error and allows retrying the same filename', () => {
    cy.get('#file-input').selectFile(
      {
        contents: Cypress.Buffer.from('unknown,count\nvalue,1'),
        fileName: 'vocabulary.csv',
        mimeType: 'text/csv',
      },
      { force: true }
    );

    cy.get('[role="alert"]')
      .should('be.visible')
      .and('contain.text', 'CSV must include word and translation columns.')
      .and('contain.text', 'Found: unknown, count.');

    cy.get('#file-input').selectFile(
      {
        contents: Cypress.Buffer.from('word,translation\ncache,кэш'),
        fileName: 'vocabulary.csv',
        mimeType: 'text/csv',
      },
      { force: true }
    );

    cy.contains('Imported 1 vocabulary card.').should('be.visible');
  });
});
