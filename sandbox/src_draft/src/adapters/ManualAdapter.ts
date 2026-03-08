import type { Board, Message } from '../models/types';
import type { DataAdapter } from './DataAdapter';
import { createDefaultBoard } from '../utils/boardUtils';

const STORAGE_KEY = 'hyeonpan_board_data';

export class ManualAdapter implements DataAdapter {
    loadBoard(): Board {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw === null) {
                return createDefaultBoard();
            }
            const parsed = JSON.parse(raw) as Board;
            return parsed;
        } catch (err) {
            console.warn('localStorage 파싱 실패, 기본 보드 로드', err);
            return createDefaultBoard();
        }
    }

    saveBoard(board: Board): void {
        try {
            const data = JSON.stringify(board);
            localStorage.setItem(STORAGE_KEY, data);
        } catch (err) {
            console.warn('localStorage 저장 실패', err);
        }
    }

    addMessage(cardId: string, msg: Message): void {
        const board = this.loadBoard();
        const card = board.cards[cardId];
        if (!card) {
            console.warn('존재하지 않는 card_id:', cardId);
            return;
        }
        card.messages.push(msg);
        this.saveBoard(board);
    }
}
