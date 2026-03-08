import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { parseJsonLog, parseMarkdownChat, MAX_LOG_FILE_SIZE } from '../../sandbox/src_draft/src/parsers/conversationLogParser';

// ============================================================
// v3 테스트: 대화 로그 파서 + FSM 액션
// ============================================================

// === 픽스처: JSON 대화 로그 ===

const VALID_JSON_LOG = JSON.stringify([
    {
        role: 'user',
        content: 'state.md의 progress 섹션을 분석해줘.',
        timestamp: '2026-03-08T15:00:00+09:00',
    },
    {
        role: 'agent',
        content: '분석 결과입니다.',
        diff: '-[_] Stage_3\n+[-] Stage_3',
        timestamp: '2026-03-08T15:01:00+09:00',
    },
]);

const JSON_LOG_WITH_ASSISTANT = JSON.stringify([
    { role: 'assistant', content: 'assistant role 메시지' },
    { role: 'system', content: 'system role 메시지' },
    { role: 'user', content: 'user role 메시지' },
]);

const JSON_LOG_MISSING_FIELDS = JSON.stringify([
    { role: 'user', content: '정상 메시지' },
    { role: 'user' },              // content 누락
    { content: '역할 없음' },       // role 누락
    { role: 'agent', content: '두 번째 정상' },
]);

const JSON_LOG_NOT_ARRAY = JSON.stringify({ message: '배열이 아닌 JSON' });

const INVALID_JSON = '{ not valid json !!!';

// === 픽스처: MD 대화 로그 ===

const VALID_MD_LOG = `## user
2026-03-08T15:00:00+09:00

state.md의 progress 섹션을 분석해줘.

## agent
2026-03-08T15:01:00+09:00

분석 결과입니다:

\`\`\`diff
-[_] Stage_3_코드_구현
+[-] Stage_3_코드_구현
\`\`\`
`;

const MD_LOG_NO_TIMESTAMP = `## user

타임스탬프 없는 메시지입니다.

## agent

응답입니다.
`;

const MD_LOG_MIXED_CASE = `## User
2026-03-08T15:00:00+09:00

대소문자 혼용 User 헤더

## AGENT
2026-03-08T15:01:00+09:00

대소문자 혼용 AGENT 헤더
`;

const MD_LOG_UNKNOWN_ROLE = `## system
2026-03-08T15:00:00+09:00

시스템 메시지 (agent fallback 예상)

## assistant
2026-03-08T15:01:00+09:00

어시스턴트 메시지 (agent fallback 예상)
`;

const MD_LOG_MULTI_DIFF = `## agent
2026-03-08T15:01:00+09:00

여러 파일을 수정했습니다:

\`\`\`diff
-old_line_1
+new_line_1
\`\`\`

그리고 이것도:

\`\`\`diff
-old_line_2
+new_line_2
\`\`\`
`;

// ============================================================
// $LocalLogAdapter.parse_log — JSON 테스트
// ============================================================

describe('$LocalLogAdapter — JSON 대화 로그 파싱', () => {
    it('정상 JSON → Message 배열 변환', () => {
        const messages = parseJsonLog(VALID_JSON_LOG);
        expect(messages).toHaveLength(2);
        expect(messages[0].role).toBe('user');
        expect(messages[0].content).toBe('state.md의 progress 섹션을 분석해줘.');
        expect(messages[0].timestamp).toBe('2026-03-08T15:00:00+09:00');
        expect(messages[1].role).toBe('agent');
        expect(messages[1].diff).toBe('-[_] Stage_3\n+[-] Stage_3');
    });

    it('필수 필드 누락 메시지 → 건너뛰기', () => {
        const messages = parseJsonLog(JSON_LOG_MISSING_FIELDS);
        expect(messages).toHaveLength(2);
        expect(messages[0].content).toBe('정상 메시지');
        expect(messages[1].content).toBe('두 번째 정상');
    });

    it('배열 아닌 JSON → 빈 배열', () => {
        const messages = parseJsonLog(JSON_LOG_NOT_ARRAY);
        expect(messages).toHaveLength(0);
    });

    it('role 정규화: assistant/system → agent', () => {
        const messages = parseJsonLog(JSON_LOG_WITH_ASSISTANT);
        expect(messages).toHaveLength(3);
        expect(messages[0].role).toBe('agent');   // assistant → agent
        expect(messages[1].role).toBe('agent');   // system → agent
        expect(messages[2].role).toBe('user');    // user 유지
    });

    it('유효하지 않은 JSON → 빈 배열', () => {
        const messages = parseJsonLog(INVALID_JSON);
        expect(messages).toHaveLength(0);
    });
});

// ============================================================
// $LocalLogAdapter.parse_markdown_chat — MD 테스트
// ============================================================

describe('$LocalLogAdapter — MD 대화 로그 파싱', () => {
    it('정규 형식 MD → Message 배열 변환', () => {
        const messages = parseMarkdownChat(VALID_MD_LOG);
        expect(messages).toHaveLength(2);
        expect(messages[0].role).toBe('user');
        expect(messages[0].content).toContain('progress 섹션을 분석해줘');
        expect(messages[0].timestamp).toBe('2026-03-08T15:00:00+09:00');
        expect(messages[1].role).toBe('agent');
        expect(messages[1].diff).toContain('-[_] Stage_3_코드_구현');
    });

    it('타임스탬프 없는 경우 → 자동 생성', () => {
        const messages = parseMarkdownChat(MD_LOG_NO_TIMESTAMP);
        expect(messages).toHaveLength(2);
        expect(messages[0].timestamp).toBeDefined();
        expect(messages[0].timestamp).not.toBe('');
        // ISO8601 형식 확인
        expect(new Date(messages[0].timestamp).toISOString()).toBeTruthy();
    });

    it('대소문자 혼용 role → 소문자 정규화', () => {
        const messages = parseMarkdownChat(MD_LOG_MIXED_CASE);
        expect(messages).toHaveLength(2);
        expect(messages[0].role).toBe('user');     // User → user
        expect(messages[1].role).toBe('agent');    // AGENT → agent
    });

    it('알 수 없는 role (system, assistant) → agent fallback', () => {
        const messages = parseMarkdownChat(MD_LOG_UNKNOWN_ROLE);
        expect(messages).toHaveLength(2);
        expect(messages[0].role).toBe('agent');    // system → agent
        expect(messages[1].role).toBe('agent');    // assistant → agent
    });

    it('복수 diff 블록 → concat하여 단일 diff 필드', () => {
        const messages = parseMarkdownChat(MD_LOG_MULTI_DIFF);
        expect(messages).toHaveLength(1);
        expect(messages[0].diff).toContain('-old_line_1');
        expect(messages[0].diff).toContain('+new_line_1');
        expect(messages[0].diff).toContain('-old_line_2');
        expect(messages[0].diff).toContain('+new_line_2');
    });
});

// ============================================================
// $Dashboard.Actions — FSM 전이 테스트
// ============================================================

import { FSM_TRANSITION_MAP, ACTIONABLE_STATES } from '../../sandbox/src_draft/src/models/dashboardTypes';
import { isActionable } from '../../sandbox/src_draft/src/hooks/useDashboard';

describe('$Dashboard.Actions — FSM 전이', () => {
    // --- approve 테스트 ---

    it('approve: SPEC_REVIEW → IMPLEMENTING', () => {
        expect(FSM_TRANSITION_MAP.approve['SPEC_REVIEW']).toBe('IMPLEMENTING');
    });

    it('approve: ADVERSARIAL_REVIEW → PENDING_APPROVAL', () => {
        expect(FSM_TRANSITION_MAP.approve['ADVERSARIAL_REVIEW']).toBe('PENDING_APPROVAL');
    });

    it('approve: PENDING_APPROVAL → MERGED', () => {
        expect(FSM_TRANSITION_MAP.approve['PENDING_APPROVAL']).toBe('MERGED');
    });

    // --- reject 테스트 ---

    it('reject: SPEC_REVIEW → BACKLOG', () => {
        expect(FSM_TRANSITION_MAP.reject['SPEC_REVIEW']).toBe('BACKLOG');
    });

    it('reject: ADVERSARIAL_REVIEW → IMPLEMENTING', () => {
        expect(FSM_TRANSITION_MAP.reject['ADVERSARIAL_REVIEW']).toBe('IMPLEMENTING');
    });

    it('reject: PENDING_APPROVAL → IMPLEMENTING', () => {
        expect(FSM_TRANSITION_MAP.reject['PENDING_APPROVAL']).toBe('IMPLEMENTING');
    });

    // --- 비활성 상태 테스트 ---

    it('is_actionable: 활성 상태 → true', () => {
        expect(isActionable('SPEC_REVIEW')).toBe(true);
        expect(isActionable('ADVERSARIAL_REVIEW')).toBe(true);
        expect(isActionable('PENDING_APPROVAL')).toBe(true);
    });

    it('is_actionable: 비활성 상태 → false', () => {
        expect(isActionable('BACKLOG')).toBe(false);
        expect(isActionable('SPEC_ANALYZE')).toBe(false);
        expect(isActionable('IMPLEMENTING')).toBe(false);
        expect(isActionable('TEST_RUNNING')).toBe(false);
        expect(isActionable('MERGED')).toBe(false);
    });

    it('approve: 비활성 상태에서 전이 불가 (undefined)', () => {
        expect(FSM_TRANSITION_MAP.approve['IMPLEMENTING']).toBeUndefined();
        expect(FSM_TRANSITION_MAP.approve['BACKLOG']).toBeUndefined();
        expect(FSM_TRANSITION_MAP.approve['MERGED']).toBeUndefined();
    });
});

// ============================================================
// 파일 크기 제한 + \r\n 호환 테스트
// ============================================================

describe('파일 크기 제한', () => {
    it('MAX_LOG_FILE_SIZE = 5MB', () => {
        expect(MAX_LOG_FILE_SIZE).toBe(5 * 1024 * 1024);
    });
});

describe('\\r\\n 호환성', () => {
    it('MD 파싱: \\r\\n 줄바꿈도 정상 처리', () => {
        const mdWithCRLF = '## user\r\n2026-03-08T15:00:00+09:00\r\n\r\nCRLF 메시지\r\n\r\n## agent\r\n2026-03-08T15:01:00+09:00\r\n\r\n응답입니다\r\n';
        const messages = parseMarkdownChat(mdWithCRLF);
        expect(messages).toHaveLength(2);
        expect(messages[0].role).toBe('user');
        expect(messages[0].content).toContain('CRLF 메시지');
        expect(messages[1].role).toBe('agent');
    });

    it('MD 파싱: \\r\\n diff 블록도 추출', () => {
        const mdDiffCRLF = '## agent\r\n2026-03-08T15:01:00+09:00\r\n\r\n수정:\r\n\r\n```diff\r\n-old\r\n+new\r\n```\r\n';
        const messages = parseMarkdownChat(mdDiffCRLF);
        expect(messages).toHaveLength(1);
        expect(messages[0].diff).toContain('-old');
        expect(messages[0].diff).toContain('+new');
    });
});

