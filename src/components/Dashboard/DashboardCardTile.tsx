// DashboardCardTile — 대시보드 프로젝트 카드
import type { DashboardCard } from '../../hooks/useDashboard';
import './DashboardCardTile.css';

interface Props {
    card: DashboardCard;
    onClick: () => void;
}

export function DashboardCardTile({ card, onClick }: Props) {
    const { _parsed: project, _progressPct, _needsHuman } = card;

    return (
        <div className={`dashboard-card${_needsHuman ? ' needs-human' : ''}`} onClick={onClick}>
            <div className="dashboard-card__title">{card.title}</div>

            <div className="dashboard-card__badges">
                <span className={`badge badge--state badge--${project.state.toLowerCase()}`}>
                    {project.state}
                </span>
                <span className={`badge badge--actor${_needsHuman ? ' badge--human' : ''}`}>
                    {project.actor}
                    {_needsHuman && ' 🔔'}
                </span>
            </div>

            <div className="dashboard-card__progress">
                <div className="progress-bar">
                    <div className="progress-bar__fill" style={{ width: `${_progressPct}%` }} />
                </div>
                <span className="progress-label">{_progressPct}%</span>
            </div>

            {(project.testRes || project.reviewScore) && (
                <div className="dashboard-card__meta">
                    {project.testRes && <span className="meta-badge meta-badge--test">{project.testRes}</span>}
                    {project.reviewScore && <span className="meta-badge meta-badge--review">{project.reviewScore}</span>}
                </div>
            )}
        </div>
    );
}
