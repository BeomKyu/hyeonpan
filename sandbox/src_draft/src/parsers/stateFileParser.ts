// $StateFileParser — Byeorim v1.4 state.md 파서
import type { ParsedProject, ProgressItem, FeatureItem } from '../models/dashboardTypes';

/**
 * state.md 파일의 특정 필드 값을 추출한다.
 * 예: "state: IMPLEMENTING" → "IMPLEMENTING"
 */
function findField(lines: string[], fieldName: string): string {
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith(fieldName)) {
            return trimmed.slice(fieldName.length).trim();
        }
    }
    return '';
}

/**
 * 특정 섹션 헤더 이후의 체크리스트 항목을 추출한다.
 * 섹션은 "# === @SECTION ===" 형태로 시작하고,
 * 다음 "# ===" 헤더 또는 파일 끝까지 추출한다.
 * 주석(#으로 시작하는 줄)과 빈 줄은 건너뛴다.
 */
function extractChecklist(lines: string[], sectionMarker: string): string[] {
    let inSection = false;
    const items: string[] = [];

    for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.includes(sectionMarker)) {
            inSection = true;
            continue;
        }

        if (inSection && trimmed.startsWith('# ===')) {
            break;
        }

        if (inSection && (trimmed.startsWith('[x]') || trimmed.startsWith('[-]') || trimmed.startsWith('[_]'))) {
            items.push(trimmed);
        }
    }

    return items;
}

function parseProgressItem(line: string): ProgressItem {
    let status: ProgressItem['status'] = 'pending';
    if (line.startsWith('[x]')) status = 'done';
    else if (line.startsWith('[-]')) status = 'in_progress';

    // "[x] Stage_1_제약조건_도출" → "Stage_1_제약조건_도출"
    const label = line.slice(4).trim();
    return { label, status };
}

function parseFeatureItem(line: string): FeatureItem {
    let status: FeatureItem['status'] = 'pending';
    if (line.startsWith('[x]')) status = 'done';
    else if (line.startsWith('[-]')) status = 'in_progress';

    let testStatus: FeatureItem['testStatus'] = 'pending';
    if (line.includes('test: pass')) testStatus = 'pass';
    else if (line.includes('test: fail')) testStatus = 'fail';
    else if (line.includes('test: manual_pass')) testStatus = 'manual_pass';

    const label = line.slice(4).trim();
    return { label, status, testStatus };
}

/**
 * state.md 내용을 파싱하여 ParsedProject로 변환한다.
 */
export function parseStateFile(content: string, filePath: string): ParsedProject {
    try {
        const lines = content.split('\n');

        const task = findField(lines, 'task:');
        const state = findField(lines, 'state:');
        const actor = findField(lines, 'actor:');
        const retry = findField(lines, 'retry:');
        const time = findField(lines, 'time:');

        const testResRaw = findField(lines, 'test_res:');
        const reviewScoreRaw = findField(lines, 'review_score:');
        const testRes = testResRaw && testResRaw !== 'none' ? testResRaw : null;
        const reviewScore = reviewScoreRaw && reviewScoreRaw !== 'none' ? reviewScoreRaw : null;

        const progressLines = extractChecklist(lines, '@PROGRESS');
        const progress = progressLines.map(parseProgressItem);

        const featureLines = extractChecklist(lines, '@FEATURES');
        const features = featureLines.map(parseFeatureItem);

        return {
            filePath,
            task: task || '알 수 없는 태스크',
            state: state || 'UNKNOWN',
            actor: actor || 'none',
            retry,
            time,
            testRes,
            reviewScore,
            progress,
            features,
            rawContent: content,
        };
    } catch (err) {
        console.warn('state.md 파싱 실패:', filePath, err);
        return {
            filePath,
            task: '파싱_실패',
            state: 'UNKNOWN',
            actor: 'none',
            retry: '0',
            time: '',
            testRes: null,
            reviewScore: null,
            progress: [],
            features: [],
            rawContent: content,
        };
    }
}
