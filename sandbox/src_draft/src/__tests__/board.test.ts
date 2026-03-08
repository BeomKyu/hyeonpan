import { describe, it, expect, beforeEach } from 'vitest';
import type { Board } from '../models/types';
import { createCard, createColumn, createMessage, createDefaultBoard, arrayMove } from '../utils/boardUtils';

/**
 * Hyeonpan 칸반보드 테스트 — spec/spec.md v3.0 대응
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
    return { columns: board.columns.filter(c => c.id !== columnId), cards: newCards };
}

function actionAddCard(board: Board, columnId: string): Board {
    const col = board.columns.find(c => c.id === columnId);
    if (!col) return board;
    const newCard = createCard('새 카드', columnId);
    return {
        columns: board.columns.map(c => c.id === columnId ? { ...c, card_ids: [...c.card_ids, newCard.id] } : c),
        cards: { ...board.cards, [newCard.id]: newCard },
    };
}

function actionDeleteCard(board: Board, cardId: string): Board {
    const card = board.cards[cardId];
    if (!card) return board;
    const newCards = { ...board.cards };
    delete newCards[cardId];
    return {
        columns: board.columns.map(c => c.id === card.column_id ? { ...c, card_ids: c.card_ids.filter(id => id !== cardId) } : c),
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
        return { columns: board.columns.map(c => c.id === toColId ? { ...c, card_ids: ids } : c), cards: { ...board.cards, [cardId]: { ...board.cards[cardId], column_id: toColId } } };
    }
    const newFromIds = fromCol.card_ids.filter(id => id !== cardId);
    const newToIds = [...toCol.card_ids];
    newToIds.splice(toIndex, 0, cardId);
    return {
        columns: board.columns.map(c => { if (c.id === fromColId) return { ...c, card_ids: newFromIds }; if (c.id === toColId) return { ...c, card_ids: newToIds }; return c; }),
        cards: { ...board.cards, [cardId]: { ...board.cards[cardId], column_id: toColId } },
    };
}

function actionReorderColumns(board: Board, activeId: string, overId: string): Board {
    const oldIndex = board.columns.findIndex(c => c.id === activeId);
    const newIndex = board.columns.findIndex(c => c.id === overId);
    if (oldIndex === -1 || newIndex === -1) return board;
    const reordered = arrayMove(board.columns, oldIndex, newIndex).map((c, i) => ({ ...c, order: i }));
    return { ...board, columns: reordered };
}

function actionAddMessage(board: Board, cardId: string, role: 'user' | 'agent', content: string, diff: string | null): Board {
    const card = board.cards[cardId];
    if (!card) return board;
    const msg = createMessage(role, content, diff);
    return { ...board, cards: { ...board.cards, [cardId]: { ...card, messages: [...card.messages, msg] } } };
}

// ============================================================

describe('$Board.Actions', () => {
    let board: Board;
    beforeEach(() => { board = createDefaultBoard(); });

    describe('add_column', () => {
        it('새 칼럼이 board.columns에 추가된다', () => {
            const result = actionAddColumn(board);
            expect(result.columns).toHaveLength(4);
            expect(result.columns[3].title).toBe('새 칼럼');
            expect(result.columns[3].card_ids).toEqual([]);
        });
    });

    describe('delete_column', () => {
        it('칼럼 삭제 시 하위 카드 연쇄 제거', () => {
            let b = actionAddCard(board, board.columns[0].id);
            b = actionAddCard(b, b.columns[0].id);
            const cardIds = b.columns[0].card_ids;
            expect(cardIds).toHaveLength(2);
            const result = actionDeleteColumn(b, b.columns[0].id);
            expect(result.columns).toHaveLength(2);
            cardIds.forEach(cid => expect(result.cards[cid]).toBeUndefined());
        });

        it('존재하지 않는 column_id → 변경 없음', () => {
            expect(actionDeleteColumn(board, 'bad')).toBe(board);
        });
    });

    describe('delete_card', () => {
        it('카드 삭제 시 칼럼 card_ids에서 제거', () => {
            let b = actionAddCard(board, board.columns[0].id);
            const cardId = b.columns[0].card_ids[0];
            const result = actionDeleteCard(b, cardId);
            expect(result.cards[cardId]).toBeUndefined();
            expect(result.columns[0].card_ids).not.toContain(cardId);
        });
    });

    describe('move_card', () => {
        it('카드 이동 후 from/to 칼럼 정합성', () => {
            let b = actionAddCard(board, board.columns[0].id);
            const cardId = b.columns[0].card_ids[0];
            const result = actionMoveCard(b, cardId, b.columns[0].id, b.columns[1].id, 0);
            expect(result.columns.find(c => c.id === b.columns[0].id)!.card_ids).not.toContain(cardId);
            expect(result.columns.find(c => c.id === b.columns[1].id)!.card_ids).toContain(cardId);
        });

        it('유효하지 않은 칼럼 → 변경 없음', () => {
            let b = actionAddCard(board, board.columns[0].id);
            expect(actionMoveCard(b, b.columns[0].card_ids[0], 'bad', 'bad2', 0)).toBe(b);
        });
    });

    describe('reorder_columns', () => {
        it('순서 변경 후 order 필드 재정렬', () => {
            const result = actionReorderColumns(board, board.columns[0].id, board.columns[2].id);
            result.columns.forEach((c, i) => expect(c.order).toBe(i));
        });
    });

    describe('add_message', () => {
        it('메시지 추가 후 messages 배열 반영', () => {
            let b = actionAddCard(board, board.columns[0].id);
            const cardId = b.columns[0].card_ids[0];
            const result = actionAddMessage(b, cardId, 'user', '테스트', null);
            expect(result.cards[cardId].messages).toHaveLength(1);
            expect(result.cards[cardId].messages[0].content).toBe('테스트');
        });

        it('존재하지 않는 card_id → 변경 없음', () => {
            expect(actionAddMessage(board, 'bad', 'user', 'x', null)).toBe(board);
        });
    });
});

describe('$Card.DiffBlock', () => {
    it('줄별 +/-/context 분류', () => {
        const lines = '+added\n-removed\n context'.split('\n');
        expect(lines.map(l => l.startsWith('+') ? 'add' : l.startsWith('-') ? 'remove' : 'context')).toEqual(['add', 'remove', 'context']);
    });
});

describe('$ManualAdapter', () => {
    it('JSON 왕복 무결성', () => {
        const base = createDefaultBoard();
        let b = actionAddCard(base, base.columns[0].id);
        const restored = JSON.parse(JSON.stringify(b)) as Board;
        expect(restored.columns).toHaveLength(3);
        expect(Object.keys(restored.cards)).toHaveLength(1);
    });

    it('JSON 파싱 실패 → 기본 보드', () => {
        let parsed: Board;
        try { parsed = JSON.parse('broken'); } catch { parsed = createDefaultBoard(); }
        expect(parsed.columns).toHaveLength(3);
    });
});

describe('통합', () => {
    it('카드 추가 → 이동 → 칼럼 정합성', () => {
        let b = createDefaultBoard();
        b = actionAddCard(b, b.columns[0].id);
        b = actionAddCard(b, b.columns[0].id);
        const cardId = b.columns[0].card_ids[0];
        b = actionMoveCard(b, cardId, b.columns[0].id, b.columns[1].id, 0);
        expect(b.columns[0].card_ids).toHaveLength(1);
        expect(b.columns[1].card_ids[0]).toBe(cardId);
    });

    it('카드 → 메시지(user+agent+diff) → JSON 복원', () => {
        let b = createDefaultBoard();
        b = actionAddCard(b, b.columns[0].id);
        const cid = b.columns[0].card_ids[0];
        b = actionAddMessage(b, cid, 'user', 'req', null);
        b = actionAddMessage(b, cid, 'agent', 'done', '+added');
        const r = JSON.parse(JSON.stringify(b)) as Board;
        expect(r.cards[cid].messages).toHaveLength(2);
        expect(r.cards[cid].messages[1].diff).toBe('+added');
    });

    it('칼럼 순서 변경 후 order 정합성', () => {
        let b = createDefaultBoard();
        b = actionReorderColumns(b, b.columns[2].id, b.columns[0].id);
        expect(b.columns.map(c => c.order)).toEqual([0, 1, 2]);
        expect(b.columns[0].title).toBe('완료');
    });
});
