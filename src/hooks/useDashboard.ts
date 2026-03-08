// useDashboard — 대시보드 상태 관리 훅
import { useState, useCallback } from 'react';
import type { RegisteredProject, ParsedProject } from '../models/dashboardTypes';
import { FSM_COLUMNS, HUMAN_ACTION_STATES } from '../models/dashboardTypes';
import type { Board, Card } from '../models/types';
import { createCard } from '../utils/boardUtils';
import {
    loadProjects,
    addManualProject,
    addFromPicker,
    removeProject,
    getParsedProjects,
} from '../registry/projectRegistry';
import { v4 as uuidv4 } from 'uuid';

export interface DashboardCard extends Card {
    _parsed: ParsedProject;
    _progressPct: number;
    _needsHuman: boolean;
}

function createDashboardColumns() {
    return FSM_COLUMNS.map((title, i) => ({
        id: uuidv4(),
        title,
        order: i,
        card_ids: [] as string[],
    }));
}

function buildDashboardBoard(projects: RegisteredProject[]): Board {
    const columns = createDashboardColumns();
    const cards: Record<string, Card> = {};
    const parsed = getParsedProjects(projects);

    for (const project of parsed) {
        let colIndex = FSM_COLUMNS.indexOf(project.state as typeof FSM_COLUMNS[number]);
        if (colIndex === -1) colIndex = 0;

        const total = project.progress.length;
        const done = project.progress.filter(p => p.status === 'done').length;
        const progressPct = total > 0 ? Math.round((done / total) * 100) : 0;

        const needsHuman =
            project.actor === 'HUMAN' ||
            (HUMAN_ACTION_STATES as readonly string[]).includes(project.state);

        const card = createCard(project.task, columns[colIndex].id);
        card.description = `${project.state} | ${project.actor}`;

        // 확장 속성 첨부
        const dashCard = card as DashboardCard;
        dashCard._parsed = project;
        dashCard._progressPct = progressPct;
        dashCard._needsHuman = needsHuman;

        cards[card.id] = dashCard;
        columns[colIndex].card_ids.push(card.id);
    }

    return { columns, cards };
}

export function useDashboard() {
    const [projects, setProjects] = useState<RegisteredProject[]>(() => loadProjects());
    const [board, setBoard] = useState<Board>(() => buildDashboardBoard(loadProjects()));
    const [modalCardId, setModalCardId] = useState<string | null>(null);
    const [collapseEmpty, setCollapseEmpty] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const refreshBoard = useCallback((updatedProjects: RegisteredProject[]) => {
        setProjects(updatedProjects);
        setBoard(buildDashboardBoard(updatedProjects));
    }, []);

    const handleAddManual = useCallback((label: string, content: string) => {
        const updated = addManualProject(projects, label, content, '');
        refreshBoard(updated);
    }, [projects, refreshBoard]);

    const handleAddFromPicker = useCallback(async (file: File) => {
        try {
            const updated = await addFromPicker(projects, file);
            refreshBoard(updated);
            setErrorMessage(null);
        } catch (err) {
            setErrorMessage(`파일을 열 수 없습니다: ${err instanceof Error ? err.message : String(err)}`);
        }
    }, [projects, refreshBoard]);

    const handleRemoveProject = useCallback((id: string) => {
        const updated = removeProject(projects, id);
        refreshBoard(updated);
    }, [projects, refreshBoard]);

    const openDetail = useCallback((cardId: string) => setModalCardId(cardId), []);
    const closeDetail = useCallback(() => setModalCardId(null), []);

    const visibleColumns = collapseEmpty
        ? board.columns.filter(c => c.card_ids.length > 0)
        : board.columns;

    return {
        projects,
        board,
        visibleColumns,
        modalCardId,
        collapseEmpty,
        errorMessage,
        setCollapseEmpty,
        setErrorMessage,
        handleAddManual,
        handleAddFromPicker,
        handleRemoveProject,
        openDetail,
        closeDetail,
    };
}
