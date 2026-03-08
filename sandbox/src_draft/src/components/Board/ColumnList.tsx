import {
    DndContext,
    DragOverlay,
    closestCorners,
    PointerSensor,
    useSensor,
    useSensors,
    type DragStartEvent,
    type DragEndEvent,
    type DragOverEvent,
} from '@dnd-kit/core';
import {
    SortableContext,
    horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useState } from 'react';
import { useBoard } from '../../hooks/useBoard';
import { BoardColumn } from './BoardColumn';
import { CardTile } from '../Card/CardTile';
import './ColumnList.css';

export function ColumnList() {
    const { board, reorderColumns, moveCard } = useBoard();
    const [activeId, setActiveId] = useState<string | null>(null);
    const [activeType, setActiveType] = useState<'column' | 'card' | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
    );

    const sortedColumns = [...board.columns].sort((a, b) => a.order - b.order);
    const columnIds = sortedColumns.map(c => c.id);

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        const type = active.data.current?.type as 'column' | 'card';
        setActiveId(active.id as string);
        setActiveType(type);
    };

    const handleDragOver = (event: DragOverEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const activeData = active.data.current;
        const overData = over.data.current;

        if (activeData?.type !== 'card') return;

        const activeColId = activeData.columnId as string;
        let overColId: string;
        let overIndex: number;

        if (overData?.type === 'card') {
            overColId = overData.columnId as string;
            const overCol = board.columns.find(c => c.id === overColId);
            overIndex = overCol?.card_ids.indexOf(over.id as string) ?? 0;
        } else {
            // Dropped on a column droppable area
            const droppableId = (over.id as string).replace('droppable-', '');
            overColId = droppableId;
            const overCol = board.columns.find(c => c.id === overColId);
            overIndex = overCol?.card_ids.length ?? 0;
        }

        if (activeColId !== overColId) {
            moveCard(active.id as string, activeColId, overColId, overIndex);
            // Update active data for subsequent events
            active.data.current = { ...activeData, columnId: overColId };
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        setActiveType(null);

        if (!over || active.id === over.id) return;

        if (active.data.current?.type === 'column') {
            reorderColumns(active.id as string, over.id as string);
        } else if (active.data.current?.type === 'card') {
            const activeColId = active.data.current.columnId as string;
            const overData = over.data.current;
            let overColId: string;
            let overIndex: number;

            if (overData?.type === 'card') {
                overColId = overData.columnId as string;
                const overCol = board.columns.find(c => c.id === overColId);
                overIndex = overCol?.card_ids.indexOf(over.id as string) ?? 0;
            } else {
                const droppableId = (over.id as string).replace('droppable-', '');
                overColId = droppableId;
                const overCol = board.columns.find(c => c.id === overColId);
                overIndex = overCol?.card_ids.length ?? 0;
            }

            if (activeColId === overColId) {
                moveCard(active.id as string, activeColId, overColId, overIndex);
            }
        }
    };

    const activeCard = activeId && activeType === 'card' ? board.cards[activeId] : null;

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
        >
            <div className="column-list-container">
                <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
                    {sortedColumns.map(column => (
                        <BoardColumn key={column.id} column={column} />
                    ))}
                </SortableContext>
            </div>

            <DragOverlay>
                {activeCard && <CardTile card={activeCard} />}
            </DragOverlay>
        </DndContext>
    );
}
