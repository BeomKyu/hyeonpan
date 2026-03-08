// DashboardDetailModal — 프로젝트 상세 모달 (info/raw/chat 탭) [v3]
import { useState, useRef, useEffect, useCallback } from 'react';
import type { DashboardCard } from '../../hooks/useDashboard';
import { isActionable } from '../../hooks/useDashboard';
import type { Message } from '../../models/types';
import { DiffBlock } from '../Card/DiffBlock';
import './DashboardDetailModal.css';

interface Props {
    card: DashboardCard;
    onClose: () => void;
    loadMessages: (registeredId: string) => Message[];
    onImportLog: (registeredId: string, file: File) => Promise<void>;
    onApprove: (card: DashboardCard) => void;
    onReject: (card: DashboardCard) => void;
    onRefresh: (registeredId: string, file: File) => Promise<void>;
}

function formatTime(timestamp: string): string {
    try {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return '방금';
        if (mins < 60) return `${mins}분 전`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}시간 전`;
        return date.toLocaleDateString('ko-KR');
    } catch {
        return timestamp;
    }
}

export function DashboardDetailModal({
    card, onClose, loadMessages, onImportLog, onApprove, onReject, onRefresh,
}: Props) {
    const [activeTab, setActiveTab] = useState<'info' | 'raw' | 'chat'>('info');
    const { _parsed: project, _progressPct, _registeredId } = card;
    const [messages, setMessages] = useState<Message[]>([]);
    const timelineEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (activeTab === 'chat') {
            setMessages(loadMessages(_registeredId));
        }
    }, [activeTab, _registeredId, loadMessages]);

    useEffect(() => {
        if (activeTab === 'chat') {
            timelineEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages.length, activeTab]);

    const handleImport = useCallback(async () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.md,.json';
        input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) return;
            await onImportLog(_registeredId, file);
            // 임포트 직후 즉시 재로드 (useEffect 재실행 전 깜빡임 방지)
            setMessages(loadMessages(_registeredId));
        };
        input.click();
    }, [_registeredId, onImportLog, loadMessages]);

    const handleRefresh = useCallback(async () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.md';
        input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) return;
            await onRefresh(_registeredId, file);
        };
        input.click();
    }, [_registeredId, onRefresh]);

    const actionable = isActionable(project.state);

    return (
        <div className="dash-modal-overlay" onClick={onClose}>
            <div className="dash-modal" onClick={e => e.stopPropagation()}>
                <div className="dash-modal__header">
                    <div className="dash-modal__title-row">
                        <h2>{card.title}</h2>
                        <div className="dash-modal__badges">
                            <span className={`badge badge--state badge--${project.state.toLowerCase()}`}>{project.state}</span>
                            <span className={`badge badge--actor${project.actor === 'HUMAN' ? ' badge--human' : ''}`}>{project.actor}</span>
                        </div>
                    </div>
                    <div className="dash-modal__actions">
                        <button
                            className="action-btn action-btn--approve"
                            onClick={() => onApprove(card)}
                            disabled={!actionable}
                            title={actionable ? 'Approve (FSM 전이)' : '이 상태에서는 approve 불가'}
                        >
                            ✅ Approve
                        </button>
                        <button
                            className="action-btn action-btn--reject"
                            onClick={() => onReject(card)}
                            disabled={!actionable}
                            title={actionable ? 'Reject (FSM 롤백)' : '이 상태에서는 reject 불가'}
                        >
                            🔙 Reject
                        </button>
                        <button
                            className="action-btn action-btn--refresh"
                            onClick={handleRefresh}
                            title="state.md 파일 다시 읽기"
                        >
                            🔄 리프레시
                        </button>
                        <button className="dash-modal__close" onClick={onClose}>×</button>
                    </div>
                </div>

                <div className="dash-modal__tabs">
                    <button className={`tab-btn${activeTab === 'info' ? ' active' : ''}`} onClick={() => setActiveTab('info')}>📋 프로젝트 정보</button>
                    <button className={`tab-btn${activeTab === 'raw' ? ' active' : ''}`} onClick={() => setActiveTab('raw')}>📄 원본</button>
                    <button className={`tab-btn${activeTab === 'chat' ? ' active' : ''}`} onClick={() => setActiveTab('chat')}>💬 대화</button>
                </div>

                <div className="dash-modal__body">
                    {activeTab === 'info' && (
                        <>
                            <section className="dash-section">
                                <h3>@PROGRESS <span className="progress-pct">{_progressPct}%</span></h3>
                                <div className="progress-bar progress-bar--large">
                                    <div className="progress-bar__fill" style={{ width: `${_progressPct}%` }} />
                                </div>
                                <ul className="checklist">
                                    {project.progress.map((item, i) => (
                                        <li key={i} className={`checklist-item checklist-item--${item.status}`}>
                                            <span className="checklist-icon">
                                                {item.status === 'done' ? '✅' : item.status === 'in_progress' ? '🔄' : '⬜'}
                                            </span>
                                            {item.label}
                                        </li>
                                    ))}
                                </ul>
                            </section>
                            <section className="dash-section">
                                <h3>@FEATURES</h3>
                                <ul className="checklist">
                                    {project.features.map((feat, i) => (
                                        <li key={i} className={`checklist-item checklist-item--${feat.status}`}>
                                            <span className="checklist-icon">
                                                {feat.status === 'done' ? '✅' : feat.status === 'in_progress' ? '🔄' : '⬜'}
                                            </span>
                                            <span className="feature-label">{feat.label}</span>
                                            <span className={`test-badge test-badge--${feat.testStatus}`}>{feat.testStatus}</span>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                            <section className="dash-section dash-section--meta">
                                <div className="meta-grid">
                                    <div className="meta-item"><span className="meta-key">retry</span><span className="meta-val">{project.retry}</span></div>
                                    <div className="meta-item"><span className="meta-key">time</span><span className="meta-val">{project.time}</span></div>
                                    {project.testRes && <div className="meta-item"><span className="meta-key">test</span><span className="meta-val">{project.testRes}</span></div>}
                                    {project.reviewScore && <div className="meta-item"><span className="meta-key">review</span><span className="meta-val">{project.reviewScore}</span></div>}
                                </div>
                            </section>
                        </>
                    )}

                    {activeTab === 'raw' && (
                        <section className="dash-section">
                            <pre className="raw-content">{project.rawContent}</pre>
                        </section>
                    )}

                    {activeTab === 'chat' && (
                        <section className="dash-section">
                            {messages.length === 0 ? (
                                <div className="chat-empty">
                                    <span className="chat-empty__icon">💬</span>
                                    <p className="chat-empty__text">대화 기록이 없습니다</p>
                                    <p className="chat-empty__hint">.md 또는 .json 형식의 대화 로그를 임포트하세요</p>
                                    <button className="chat-import-btn" onClick={handleImport}>
                                        📥 대화 로그 임포트
                                    </button>
                                </div>
                            ) : (
                                <div className="conversation-timeline">
                                    {messages.map(msg => (
                                        <div key={msg.id} className={`message-bubble ${msg.role}`}>
                                            <div className="bubble-role-label">
                                                {msg.role === 'user' ? '👤 User' : '🤖 Agent'}
                                            </div>
                                            <div className="bubble-content">
                                                {msg.content}
                                            </div>
                                            {msg.diff && <DiffBlock diffText={msg.diff} />}
                                            <div className="bubble-timestamp">{formatTime(msg.timestamp)}</div>
                                        </div>
                                    ))}
                                    <div ref={timelineEndRef} />
                                </div>
                            )}
                        </section>
                    )}
                </div>
            </div>
        </div>
    );
}
