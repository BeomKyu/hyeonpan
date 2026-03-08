import { describe, it, expect } from 'vitest';
import { parseStateFile } from '../parsers/stateFileParser';
import {
    loadProjects,
    addManualProject,
    removeProject,
    getParsedProjects,
} from '../registry/projectRegistry';

// === 테스트용 state.md 픽스처 ===

const VALID_STATE_MD = `[Byeorim v1.4]

# === @FSM_STATE ===

NOW 2026-03-08
task: hyeonpan_kanban_v1
state: IMPLEMENTING
spec_hash: none
git_ref: none
retry: 1 / max: 5
actor: EDITOR
time: 2026-03-08T14:00:00+09:00

meta:
  test_res: PASS (15/15)
  review_score: 9.5/10
  err_log: none

# === @PROGRESS ===

[x] Stage_1_제약조건_도출
[x] Stage_2_명세_작성_및_승인
[-] Stage_3_코드_구현
[_] Stage_3_적대적_검증
[_] Final_Gate_최종_승인_및_병합

# === @FEATURES ===

# v1 MVP
[x] $Board.Column_CRUD / test: pass
[x] $Board.Card_CRUD / test: pass
[-] $Board.DragDrop / test: pending
[_] $Board.LocalStorage / test: fail
[x] $Board.Responsive / test: manual_pass
`;

const CORRUPTED_STATE_MD = `이것은 유효하지 않은 파일입니다
아무 구조도 없습니다`;

// ============================================================
// $StateFileParser 테스트
// ============================================================

describe('$StateFileParser', () => {
    describe('parse', () => {
        it('정상 state.md → ParsedProject 변환', () => {
            const result = parseStateFile(VALID_STATE_MD, '/test/state.md');

            expect(result.task).toBe('hyeonpan_kanban_v1');
            expect(result.state).toBe('IMPLEMENTING');
            expect(result.actor).toBe('EDITOR');
            expect(result.retry).toBe('1 / max: 5');
            expect(result.time).toBe('2026-03-08T14:00:00+09:00');
            expect(result.testRes).toBe('PASS (15/15)');
            expect(result.reviewScore).toBe('9.5/10');
            expect(result.filePath).toBe('/test/state.md');
            expect(result.rawContent).toBe(VALID_STATE_MD);
        });

        it('손상된 파일 → graceful 에러 ParsedProject', () => {
            const result = parseStateFile(CORRUPTED_STATE_MD, '/bad/state.md');

            expect(result.task).toBe('알 수 없는 태스크');
            expect(result.state).toBe('UNKNOWN');
            expect(result.actor).toBe('none');
            expect(result.progress).toHaveLength(0);
            expect(result.features).toHaveLength(0);
            expect(result.filePath).toBe('/bad/state.md');
            expect(result.rawContent).toBe(CORRUPTED_STATE_MD);
        });
    });

    describe('@PROGRESS 체크박스 상태 분류', () => {
        it('[x]/[-]/[_] → done/in_progress/pending', () => {
            const result = parseStateFile(VALID_STATE_MD, '/test/state.md');

            expect(result.progress).toHaveLength(5);
            expect(result.progress[0]).toEqual({ label: 'Stage_1_제약조건_도출', status: 'done' });
            expect(result.progress[1]).toEqual({ label: 'Stage_2_명세_작성_및_승인', status: 'done' });
            expect(result.progress[2]).toEqual({ label: 'Stage_3_코드_구현', status: 'in_progress' });
            expect(result.progress[3]).toEqual({ label: 'Stage_3_적대적_검증', status: 'pending' });
            expect(result.progress[4]).toEqual({ label: 'Final_Gate_최종_승인_및_병합', status: 'pending' });
        });
    });

    describe('@FEATURES test_status 파싱', () => {
        it('pass/fail/pending/manual_pass 정확 분류', () => {
            const result = parseStateFile(VALID_STATE_MD, '/test/state.md');

            expect(result.features).toHaveLength(5);
            expect(result.features[0]).toEqual({
                label: '$Board.Column_CRUD / test: pass',
                status: 'done',
                testStatus: 'pass',
            });
            expect(result.features[2]).toEqual({
                label: '$Board.DragDrop / test: pending',
                status: 'in_progress',
                testStatus: 'pending',
            });
            expect(result.features[3]).toEqual({
                label: '$Board.LocalStorage / test: fail',
                status: 'pending',
                testStatus: 'fail',
            });
            expect(result.features[4]).toEqual({
                label: '$Board.Responsive / test: manual_pass',
                status: 'done',
                testStatus: 'manual_pass',
            });
        });
    });
});

// ============================================================
// $ProjectRegistry 테스트
// ============================================================

describe('$ProjectRegistry', () => {
    // localStorage 목업
    const storage: Record<string, string> = {};
    beforeAll(() => {
        Object.defineProperty(globalThis, 'localStorage', {
            value: {
                getItem: (key: string) => storage[key] ?? null,
                setItem: (key: string, val: string) => { storage[key] = val; },
                removeItem: (key: string) => { delete storage[key]; },
                clear: () => { Object.keys(storage).forEach(k => delete storage[k]); },
            },
            writable: true,
        });
    });

    beforeEach(() => {
        Object.keys(storage).forEach(k => delete storage[k]);
    });

    it('add_manual → localStorage 저장 검증', () => {
        let projects = loadProjects();
        expect(projects).toHaveLength(0);

        projects = addManualProject(projects, 'TestProj', VALID_STATE_MD, '/test/state.md');
        expect(projects).toHaveLength(1);
        expect(projects[0].label).toBe('TestProj');
        expect(projects[0].sourceType).toBe('manual');
        expect(projects[0].fileContent).toBe(VALID_STATE_MD);

        // localStorage에 저장되었는지 확인
        const reloaded = loadProjects();
        expect(reloaded).toHaveLength(1);
        expect(reloaded[0].label).toBe('TestProj');
    });

    it('remove_project → 리스트 갱신 검증', () => {
        let projects = addManualProject([], 'Proj1', 'content1', '');
        projects = addManualProject(projects, 'Proj2', 'content2', '');
        expect(projects).toHaveLength(2);

        const idToRemove = projects[0].id;
        projects = removeProject(projects, idToRemove);
        expect(projects).toHaveLength(1);
        expect(projects[0].label).toBe('Proj2');

        const reloaded = loadProjects();
        expect(reloaded).toHaveLength(1);
    });

    it('getParsedProjects → 파싱된 프로젝트 목록 반환', () => {
        const projects = addManualProject([], 'HyeonpanV1', VALID_STATE_MD, '/test/state.md');

        const parsed = getParsedProjects(projects);
        expect(parsed).toHaveLength(1);
        expect(parsed[0].task).toBe('hyeonpan_kanban_v1');
        expect(parsed[0].state).toBe('IMPLEMENTING');
        expect(parsed[0].progress).toHaveLength(5);
    });
});

// ============================================================
// 통합: 복수 프로젝트 등록 → FSM 상태별 분류
// ============================================================

import { beforeAll, beforeEach } from 'vitest';
import { FSM_COLUMNS } from '../models/dashboardTypes';

describe('통합: FSM 상태별 프로젝트 분류', () => {
    it('복수 프로젝트가 state에 따라 정확히 분류된다', () => {
        const stateA = VALID_STATE_MD; // IMPLEMENTING

        const stateB = VALID_STATE_MD.replace('state: IMPLEMENTING', 'state: MERGED')
            .replace('task: hyeonpan_kanban_v1', 'task: project_b');

        const stateC = VALID_STATE_MD.replace('state: IMPLEMENTING', 'state: SPEC_REVIEW')
            .replace('task: hyeonpan_kanban_v1', 'task: project_c')
            .replace('actor: EDITOR', 'actor: HUMAN');

        let projects = addManualProject([], 'ProjA', stateA, '');
        projects = addManualProject(projects, 'ProjB', stateB, '');
        projects = addManualProject(projects, 'ProjC', stateC, '');

        const parsed = getParsedProjects(projects);
        expect(parsed).toHaveLength(3);

        // FSM 상태별 확인
        const stateMap = new Map(parsed.map(p => [p.task, p.state]));
        expect(stateMap.get('hyeonpan_kanban_v1')).toBe('IMPLEMENTING');
        expect(stateMap.get('project_b')).toBe('MERGED');
        expect(stateMap.get('project_c')).toBe('SPEC_REVIEW');

        // project_c는 actor=HUMAN → SPEC_REVIEW → needs human action
        const projC = parsed.find(p => p.task === 'project_c')!;
        expect(projC.actor).toBe('HUMAN');
        expect((FSM_COLUMNS as readonly string[]).indexOf(projC.state)).toBe(2); // SPEC_REVIEW = index 2
    });
});
