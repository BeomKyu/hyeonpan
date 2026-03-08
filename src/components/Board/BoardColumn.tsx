import { useState } from 'react';
import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useBoard } from '../../hooks/useBoard';
import { CardTile } from '../Card/CardTile';
import type { Column as ColumnType } from '../../models/types';
import './BoardColumn.css';

interface BoardColumnProps {
    column: ColumnType;
}

export function BoardColumn({ column }: BoardColumnProps) {
    const { board, deleteColumn, renameColumn, addCard } = useBoard();
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(column.title);

    const {
        attributes,
        listeners,
        setNodeRef: setSortableRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: column.id, data: { type: 'column' } });

    const { setNodeRef: setDropRef } = useDroppable({ id: `droppable-${column.id}` });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const cards = column.card_ids
        .map(id => board.cards[id])
        .filter(Boolean);

    const handleTitleSave = () => {
        if (editTitle.trim()) {
            renameColumn(column.id, editTitle.trim());
        } else {
            setEditTitle(column.title);
        }
        setIsEditing(false);
    };

    return (
        <div ref={setSortableRef} style={style} className={`board-column ${isDragging ? 'column-dragging' : ''}`}>
            <div className="column-header" {...attributes} {...listeners}>
                {isEditing ? (
                    <input
                        className="column-title-input"
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        onBlur={handleTitleSave}
                        onKeyDown={e => e.key === 'Enter' && handleTitleSave()}
                        autoFocus
                    />
                ) : (
                    <h3 className="column-title" onClick={() => { setIsEditing(true); setEditTitle(column.title); }}>
                        {column.title}
                        <span className="column-count">{cards.length}</span>
                    </h3>
                )}
                <div className="column-actions">
                    <button className="column-add-btn" onClick={() => addCard(column.id)} title="카드 추가">+</button>
                    <button className="column-delete-btn" onClick={() => deleteColumn(column.id)} title="칼럼 삭제">×</button>
                </div>
            </div>

            <div ref={setDropRef} className="card-list" data-column-id={column.id}>
                <SortableContext items={column.card_ids} strategy={verticalListSortingStrategy}>
                    {cards.map(card => (
                        <CardTile key={card.id} card={card} />
                    ))}
                </SortableContext>
                {cards.length === 0 && (
                    <div className="card-list-empty">카드를 추가하세요</div>
                )}
            </div>
        </div>
    );
}
