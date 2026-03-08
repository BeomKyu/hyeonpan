import { useBoard } from '../../hooks/useBoard';
import './BoardHeader.css';

export function BoardHeader() {
    const { addColumn } = useBoard();

    return (
        <header className="board-header">
            <div className="board-header-left">
                <h1 className="board-title">현판</h1>
                <span className="board-subtitle">Kanban Board</span>
            </div>
            <button className="add-column-btn" onClick={addColumn}>
                + 칼럼 추가
            </button>
        </header>
    );
}
