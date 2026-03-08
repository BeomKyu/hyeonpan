import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useBoard } from '../../hooks/useBoard';
import type { Card as CardType } from '../../models/types';
import './CardTile.css';

interface CardTileProps {
    card: CardType;
}

export function CardTile({ card }: CardTileProps) {
    const { openDetail, deleteCard } = useBoard();
    const [showDelete, setShowDelete] = useState(false);

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: card.id, data: { type: 'card', columnId: card.column_id } });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`card-tile ${isDragging ? 'card-dragging' : ''}`}
            onMouseEnter={() => setShowDelete(true)}
            onMouseLeave={() => setShowDelete(false)}
            {...attributes}
            {...listeners}
        >
            <div className="card-tile-content" onClick={() => openDetail(card.id)}>
                <span className="card-title">{card.title}</span>
                {card.messages.length > 0 && (
                    <span className="card-message-badge">{card.messages.length}</span>
                )}
            </div>
            {showDelete && (
                <button
                    className="card-delete-btn"
                    onClick={(e) => { e.stopPropagation(); deleteCard(card.id); }}
                    title="카드 삭제"
                >
                    ×
                </button>
            )}
        </div>
    );
}
