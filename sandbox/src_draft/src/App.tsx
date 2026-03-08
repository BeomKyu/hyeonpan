import { getViewMode } from './config/adapter';
import { BoardProvider } from './hooks/useBoard';
import { BoardHeader } from './components/Board/BoardHeader';
import { ColumnList } from './components/Board/ColumnList';
import { DetailModal } from './components/Card/DetailModal';
import { DashboardView } from './components/Dashboard/DashboardView';
import { useBoard } from './hooks/useBoard';
import './App.css';

const viewMode = getViewMode();

function ManualModeContent() {
  const { modalCardId } = useBoard();

  return (
    <div className="app-container">
      <BoardHeader />
      <ColumnList />
      {modalCardId && <DetailModal />}
    </div>
  );
}

function App() {
  if (viewMode === 'dashboard') {
    return <DashboardView />;
  }

  return (
    <BoardProvider>
      <ManualModeContent />
    </BoardProvider>
  );
}

export default App;
