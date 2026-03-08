// ProjectManager — 프로젝트 등록/관리 패널
import { useState, useRef } from 'react';
import type { RegisteredProject } from '../../models/dashboardTypes';
import './ProjectManager.css';

interface Props {
    projects: RegisteredProject[];
    errorMessage: string | null;
    onAddManual: (label: string, content: string) => void;
    onAddFromPicker: (file: File) => void;
    onRemoveProject: (id: string) => void;
    onDismissError: () => void;
}

export function ProjectManager({
    projects, errorMessage,
    onAddManual, onAddFromPicker, onRemoveProject, onDismissError,
}: Props) {
    const [labelInput, setLabelInput] = useState('');
    const [contentInput, setContentInput] = useState('');
    const [isExpanded, setIsExpanded] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleAddManual = () => {
        if (!labelInput.trim() || !contentInput.trim()) return;
        onAddManual(labelInput.trim(), contentInput.trim());
        setLabelInput('');
        setContentInput('');
    };

    const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) onAddFromPicker(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="project-manager">
            <button className="pm-toggle" onClick={() => setIsExpanded(!isExpanded)}>
                {isExpanded ? '▼' : '▶'} 프로젝트 관리 <span className="pm-count">{projects.length}</span>
            </button>

            {isExpanded && (
                <div className="pm-panel">
                    {/* 에러 토스트 */}
                    {errorMessage && (
                        <div className="pm-error">
                            <span>{errorMessage}</span>
                            <button onClick={onDismissError}>×</button>
                        </div>
                    )}

                    {/* 온보딩 가이드 */}
                    {projects.length === 0 && (
                        <div className="pm-onboarding">
                            <h4>프로젝트를 추가하세요</h4>
                            <ol>
                                <li>아래 <strong>'파일 선택'</strong> 버튼으로 <code>.denavy/state.md</code> 파일을 임포트하세요</li>
                                <li>또는 <strong>'수동 등록'</strong> 폼에 state.md 내용을 직접 붙여넣기하세요</li>
                                <li>등록된 프로젝트가 FSM 상태별 칼럼에 자동 배치됩니다</li>
                            </ol>
                        </div>
                    )}

                    {/* 등록된 프로젝트 목록 */}
                    {projects.length > 0 && (
                        <div className="pm-list">
                            {projects.map(p => (
                                <div key={p.id} className="pm-row">
                                    <span className="pm-label">{p.label}</span>
                                    <span className="pm-source">{p.sourceType}</span>
                                    <button className="pm-remove" onClick={() => onRemoveProject(p.id)}>×</button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* 파일 피커 */}
                    <div className="pm-actions">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".md"
                            onChange={handleFilePick}
                            style={{ display: 'none' }}
                        />
                        <button className="pm-btn pm-btn--picker" onClick={() => fileInputRef.current?.click()}>
                            📂 파일 선택
                        </button>
                    </div>

                    {/* 수동 등록 폼 */}
                    <details className="pm-manual-section">
                        <summary>수동 등록</summary>
                        <div className="pm-manual-form">
                            <input
                                type="text"
                                placeholder="프로젝트 이름"
                                value={labelInput}
                                onChange={e => setLabelInput(e.target.value)}
                                className="pm-input"
                            />
                            <textarea
                                placeholder="state.md 내용을 붙여넣기..."
                                value={contentInput}
                                onChange={e => setContentInput(e.target.value)}
                                className="pm-textarea"
                                rows={5}
                            />
                            <button className="pm-btn pm-btn--add" onClick={handleAddManual}
                                disabled={!labelInput.trim() || !contentInput.trim()}>
                                + 등록
                            </button>
                        </div>
                    </details>
                </div>
            )}
        </div>
    );
}
