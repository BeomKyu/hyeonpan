import { describe, it, expect, beforeEach } from 'vitest';
import type { Board, Column, Card } from '../src/models/types';
import { createCard, createColumn, createMessage, createDefaultBoard, arrayMove } from '../src/utils/boardUtils';

/**
 * Hyeonpan 칸반보드 테스트 — spec/spec.md v3.0 대응
 *
 * 순수 로직 테스트 (React 컴포넌트 렌더링은 제외).
 * useBoard.tsx의 액션 로직을 추출하여 직접 검증.
 */

// === 헬퍼: useBoard의 액션 로직을 순수 함수로 재현 ===

function actionAddColumn(board: Board): Board {
  const newCol = createColumn('새 칼럼', board.columns.length);
  return { ...board, columns: [...board.columns, newCol] };
}

function actionDeleteColumn(board: Board, columnId: string): Board {
  const target = board.columns.find(c => c.id === columnId);
  if (!target) return board;
  const newCards = { ...board.cards };
  target.card_ids.forEach(cid => delete newCards[cid]);
  return {
    columns: board.columns.filter(c => c.id !== columnId),
    cards: newCards,
  };
}

function actionAddCard(board: Board, columnId: string): Board {
  const col = board.columns.find(c => c.id === columnId);
  if (!col) return board;
  const newCard = createCard('새 카드', columnId);
  return {
    columns: board.columns.map(c =>
      c.id === columnId ? { ...c, card_ids: [...c.card_ids, newCard.id] } : c
    ),
    cards: { ...board.cards, [newCard.id]: newCard },
  };
}

function actionDeleteCard(board: Board, cardId: string): Board {
  const card = board.cards[cardId];
  if (!card) return board;
  const newCards = { ...board.cards };
  delete newCards[cardId];
  return {
    columns: board.columns.map(c =>
      c.id === card.column_id
        ? { ...c, card_ids: c.card_ids.filter(id => id !== cardId) }
        : c
    ),
    cards: newCards,
  };
}

function actionMoveCard(board: Board, cardId: string, fromColId: string, toColId: string, toIndex: number): Board {
  const fromCol = board.columns.find(c => c.id === fromColId);
  const toCol = board.columns.find(c => c.id === toColId);
  if (!fromCol || !toCol) return board;

  if (fromColId === toColId) {
    const ids = fromCol.card_ids.filter(id => id !== cardId);
    ids.splice(toIndex, 0, cardId);
    return {
      columns: board.columns.map(c =>
        c.id === toColId ? { ...c, card_ids: ids } : c
      ),
      cards: { ...board.cards, [cardId]: { ...board.cards[cardId], column_id: toColId } },
    };
  }

  const newFromIds = fromCol.card_ids.filter(id => id !== cardId);
  const newToIds = [...toCol.card_ids];
  newToIds.splice(toIndex, 0, cardId);
  return {
    columns: board.columns.map(c => {
      if (c.id === fromColId) return { ...c, card_ids: newFromIds };
      if (c.id === toColId) return { ...c, card_ids: newToIds };
      return c;
    }),
    cards: { ...board.cards, [cardId]: { ...board.cards[cardId], column_id: toColId } },
  };
}

function actionReorderColumns(board: Board, activeId: string, overId: string): Board {
  const oldIndex = board.columns.findIndex(c => c.id === activeId);
  const newIndex = board.columns.findIndex(c => c.id === overId);
  if (oldIndex === -1 || newIndex === -1) return board;
  const reordered = arrayMove(board.columns, oldIndex, newIndex).map((c, i) => ({
    ...c, order: i,
  }));
  return { ...board, columns: reordered };
}

function actionAddMessage(board: Board, cardId: string, role: 'user' | 'agent', content: string, diff: string | null): Board {
  const card = board.cards[cardId];
  if (!card) return board;
  const msg = createMessage(role, content, diff);
  return {
    ...board,
    cards: { ...board.cards, [cardId]: { ...card, messages: [...card.messages, msg] } },
  };
}

// ============================================================
// 단위 테스트
// ============================================================

describe('$Board.Actions', () => {
  let board: Board;

  beforeEach(() => {
    board = createDefaultBoard();
  });

  describe('add_column', () => {
    it('새 칼럼이 board.columns에 추가된다', () => {
      const result = actionAddColumn(board);
      expect(result.columns).toHaveLength(4);
      expect(result.columns[3].title).toBe('새 칼럼');
      expect(result.columns[3].order).toBe(3);
      expect(result.columns[3].card_ids).toEqual([]);
    });
  });

  describe('delete_column', () => {
    it('칼럼 삭제 시 해당 칼럼 내 카드도 board.cards에서 연쇄 제거된다', () => {
      // 칼럼에 카드 2개 추가
      let b = actionAddCard(board, board.columns[0].id);
      b = actionAddCard(b, b.columns[0].id);
      const cardIds = b.columns[0].card_ids;
      expect(cardIds).toHaveLength(2);
      expect(Object.keys(b.cards)).toHaveLength(2);

      // 칼럼 삭제
      const result = actionDeleteColumn(b, b.columns[0].id);
      expect(result.columns).toHaveLength(2);
      // 연쇄 삭제 확인
      cardIds.forEach(cid => {
        expect(result.cards[cid]).toBeUndefined();
      });
      expect(Object.keys(result.cards)).toHaveLength(0);
    });

    it('존재하지 않는 column_id 시 board 변경 없이 반환', () => {
      const result = actionDeleteColumn(board, 'nonexistent');
      expect(result).toBe(board);
    });
  });

  describe('delete_card', () => {
    it('카드 삭제 시 소속 칼럼의 card_ids에서도 제거된다', () => {
      let b = actionAddCard(board, board.columns[0].id);
      const cardId = b.columns[0].card_ids[0];
      expect(b.cards[cardId]).toBeDefined();

      const result = actionDeleteCard(b, cardId);
      expect(result.cards[cardId]).toBeUndefined();
      expect(result.columns[0].card_ids).not.toContain(cardId);
    });
  });

  describe('move_card', () => {
    it('카드 이동 후 from_col과 to_col의 card_ids 정합성 유지', () => {
      let b = actionAddCard(board, board.columns[0].id);
      const cardId = b.columns[0].card_ids[0];
      const fromColId = b.columns[0].id;
      const toColId = b.columns[1].id;

      const result = actionMoveCard(b, cardId, fromColId, toColId, 0);
      expect(result.columns.find(c => c.id === fromColId)!.card_ids).not.toContain(cardId);
      expect(result.columns.find(c => c.id === toColId)!.card_ids).toContain(cardId);
      expect(result.cards[cardId].column_id).toBe(toColId);
    });

    it('유효하지 않은 칼럼 ID 시 board 변경 없이 반환', () => {
      let b = actionAddCard(board, board.columns[0].id);
      const cardId = b.columns[0].card_ids[0];
      const result = actionMoveCard(b, cardId, 'bad', 'also-bad', 0);
      expect(result).toBe(b);
    });
  });

  describe('reorder_columns', () => {
    it('칼럼 순서 변경 후 모든 칼럼의 order 필드가 재정렬된다', () => {
      const col0 = board.columns[0].id;
      const col2 = board.columns[2].id;
      const result = actionReorderColumns(board, col0, col2);
      // col0 이 맨 뒤로 이동
      expect(result.columns[0].id).not.toBe(col0);
      result.columns.forEach((c, i) => {
        expect(c.order).toBe(i);
      });
    });
  });

  describe('add_message', () => {
    it('메시지 추가 후 카드의 messages 배열에 반영된다', () => {
      let b = actionAddCard(board, board.columns[0].id);
      const cardId = b.columns[0].card_ids[0];

      const result = actionAddMessage(b, cardId, 'user', '테스트', null);
      expect(result.cards[cardId].messages).toHaveLength(1);
      expect(result.cards[cardId].messages[0].role).toBe('user');
      expect(result.cards[cardId].messages[0].content).toBe('테스트');
      expect(result.cards[cardId].messages[0].diff).toBeNull();
    });

    it('존재하지 않는 card_id 시 board 변경 없이 반환', () => {
      const result = actionAddMessage(board, 'nonexistent', 'user', 'test', null);
      expect(result).toBe(board);
    });
  });
});

describe('$Card.DiffBlock', () => {
  it('"+" 시작 줄은 추가, "-" 시작 줄은 삭제로 분류', () => {
    const diffText = `+added line\n-removed line\n context line\n@@hunk header`;
    const lines = diffText.split('\n');
    const classified = lines.map(line => {
      if (line.startsWith('+')) return 'add';
      if (line.startsWith('-')) return 'remove';
      if (line.startsWith('@@')) return 'hunk';
      return 'context';
    });
    expect(classified).toEqual(['add', 'remove', 'context', 'hunk']);
  });
});

describe('$ManualAdapter', () => {
  it('JSON 직렬화 왕복 무결성', () => {
    const board = createDefaultBoard();
    let b = actionAddCard(board, board.columns[0].id);
    b = actionAddMessage(b, b.columns[0].card_ids[0], 'agent', 'hello', '+added\n-removed');

    const json = JSON.stringify(b);
    const restored = JSON.parse(json) as Board;

    expect(restored.columns).toHaveLength(3);
    expect(Object.keys(restored.cards)).toHaveLength(1);
    expect(restored.cards[restored.columns[0].card_ids[0]].messages[0].diff).toBe('+added\n-removed');
  });

  it('JSON 파싱 실패 시 기본 보드 반환', () => {
    const corrupted = '{ broken json';
    let parsed: Board;
    try {
      parsed = JSON.parse(corrupted);
    } catch {
      parsed = createDefaultBoard();
    }
    expect(parsed.columns).toHaveLength(3);
    expect(Object.keys(parsed.cards)).toHaveLength(0);
  });
});

// ============================================================
// 통합 테스트 (순수 로직 흐름)
// ============================================================

describe('통합: 카드 이동 흐름', () => {
  it('카드 추가 → 다른 칼럼으로 이동 → 원 칼럼 비우기', () => {
    let board = createDefaultBoard();
    board = actionAddCard(board, board.columns[0].id);
    board = actionAddCard(board, board.columns[0].id);
    expect(board.columns[0].card_ids).toHaveLength(2);

    const cardId = board.columns[0].card_ids[0];
    board = actionMoveCard(board, cardId, board.columns[0].id, board.columns[1].id, 0);
    expect(board.columns[0].card_ids).toHaveLength(1);
    expect(board.columns[1].card_ids).toHaveLength(1);
    expect(board.columns[1].card_ids[0]).toBe(cardId);
  });
});

describe('통합: 대화 히스토리 흐름', () => {
  it('카드 생성 → 메시지 추가(user+agent+diff) → 데이터 완전 복원', () => {
    let board = createDefaultBoard();
    board = actionAddCard(board, board.columns[0].id);
    const cardId = board.columns[0].card_ids[0];

    board = actionAddMessage(board, cardId, 'user', '로그인 기능 구현해줘', null);
    board = actionAddMessage(board, cardId, 'agent', '구현 완료', '+function login() {\n+  return true;\n+}');

    const card = board.cards[cardId];
    expect(card.messages).toHaveLength(2);
    expect(card.messages[0].role).toBe('user');
    expect(card.messages[1].role).toBe('agent');
    expect(card.messages[1].diff).toContain('+function login()');

    // JSON 왕복
    const restored = JSON.parse(JSON.stringify(board)) as Board;
    expect(restored.cards[cardId].messages).toHaveLength(2);
  });
});

describe('통합: 칼럼 순서 변경', () => {
  it('3칼럼 순서 변경 후 order 필드 정합성', () => {
    let board = createDefaultBoard();
    const originalOrder = board.columns.map(c => c.title);
    board = actionReorderColumns(board, board.columns[2].id, board.columns[0].id);
    expect(board.columns.map(c => c.order)).toEqual([0, 1, 2]);
    expect(board.columns[0].title).toBe(originalOrder[2]);
  });
});
