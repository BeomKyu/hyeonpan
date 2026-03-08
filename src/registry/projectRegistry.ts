// $ProjectRegistry — 프로젝트 등록 관리 (localStorage 영속)
import { v4 as uuidv4 } from 'uuid';
import type { RegisteredProject, ParsedProject } from '../models/dashboardTypes';
import { parseStateFile } from '../parsers/stateFileParser';
import { MAX_LOG_FILE_SIZE } from '../parsers/conversationLogParser';

const STORAGE_KEY = 'hyeonpan_project_registry';

// v3 하위 호환: 기존 데이터에 logContent/logFormat 없으면 기본값 할당
function migrateProject(p: RegisteredProject): RegisteredProject {
    return {
        ...p,
        logContent: p.logContent ?? null,
        logFormat: p.logFormat ?? 'md',
    };
}

export function loadProjects(): RegisteredProject[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        return (JSON.parse(raw) as RegisteredProject[]).map(migrateProject);
    } catch {
        return [];
    }
}

export function saveProjects(projects: RegisteredProject[]): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    } catch (err) {
        console.warn('프로젝트 레지스트리 저장 실패:', err);
    }
}

export function addManualProject(
    projects: RegisteredProject[],
    label: string,
    content: string,
    filePath: string,
): RegisteredProject[] {
    const project: RegisteredProject = {
        id: uuidv4(),
        label,
        sourceType: 'manual',
        fileContent: content,
        filePath: filePath || null,
        lastUpdated: new Date().toISOString(),
        logContent: null,
        logFormat: 'md',
    };
    const updated = [...projects, project];
    saveProjects(updated);
    return updated;
}

export function addFromPicker(
    projects: RegisteredProject[],
    file: File,
): Promise<RegisteredProject[]> {
    return file.text().then(content => {
        const label = file.name.replace('.md', '');
        const project: RegisteredProject = {
            id: uuidv4(),
            label,
            sourceType: 'file_picker',
            fileContent: content,
            filePath: file.name,
            lastUpdated: new Date().toISOString(),
            logContent: null,
            logFormat: 'md',
        };
        const updated = [...projects, project];
        saveProjects(updated);
        return updated;
    });
}

export function removeProject(
    projects: RegisteredProject[],
    id: string,
): RegisteredProject[] {
    const updated = projects.filter(p => p.id !== id);
    saveProjects(updated);
    return updated;
}

export function getParsedProjects(projects: RegisteredProject[]): ParsedProject[] {
    return projects
        .filter(p => p.fileContent != null)
        .map(p => parseStateFile(p.fileContent!, p.filePath ?? ''));
}

// v3: 대화 로그 임포트 (1:1, 재임포트 시 덮어쓰기)
export async function importLog(
    projects: RegisteredProject[],
    projectId: string,
    file: File,
): Promise<RegisteredProject[]> {
    if (file.size > MAX_LOG_FILE_SIZE) {
        throw new Error('파일 크기 5MB 초과');
    }
    const content = await file.text();
    const format: 'md' | 'json' = file.name.endsWith('.json') ? 'json' : 'md';
    const updated = projects.map(p =>
        p.id === projectId
            ? { ...p, logContent: content, logFormat: format }
            : p
    );
    saveProjects(updated);
    return updated;
}

// v3: 개별 프로젝트 리프레시 (state.md 파일 피커 재선택)
export async function refreshProject(
    projects: RegisteredProject[],
    projectId: string,
    file: File,
): Promise<RegisteredProject[]> {
    const content = await file.text();
    const updated = projects.map(p =>
        p.id === projectId
            ? { ...p, fileContent: content, lastUpdated: new Date().toISOString() }
            : p
    );
    saveProjects(updated);
    return updated;
}
