const longAnswer = [
  'virtual',
  '',
  '**Context**',
  '',
  ...Array.from(
    { length: 14 },
    (_, index) =>
      `> This is a deliberately long imported context paragraph ${index + 1}. It verifies that the answer can scroll without pushing the recall controls off screen.`
  ),
  '',
  'Occurrences: 35',
  'Forms: virtual, virtually, virtualization',
].join('\n');

const deck = {
  id: 'left-handed-study-deck',
  name: 'Long vocabulary contexts',
  description: 'Study layout fixture',
  folderIds: [],
  createdAt: new Date('2026-01-01').toISOString(),
  updatedAt: new Date('2026-01-01').toISOString(),
  cards: [
    {
      id: 'long-card',
      front: 'виртуальный',
      back: longAnswer,
      easeFactor: 2.5,
      interval: 0,
      repetitions: 0,
      nextReviewDate: new Date('2026-01-01').toISOString(),
      difficulty: 'unknown',
      createdAt: new Date('2026-01-01').toISOString(),
      updatedAt: new Date('2026-01-01').toISOString(),
    },
  ],
};

const openLongAnswer = () => {
  cy.visit('/study/left-handed-study-deck', {
    onBeforeLoad(window) {
      window.localStorage.setItem('flashcards_decks', JSON.stringify([deck]));
    },
  });
  cy.contains('ion-button', 'Start Study Session').click();
  cy.contains('ion-button', 'Show Answer').click();
};

describe('reachable recall controls', () => {
  it('keeps ratings visible on a phone and puts Easy on the left', () => {
    cy.viewport(390, 844);
    openLongAnswer();

    cy.get('.study-rating-footer').should('be.visible');
    cy.get('.rating-btn-simple').should('have.length', 3);
    cy.get('.rating-btn-simple').eq(0).should('have.attr', 'color', 'success').and('contain', 'Easy');
    cy.get('.rating-btn-simple').eq(1).should('have.attr', 'color', 'warning').and('contain', 'Hard');
    cy.get('.rating-btn-simple').eq(2).should('have.attr', 'color', 'danger').and('contain', 'Again');

    cy.window().then((appWindow) => {
      cy.get('.study-rating-footer').then(($footer) => {
        const footer = $footer[0].getBoundingClientRect();
        expect(footer.top).to.be.greaterThan(0);
        expect(footer.bottom).to.be.at.most(appWindow.innerHeight + 1);
      });
    });

    cy.get('.rating-btn-simple').then(($buttons) => {
      const easy = $buttons[0].getBoundingClientRect();
      const again = $buttons[2].getBoundingClientRect();
      expect(easy.left).to.be.lessThan(again.left);
    });

    cy.get('.flashcard-answer .card-content-display').should(($answer) => {
      expect($answer[0].scrollHeight).to.be.greaterThan($answer[0].clientHeight);
    });

    cy.screenshot('study-rating-mobile');
  });

  it('keeps the same left-handed order on desktop', () => {
    cy.viewport(1280, 800);
    openLongAnswer();

    cy.get('.rating-btn-simple').then(($buttons) => {
      expect($buttons[0]).to.contain.text('Easy');
      expect($buttons[2]).to.contain.text('Again');
      expect($buttons[0].getBoundingClientRect().left).to.be.lessThan(
        $buttons[2].getBoundingClientRect().left
      );
    });

    cy.screenshot('study-rating-desktop');
    cy.get('.rating-btn-simple').eq(0).click();
    cy.contains('Session Complete!').should('be.visible');
    cy.contains('You studied 1 cards and got 1 correct (100%).').should('be.visible');
    cy.window().should((window) => {
      const sessions = JSON.parse(window.localStorage.getItem('flashcards_study_sessions') ?? '[]');
      expect(sessions).to.have.length(1);
      expect(sessions[0].cardsStudied).to.equal(1);
      expect(sessions[0].correctAnswers).to.equal(1);
    });
  });
});
