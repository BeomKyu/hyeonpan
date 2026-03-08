import { BoardProvider } from './hooks/useBoard';
import { BoardHeader } from './components/Board/BoardHeader';
import { ColumnList } from './components/Board/ColumnList';
import { DetailModal } from './components/Card/DetailModal';
import { useBoard } from './hooks/useBoard';
import './App.css';

function AppContent() {
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
  return (
    <BoardProvider>
      <AppContent />
    </BoardProvider>
  );
}

export default App;
