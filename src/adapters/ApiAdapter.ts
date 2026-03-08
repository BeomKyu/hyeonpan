import type { Board, Message } from '../models/types';
import type { DataAdapter } from './DataAdapter';
import { createDefaultBoard } from '../utils/boardUtils';

export class ApiAdapter implements DataAdapter {
    private apiBase: string;

    constructor(apiBase: string) {
        this.apiBase = apiBase;
    }

    loadBoard(): Board {
        // TODO: 미래 연동 — fetch(`${this.apiBase}/board`)
        console.warn(`ApiAdapter: API 연동 미구현 (base: ${this.apiBase}), 기본 보드 반환`);
        return createDefaultBoard();
    }

    saveBoard(_board: Board): void {
        // TODO: Stage 3 미래 연동
        // await fetch(`${this.apiBase}/board`, { method: 'PUT', body: JSON.stringify(board) });
        console.warn('ApiAdapter: API 저장 미구현');
    }

    addMessage(_cardId: string, _msg: Message): void {
        // TODO: Stage 3 미래 연동
        console.warn('ApiAdapter: API 메시지 저장 미구현');
    }
}
