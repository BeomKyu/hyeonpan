// DashboardDetailModal — 프로젝트 상세 모달 (info/raw/chat 탭)
import { useState } from 'react';
import type { DashboardCard } from '../../hooks/useDashboard';
import './DashboardDetailModal.css';

interface Props {
    card: DashboardCard;
    onClose: () => void;
}

export function DashboardDetailModal({ card, onClose }: Props) {
    const [activeTab, setActiveTab] = useState<'info' | 'raw' | 'chat'>('info');
    const { _parsed: project, _progressPct } = card;

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
                    <button className="dash-modal__close" onClick={onClose}>×</button>
                </div>

                <div className="dash-modal__tabs">
                    <button className={`tab-btn${activeTab === 'info' ? ' active' : ''}`} onClick={() => setActiveTab('info')}>📋 프로젝트 정보</button>
                    <button className={`tab-btn${activeTab === 'raw' ? ' active' : ''}`} onClick={() => setActiveTab('raw')}>📄 원본</button>
                    <button className={`tab-btn${activeTab === 'chat' ? ' active' : ''}`} onClick={() => setActiveTab('chat')}>💬 대화</button>
                </div>

                <div className="dash-modal__body">
                    {activeTab === 'info' && (
                        <>
                            {/* @PROGRESS */}
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

                            {/* @FEATURES */}
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

                            {/* Meta */}
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
                            <div className="chat-placeholder">
                                <p>💬 대화 기능은 v1 수동 모드에서 사용 가능합니다.</p>
                                <p className="chat-hint">VITE_ADAPTER_MODE=manual 로 전환하세요.</p>
                            </div>
                        </section>
                    )}
                </div>
            </div>
        </div>
    );
}
