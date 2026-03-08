// v2 데이터 모델 — ParsedProject, ProgressItem, FeatureItem, RegisteredProject

export interface ProgressItem {
    label: string;
    status: 'done' | 'in_progress' | 'pending';
}

export interface FeatureItem {
    label: string;
    status: 'done' | 'in_progress' | 'pending';
    testStatus: 'pass' | 'fail' | 'pending' | 'manual_pass';
}

export interface ParsedProject {
    filePath: string;
    task: string;
    state: string;
    actor: string;
    retry: string;
    time: string;
    testRes: string | null;
    reviewScore: string | null;
    progress: ProgressItem[];
    features: FeatureItem[];
    rawContent: string;
}

export interface RegisteredProject {
    id: string;
    label: string;
    sourceType: 'manual' | 'file_picker';
    fileContent: string | null;
    filePath: string | null;
    lastUpdated: string;
}

export const FSM_COLUMNS = [
    'BACKLOG', 'SPEC_ANALYZE', 'SPEC_REVIEW',
    'IMPLEMENTING', 'TEST_RUNNING', 'ADVERSARIAL_REVIEW',
    'PENDING_APPROVAL', 'MERGED',
] as const;

export const HUMAN_ACTION_STATES = ['SPEC_REVIEW', 'PENDING_APPROVAL'] as const;
