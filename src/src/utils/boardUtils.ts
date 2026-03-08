import { v4 as uuidv4 } from 'uuid';
import type { Board, Column, Card, Message } from '../models/types';

export function createDefaultBoard(): Board {
    const col1: Column = { id: uuidv4(), title: '할 일', order: 0, card_ids: [] };
    const col2: Column = { id: uuidv4(), title: '진행 중', order: 1, card_ids: [] };
    const col3: Column = { id: uuidv4(), title: '완료', order: 2, card_ids: [] };
    return {
        columns: [col1, col2, col3],
        cards: {},
    };
}

export function createCard(title: string, columnId: string): Card {
    return {
        id: uuidv4(),
        title,
        description: '',
        messages: [],
        column_id: columnId,
        created_at: new Date().toISOString(),
    };
}

export function createColumn(title: string, order: number): Column {
    return {
        id: uuidv4(),
        title,
        order,
        card_ids: [],
    };
}

export function createMessage(role: 'user' | 'agent', content: string, diff: string | null = null): Message {
    return {
        id: uuidv4(),
        role,
        content,
        diff,
        timestamp: new Date().toISOString(),
    };
}

export function arrayMove<T>(arr: T[], fromIndex: number, toIndex: number): T[] {
    const result = [...arr];
    const [removed] = result.splice(fromIndex, 1);
    result.splice(toIndex, 0, removed);
    return result;
}
