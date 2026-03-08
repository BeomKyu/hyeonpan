// $ConversationLogSource — 대화 로그 파서
// v3: .md / .json 대화 로그 파싱 → Message[] 반환 (읽기 전용)

import type { Message } from '../models/types';
import { v4 as uuidv4 } from 'uuid';

// ============================================================
// JSON 대화 로그 파싱
// ============================================================

interface RawLogMessage {
    role?: string;
    content?: string;
    diff?: string | null;
    timestamp?: string;
    id?: string;
}

function normalizeRole(role: string): 'user' | 'agent' {
    if (role.toLowerCase() === 'user') return 'user';
    // assistant, system, 기타 → agent fallback
    return 'agent';
}

function validateMessage(msg: RawLogMessage): boolean {
    if (!msg.role || !msg.content) {
        console.warn('필수 필드 누락, 메시지 건너뛰기:', msg);
        return false;
    }
    return true;
}

function normalizeMessage(msg: RawLogMessage): Message {
    return {
        id: msg.id ?? uuidv4(),
        role: normalizeRole(msg.role!),
        content: msg.content!,
        diff: msg.diff ?? null,
        timestamp: msg.timestamp ?? new Date().toISOString(),
    };
}

export function parseJsonLog(jsonString: string): Message[] {
    try {
        const raw: unknown = JSON.parse(jsonString);
        if (!Array.isArray(raw)) {
            console.warn('JSON 대화 로그: 배열이 아님');
            return [];
        }
        return (raw as RawLogMessage[])
            .filter(validateMessage)
            .map(normalizeMessage);
    } catch {
        console.warn('JSON 대화 로그 파싱 실패');
        return [];
    }
}

// ============================================================
// 마크다운 대화 로그 파싱
// ============================================================

const ISO8601_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
const DIFF_BLOCK_REGEX = /```diff\r?\n([\s\S]*?)```/g;

function isIso8601(line: string): boolean {
    return ISO8601_REGEX.test(line.trim());
}

function extractDiffBlocks(body: string): { diffs: string[]; cleanBody: string } {
    const diffs: string[] = [];
    const cleanBody = body.replace(DIFF_BLOCK_REGEX, (_match, diffContent: string) => {
        diffs.push(diffContent.trimEnd());
        return '';
    });
    return { diffs, cleanBody };
}

export function parseMarkdownChat(content: string): Message[] {
    // \r\n → \n 정규화 (Windows 줄바꿈 호환)
    const normalized = content.replace(/\r\n/g, '\n');
    // "## " 기준으로 분할
    const sections = normalized.split(/^## /m);
    const messages: Message[] = [];

    for (const section of sections) {
        const trimmed = section.trim();
        if (!trimmed) continue;

        // 첫 줄 = role
        const firstNewline = trimmed.indexOf('\n');
        if (firstNewline === -1) continue;

        const roleRaw = trimmed.substring(0, firstNewline).trim().toLowerCase();

        // frontmatter 방어: role이 한 단어가 아니거나 20자 초과 → SKIP
        if (roleRaw.includes(' ') || roleRaw.length > 20) continue;

        const role = normalizeRole(roleRaw);
        let remaining = trimmed.substring(firstNewline + 1);

        // timestamp 추출
        let timestamp: string;
        const lines = remaining.split('\n');
        const secondLine = lines[0]?.trim() ?? '';

        if (isIso8601(secondLine)) {
            timestamp = secondLine;
            remaining = lines.slice(1).join('\n');
        } else {
            timestamp = new Date().toISOString();
        }

        // diff 블록 추출 (복수 → concat)
        const { diffs, cleanBody } = extractDiffBlocks(remaining);
        const diff = diffs.length > 0 ? diffs.join('\n') : null;

        // content = diff 블록 제거 후 trim
        const textContent = cleanBody.trim();
        if (!textContent) continue;

        messages.push({
            id: uuidv4(),
            role,
            content: textContent,
            diff,
            timestamp,
        });
    }

    return messages;
}

// ============================================================
// 통합 파싱 함수
// ============================================================

export function parseConversationLog(content: string, format: 'md' | 'json'): Message[] {
    if (format === 'json') return parseJsonLog(content);
    if (format === 'md') return parseMarkdownChat(content);
    return [];
}

// 파일 크기 제한 (5MB)
export const MAX_LOG_FILE_SIZE = 5 * 1024 * 1024;
