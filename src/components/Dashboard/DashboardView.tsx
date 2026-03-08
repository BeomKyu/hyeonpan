// DashboardView — FSM 칼럼 기반 대시보드 메인 뷰
import { useDashboard } from '../../hooks/useDashboard';
import type { DashboardCard } from '../../hooks/useDashboard';
import { DashboardCardTile } from './DashboardCardTile';
import { DashboardDetailModal } from './DashboardDetailModal';
import { ProjectManager } from './ProjectManager';
import './DashboardView.css';

export function DashboardView() {
    const {
        projects,
        board,
        visibleColumns,
        modalCardId,
        collapseEmpty,
        errorMessage,
        setCollapseEmpty,
        setErrorMessage,
        handleAddManual,
        handleAddFromPicker,
        handleRemoveProject,
        openDetail,
        closeDetail,
    } = useDashboard();

    const modalCard = modalCardId ? (board.cards[modalCardId] as DashboardCard) : null;

    return (
        <div className="dashboard">
            <header className="dashboard__header">
                <h1 className="dashboard__title">현판 <span className="dashboard__subtitle">Denavy 대시보드</span></h1>
                <label className="dashboard__collapse-toggle">
                    <input
                        type="checkbox"
                        checked={collapseEmpty}
                        onChange={e => setCollapseEmpty(e.target.checked)}
                    />
                    빈 칼럼 숨기기
                </label>
            </header>

            <ProjectManager
                projects={projects}
                errorMessage={errorMessage}
                onAddManual={handleAddManual}
                onAddFromPicker={handleAddFromPicker}
                onRemoveProject={handleRemoveProject}
                onDismissError={() => setErrorMessage(null)}
            />

            <div className="dashboard__columns">
                {visibleColumns.map(col => (
                    <div key={col.id} className="dashboard__column">
                        <div className="dashboard__column-header">
                            <span className={`column-title column-title--${col.title.toLowerCase()}`}>{col.title}</span>
                            <span className="column-count">{col.card_ids.length}</span>
                        </div>
                        <div className="dashboard__column-body">
                            {col.card_ids.map(cardId => {
                                const card = board.cards[cardId] as DashboardCard;
                                if (!card) return null;
                                return (
                                    <DashboardCardTile key={cardId} card={card} onClick={() => openDetail(cardId)} />
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {modalCard && (
                <DashboardDetailModal card={modalCard} onClose={closeDetail} />
            )}
        </div>
    );
}
