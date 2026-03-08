import { useState, useRef, useEffect } from 'react';
import { useBoard } from '../../hooks/useBoard';
import { DiffBlock } from './DiffBlock';
import './DetailModal.css';

export function DetailModal() {
    const { board, modalCardId, updateCard, addMessage, closeDetail } = useBoard();
    const [newMessage, setNewMessage] = useState('');
    const [newRole, setNewRole] = useState<'user' | 'agent'>('user');
    const [newDiff, setNewDiff] = useState('');
    const [showDiffInput, setShowDiffInput] = useState(false);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editTitle, setEditTitle] = useState('');
    const timelineEndRef = useRef<HTMLDivElement>(null);

    const card = modalCardId ? board.cards[modalCardId] : null;

    useEffect(() => {
        timelineEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [card?.messages.length]);

    if (!card) return null;

    const handleSend = () => {
        if (!newMessage.trim()) return;
        addMessage(card.id, newRole, newMessage.trim(), showDiffInput && newDiff.trim() ? newDiff.trim() : null);
        setNewMessage('');
        setNewDiff('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleTitleSave = () => {
        if (editTitle.trim()) {
            updateCard(card.id, { title: editTitle.trim() });
        }
        setIsEditingTitle(false);
    };

    const formatTime = (timestamp: string) => {
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
    };

    return (
        <div className="modal-overlay" onClick={closeDetail}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="modal-header">
                    {isEditingTitle ? (
                        <input
                            className="modal-title-input"
                            value={editTitle}
                            onChange={e => setEditTitle(e.target.value)}
                            onBlur={handleTitleSave}
                            onKeyDown={e => e.key === 'Enter' && handleTitleSave()}
                            autoFocus
                        />
                    ) : (
                        <h2 className="modal-title" onClick={() => { setIsEditingTitle(true); setEditTitle(card.title); }}>
                            {card.title}
                        </h2>
                    )}
                    <button className="modal-close-btn" onClick={closeDetail}>×</button>
                </div>

                {/* Conversation Timeline */}
                <div className="conversation-timeline">
                    {card.messages.length === 0 ? (
                        <div className="timeline-empty">
                            <span className="timeline-empty-icon">💬</span>
                            <span>대화를 시작하세요</span>
                        </div>
                    ) : (
                        card.messages.map(msg => (
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
                        ))
                    )}
                    <div ref={timelineEndRef} />
                </div>

                {/* Message Input */}
                <div className="message-input-area">
                    <div className="input-controls">
                        <button
                            className={`role-toggle ${newRole}`}
                            onClick={() => setNewRole(prev => prev === 'user' ? 'agent' : 'user')}
                        >
                            {newRole === 'user' ? '👤 User' : '🤖 Agent'}
                        </button>
                        <button
                            className={`diff-toggle ${showDiffInput ? 'active' : ''}`}
                            onClick={() => setShowDiffInput(prev => !prev)}
                        >
                            &lt;/&gt; Diff
                        </button>
                    </div>

                    <textarea
                        className="message-textarea"
                        value={newMessage}
                        onChange={e => setNewMessage(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="메시지를 입력하세요... (Enter로 전송, Shift+Enter로 줄바꿈)"
                        rows={2}
                    />

                    {showDiffInput && (
                        <textarea
                            className="diff-textarea"
                            value={newDiff}
                            onChange={e => setNewDiff(e.target.value)}
                            placeholder={"+ 추가된 라인\n- 삭제된 라인\n  변경 없는 라인"}
                            rows={4}
                        />
                    )}

                    <button
                        className="send-btn"
                        onClick={handleSend}
                        disabled={!newMessage.trim()}
                    >
                        전송
                    </button>
                </div>
            </div>
        </div>
    );
}
