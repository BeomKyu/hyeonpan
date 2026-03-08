// $ProjectRegistry — 프로젝트 등록 관리 (localStorage 영속)
import { v4 as uuidv4 } from 'uuid';
import type { RegisteredProject, ParsedProject } from '../models/dashboardTypes';
import { parseStateFile } from '../parsers/stateFileParser';

const STORAGE_KEY = 'hyeonpan_project_registry';

export function loadProjects(): RegisteredProject[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        return JSON.parse(raw) as RegisteredProject[];
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
