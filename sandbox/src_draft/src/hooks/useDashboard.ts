// useDashboard — 대시보드 상태 관리 훅 (v3 확장)
import { useState, useCallback } from 'react';
import type { RegisteredProject, ParsedProject } from '../models/dashboardTypes';
import { FSM_COLUMNS, HUMAN_ACTION_STATES, ACTIONABLE_STATES, FSM_TRANSITION_MAP } from '../models/dashboardTypes';
import type { Board, Card, Message } from '../models/types';
import { createCard } from '../utils/boardUtils';
import {
    loadProjects,
    addManualProject,
    addFromPicker,
    removeProject,
    getParsedProjects,
    importLog,
    refreshProject,
} from '../registry/projectRegistry';
import { parseConversationLog } from '../parsers/conversationLogParser';
import { v4 as uuidv4 } from 'uuid';

export interface DashboardCard extends Card {
    _parsed: ParsedProject;
    _progressPct: number;
    _needsHuman: boolean;
    _registeredId: string;
}

function createDashboardColumns() {
    return FSM_COLUMNS.map((title, i) => ({
        id: uuidv4(),
        title,
        order: i,
        card_ids: [] as string[],
    }));
}

// v3: sessionOverrides — approve/reject 세션 한정 상태 덮어쓰기
type SessionOverrides = Map<string, string>;

function buildDashboardBoard(
    projects: RegisteredProject[],
    overrides: SessionOverrides = new Map(),
): Board {
    const columns = createDashboardColumns();
    const cards: Record<string, Card> = {};
    const parsed = getParsedProjects(projects);

    for (let i = 0; i < parsed.length; i++) {
        const project = parsed[i];
        const registered = projects.filter(p => p.fileContent != null)[i];
        const registeredId = registered?.id ?? '';

        // v3: 세션 오버라이드 적용
        if (overrides.has(registeredId)) {
            project.state = overrides.get(registeredId)!;
        }

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

        const dashCard = card as DashboardCard;
        dashCard._parsed = project;
        dashCard._progressPct = progressPct;
        dashCard._needsHuman = needsHuman;
        dashCard._registeredId = registeredId;

        cards[card.id] = dashCard;
        columns[colIndex].card_ids.push(card.id);
    }

    return { columns, cards };
}

export function isActionable(state: string): boolean {
    return (ACTIONABLE_STATES as readonly string[]).includes(state);
}

export function useDashboard() {
    const [projects, setProjects] = useState<RegisteredProject[]>(() => loadProjects());
    const [sessionOverrides, setSessionOverrides] = useState<SessionOverrides>(() => new Map());
    const [board, setBoard] = useState<Board>(() => buildDashboardBoard(loadProjects()));
    const [modalCardId, setModalCardId] = useState<string | null>(null);
    const [collapseEmpty, setCollapseEmpty] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    const refreshBoard = useCallback((updatedProjects: RegisteredProject[], overrides?: SessionOverrides) => {
        setProjects(updatedProjects);
        const ov = overrides ?? sessionOverrides;
        setBoard(buildDashboardBoard(updatedProjects, ov));
    }, [sessionOverrides]);

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
        const newOverrides = new Map(sessionOverrides);
        newOverrides.delete(id);
        setSessionOverrides(newOverrides);
        refreshBoard(updated, newOverrides);
    }, [projects, sessionOverrides, refreshBoard]);

    const openDetail = useCallback((cardId: string) => setModalCardId(cardId), []);
    const closeDetail = useCallback(() => setModalCardId(null), []);

    const loadMessages = useCallback((registeredId: string): Message[] => {
        const project = projects.find(p => p.id === registeredId);
        if (!project?.logContent) return [];
        return parseConversationLog(project.logContent, project.logFormat);
    }, [projects]);

    const handleImportLog = useCallback(async (registeredId: string, file: File) => {
        try {
            const updated = await importLog(projects, registeredId, file);
            refreshBoard(updated);
            setErrorMessage(null);
        } catch (err) {
            setErrorMessage(`로그 임포트 실패: ${err instanceof Error ? err.message : String(err)}`);
        }
    }, [projects, refreshBoard]);

    const handleRefreshProject = useCallback(async (registeredId: string, file: File) => {
        try {
            const updated = await refreshProject(projects, registeredId, file);
            const newOverrides = new Map(sessionOverrides);
            newOverrides.delete(registeredId);
            setSessionOverrides(newOverrides);
            refreshBoard(updated, newOverrides);
            setErrorMessage(null);
        } catch (err) {
            setErrorMessage(`리프레시 실패: ${err instanceof Error ? err.message : String(err)}`);
        }
    }, [projects, sessionOverrides, refreshBoard]);

    const handleApprove = useCallback((card: DashboardCard) => {
        const currentState = card._parsed.state;
        const nextState = FSM_TRANSITION_MAP.approve[currentState];
        if (!nextState) return;

        const newOverrides = new Map(sessionOverrides);
        newOverrides.set(card._registeredId, nextState);
        setSessionOverrides(newOverrides);
        setBoard(buildDashboardBoard(projects, newOverrides));
        setToastMessage(`✅ ${currentState} → ${nextState} 전이. state.md 파일도 수정해주세요.`);
        setTimeout(() => setToastMessage(null), 4000);
    }, [projects, sessionOverrides]);

    const handleReject = useCallback((card: DashboardCard) => {
        const currentState = card._parsed.state;
        const nextState = FSM_TRANSITION_MAP.reject[currentState];
        if (!nextState) return;

        const newOverrides = new Map(sessionOverrides);
        newOverrides.set(card._registeredId, nextState);
        setSessionOverrides(newOverrides);
        setBoard(buildDashboardBoard(projects, newOverrides));
        setToastMessage(`🔙 ${currentState} → ${nextState} 롤백. state.md 파일도 수정해주세요.`);
        setTimeout(() => setToastMessage(null), 4000);
    }, [projects, sessionOverrides]);

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
        toastMessage,
        setCollapseEmpty,
        setErrorMessage,
        setToastMessage,
        handleAddManual,
        handleAddFromPicker,
        handleRemoveProject,
        openDetail,
        closeDetail,
        loadMessages,
        handleImportLog,
        handleRefreshProject,
        handleApprove,
        handleReject,
    };
}
