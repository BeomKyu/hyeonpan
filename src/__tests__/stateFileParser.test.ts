import { describe, it, expect } from 'vitest';
import { parseStateFile } from '../parsers/stateFileParser';

// ============================================================
// stateFileParser 단위 테스트 — v2 핵심 파서
// ============================================================

const VALID_STATE_MD = `[Byeorim v1.4]

# === @FSM_STATE ===

NOW 2026-03-08
task: hyeonpan_state_adapter_v2
state: IMPLEMENTING
spec_hash: none
git_ref: none
retry: 2 / max: 5
actor: EDITOR
time: 2026-03-08T15:00:00+09:00

# === @META ===

test_res: pass
review_score: 8/10

# === @PROGRESS ===

[x] Stage_1_제약조건_도출
[-] Stage_2_명세_작성
[_] Stage_3_코드_구현

# === @FEATURES ===

[x] feature_칸반보드_기본 — test: pass
[-] feature_대시보드 — test: fail
[_] feature_대화로그 — test: pending
[x] feature_리뷰 — test: manual_pass
`;

describe('$StateFileParser.parseStateFile — 정상 파싱', () => {
    it('FSM 필드 추출', () => {
        const result = parseStateFile(VALID_STATE_MD, '/test/state.md');
        expect(result.task).toBe('hyeonpan_state_adapter_v2');
        expect(result.state).toBe('IMPLEMENTING');
        expect(result.actor).toBe('EDITOR');
        expect(result.retry).toBe('2 / max: 5');
        expect(result.time).toBe('2026-03-08T15:00:00+09:00');
        expect(result.filePath).toBe('/test/state.md');
    });

    it('META 필드 추출', () => {
        const result = parseStateFile(VALID_STATE_MD, '/test/state.md');
        expect(result.testRes).toBe('pass');
        expect(result.reviewScore).toBe('8/10');
    });

    it('@PROGRESS 체크리스트 파싱', () => {
        const result = parseStateFile(VALID_STATE_MD, '/test/state.md');
        expect(result.progress).toHaveLength(3);
        expect(result.progress[0]).toEqual({ label: 'Stage_1_제약조건_도출', status: 'done' });
        expect(result.progress[1]).toEqual({ label: 'Stage_2_명세_작성', status: 'in_progress' });
        expect(result.progress[2]).toEqual({ label: 'Stage_3_코드_구현', status: 'pending' });
    });

    it('@FEATURES 체크리스트 + test_status 파싱', () => {
        const result = parseStateFile(VALID_STATE_MD, '/test/state.md');
        expect(result.features).toHaveLength(4);
        expect(result.features[0]).toEqual({ label: 'feature_칸반보드_기본 — test: pass', status: 'done', testStatus: 'pass' });
        expect(result.features[1]).toEqual({ label: 'feature_대시보드 — test: fail', status: 'in_progress', testStatus: 'fail' });
        expect(result.features[2]).toEqual({ label: 'feature_대화로그 — test: pending', status: 'pending', testStatus: 'pending' });
        expect(result.features[3]).toEqual({ label: 'feature_리뷰 — test: manual_pass', status: 'done', testStatus: 'manual_pass' });
    });

    it('rawContent 보존', () => {
        const result = parseStateFile(VALID_STATE_MD, '/test/state.md');
        expect(result.rawContent).toBe(VALID_STATE_MD);
    });
});

describe('$StateFileParser.parseStateFile — 엣지 케이스', () => {
    it('빈 파일 → graceful 기본값', () => {
        const result = parseStateFile('', '/empty.md');
        expect(result.task).toBe('알 수 없는 태스크');
        expect(result.state).toBe('UNKNOWN');
        expect(result.actor).toBe('none');
        expect(result.progress).toEqual([]);
        expect(result.features).toEqual([]);
    });

    it('state/task 필드 없는 파일 → 기본값', () => {
        const content = `[Byeorim v1.4]

# === @FSM_STATE ===

NOW 2026-03-08
retry: 0 / max: 5
actor: HUMAN
`;
        const result = parseStateFile(content, '/partial.md');
        expect(result.task).toBe('알 수 없는 태스크');
        expect(result.state).toBe('UNKNOWN');
        expect(result.actor).toBe('HUMAN');
    });

    it('test_res: none → null 변환', () => {
        const content = `task: test_task
state: MERGED
test_res: none
review_score: none
`;
        const result = parseStateFile(content, '/none.md');
        expect(result.testRes).toBeNull();
        expect(result.reviewScore).toBeNull();
    });

    it('@PROGRESS 섹션 없으면 빈 배열', () => {
        const content = `task: no_progress
state: BACKLOG
`;
        const result = parseStateFile(content, '/no-progress.md');
        expect(result.progress).toEqual([]);
    });

    it('@FEATURES 섹션 없으면 빈 배열', () => {
        const content = `task: no_features
state: BACKLOG
`;
        const result = parseStateFile(content, '/no-features.md');
        expect(result.features).toEqual([]);
    });

    it('\\r\\n 줄바꿈 호환', () => {
        const content = "task: crlf_test\r\nstate: IMPLEMENTING\r\nactor: EDITOR\r\n";
        const result = parseStateFile(content, '/crlf.md');
        expect(result.task).toBe('crlf_test');
        expect(result.state).toBe('IMPLEMENTING');
    });

    it('@PROGRESS 다음에 다른 섹션 오면 거기서 멈춤', () => {
        const content = `
# === @PROGRESS ===

[x] done_item
[-] wip_item

# === @FEATURES ===

[x] feature_1 — test: pass
`;
        const result = parseStateFile(content, '/boundary.md');
        expect(result.progress).toHaveLength(2);
        expect(result.features).toHaveLength(1);
    });

    it('주석과 빈 줄은 체크리스트에서 건너뛰기', () => {
        const content = `
# === @PROGRESS ===

# 이건 주석
[x] real_item

# 또 주석
[_] another_item
`;
        const result = parseStateFile(content, '/comments.md');
        expect(result.progress).toHaveLength(2);
        expect(result.progress[0].label).toBe('real_item');
        expect(result.progress[1].label).toBe('another_item');
    });
});
