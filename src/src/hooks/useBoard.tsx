import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { Board } from '../models/types';
import { getAdapter } from '../config/adapter';
import { createCard, createColumn, createMessage, arrayMove } from '../utils/boardUtils';

interface BoardContextType {
    board: Board;
    modalCardId: string | null;
    addColumn: () => void;
    deleteColumn: (columnId: string) => void;
    renameColumn: (columnId: string, title: string) => void;
    reorderColumns: (activeId: string, overId: string) => void;
    addCard: (columnId: string) => void;
    deleteCard: (cardId: string) => void;
    updateCard: (cardId: string, updates: Partial<{ title: string; description: string }>) => void;
    moveCard: (cardId: string, fromColId: string, toColId: string, toIndex: number) => void;
    addMessage: (cardId: string, role: 'user' | 'agent', content: string, diff: string | null) => void;
    openDetail: (cardId: string) => void;
    closeDetail: () => void;
}

const BoardContext = createContext<BoardContextType | null>(null);

const adapter = getAdapter();

export function BoardProvider({ children }: { children: ReactNode }) {
    const [board, setBoard] = useState<Board>(() => adapter.loadBoard());
    const [modalCardId, setModalCardId] = useState<string | null>(null);

    useEffect(() => {
        adapter.saveBoard(board);
    }, [board]);

    const addColumn = useCallback(() => {
        setBoard(prev => {
            const newCol = createColumn('새 칼럼', prev.columns.length);
            return { ...prev, columns: [...prev.columns, newCol] };
        });
    }, []);

    const deleteColumn = useCallback((columnId: string) => {
        setBoard(prev => {
            const target = prev.columns.find(c => c.id === columnId);
            if (!target) return prev;
            const newCards = { ...prev.cards };
            target.card_ids.forEach(cid => delete newCards[cid]);
            return {
                columns: prev.columns.filter(c => c.id !== columnId),
                cards: newCards,
            };
        });
    }, []);

    const renameColumn = useCallback((columnId: string, title: string) => {
        if (!title.trim()) return;
        setBoard(prev => ({
            ...prev,
            columns: prev.columns.map(c =>
                c.id === columnId ? { ...c, title } : c
            ),
        }));
    }, []);

    const reorderColumns = useCallback((activeId: string, overId: string) => {
        if (activeId === overId) return;
        setBoard(prev => {
            const oldIndex = prev.columns.findIndex(c => c.id === activeId);
            const newIndex = prev.columns.findIndex(c => c.id === overId);
            if (oldIndex === -1 || newIndex === -1) return prev;
            const reordered = arrayMove(prev.columns, oldIndex, newIndex).map((c, i) => ({
                ...c,
                order: i,
            }));
            return { ...prev, columns: reordered };
        });
    }, []);

    const addCard = useCallback((columnId: string) => {
        setBoard(prev => {
            const col = prev.columns.find(c => c.id === columnId);
            if (!col) return prev;
            const newCard = createCard('새 카드', columnId);
            return {
                columns: prev.columns.map(c =>
                    c.id === columnId ? { ...c, card_ids: [...c.card_ids, newCard.id] } : c
                ),
                cards: { ...prev.cards, [newCard.id]: newCard },
            };
        });
    }, []);

    const deleteCard = useCallback((cardId: string) => {
        setBoard(prev => {
            const card = prev.cards[cardId];
            if (!card) return prev;
            const newCards = { ...prev.cards };
            delete newCards[cardId];
            return {
                columns: prev.columns.map(c =>
                    c.id === card.column_id
                        ? { ...c, card_ids: c.card_ids.filter(id => id !== cardId) }
                        : c
                ),
                cards: newCards,
            };
        });
        if (modalCardId === cardId) setModalCardId(null);
    }, [modalCardId]);

    const updateCard = useCallback((cardId: string, updates: Partial<{ title: string; description: string }>) => {
        setBoard(prev => {
            const card = prev.cards[cardId];
            if (!card) return prev;
            return {
                ...prev,
                cards: { ...prev.cards, [cardId]: { ...card, ...updates } },
            };
        });
    }, []);

    const moveCard = useCallback((cardId: string, fromColId: string, toColId: string, toIndex: number) => {
        setBoard(prev => {
            const fromCol = prev.columns.find(c => c.id === fromColId);
            const toCol = prev.columns.find(c => c.id === toColId);
            if (!fromCol || !toCol) return prev;
            const newFromIds = fromCol.card_ids.filter(id => id !== cardId);
            const newToIds = fromColId === toColId
                ? (() => {
                    const ids = fromCol.card_ids.filter(id => id !== cardId);
                    ids.splice(toIndex, 0, cardId);
                    return ids;
                })()
                : (() => {
                    const ids = [...toCol.card_ids];
                    ids.splice(toIndex, 0, cardId);
                    return ids;
                })();

            return {
                columns: prev.columns.map(c => {
                    if (c.id === fromColId && fromColId !== toColId) return { ...c, card_ids: newFromIds };
                    if (c.id === toColId) return { ...c, card_ids: newToIds };
                    return c;
                }),
                cards: {
                    ...prev.cards,
                    [cardId]: { ...prev.cards[cardId], column_id: toColId },
                },
            };
        });
    }, []);

    const addMessageAction = useCallback((cardId: string, role: 'user' | 'agent', content: string, diff: string | null) => {
        const msg = createMessage(role, content, diff || null);
        setBoard(prev => {
            const card = prev.cards[cardId];
            if (!card) return prev;
            return {
                ...prev,
                cards: {
                    ...prev.cards,
                    [cardId]: { ...card, messages: [...card.messages, msg] },
                },
            };
        });
        // Spec: /> adapter.add_message(card_id, msg) — 비동기 발사
        // ManualAdapter에서는 saveBoard가 전체를 덮어쓰므로 중복이지만,
        // ApiAdapter 전환 시 메시지 단위 API 호출을 위해 필요.
        adapter.addMessage(cardId, msg);
    }, []);

    const openDetail = useCallback((cardId: string) => setModalCardId(cardId), []);
    const closeDetail = useCallback(() => setModalCardId(null), []);

    return (
        <BoardContext.Provider value={{
            board,
            modalCardId,
            addColumn,
            deleteColumn,
            renameColumn,
            reorderColumns,
            addCard,
            deleteCard,
            updateCard,
            moveCard,
            addMessage: addMessageAction,
            openDetail,
            closeDetail,
        }}>
            {children}
        </BoardContext.Provider>
    );
}

export function useBoard() {
    const ctx = useContext(BoardContext);
    if (!ctx) throw new Error('useBoard must be used within BoardProvider');
    return ctx;
}
