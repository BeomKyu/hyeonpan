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
    // v3: 대화 로그
    logContent: string | null;
    logFormat: 'md' | 'json';
}

export const FSM_COLUMNS = [
    'BACKLOG', 'SPEC_ANALYZE', 'SPEC_REVIEW',
    'IMPLEMENTING', 'TEST_RUNNING', 'ADVERSARIAL_REVIEW',
    'PENDING_APPROVAL', 'MERGED',
] as const;

export const HUMAN_ACTION_STATES = ['SPEC_REVIEW', 'PENDING_APPROVAL'] as const;

// v3: FSM 전이 맵 + 액션 가능 상태
export const ACTIONABLE_STATES = ['SPEC_REVIEW', 'ADVERSARIAL_REVIEW', 'PENDING_APPROVAL'] as const;

export const FSM_TRANSITION_MAP = {
    approve: {
        SPEC_REVIEW: 'IMPLEMENTING',
        ADVERSARIAL_REVIEW: 'PENDING_APPROVAL',
        PENDING_APPROVAL: 'MERGED',
    } as Record<string, string>,
    reject: {
        SPEC_REVIEW: 'BACKLOG',
        ADVERSARIAL_REVIEW: 'IMPLEMENTING',
        PENDING_APPROVAL: 'IMPLEMENTING',
    } as Record<string, string>,
};
