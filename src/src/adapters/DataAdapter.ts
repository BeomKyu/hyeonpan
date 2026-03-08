import type { Board, Message } from '../models/types';

export interface DataAdapter {
    loadBoard(): Board;
    saveBoard(board: Board): void;
    addMessage(cardId: string, msg: Message): void;
}
