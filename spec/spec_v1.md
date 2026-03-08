[Byeorim v1.4]
@SPEC

NOW 2026-03-08
$Hyeonpan.KanbanBoard: v5.0

# === 프로젝트 개요 ===
# 노션 스타일 칸반보드 + 대화형 히스토리 뷰어.
# v1: 수동 카드 CRUD + 대화뷰 + diff 표시 + 어댑터 패턴.
# v2: Denavy 프로젝트 통합 대시보드.
#     - state.md 파일 파싱 → 프로젝트 카드 자동 생성
#     - FSM 상태별 고정 칼럼 (BACKLOG ~ MERGED)
#     - 복수 프로젝트 등록/임포트
#     - 카드 클릭 → @FEATURES 체크리스트 + @PROGRESS 진행률

use $React
use $Vite
use $dnd-kit/core
use $dnd-kit/sortable
url app = http://localhost:5173

# ============================================================
# 데이터 모델
# ============================================================

$Model.Message:
  id: String = uuid()
  role: String                     # "user" | "agent"
  content: String
  diff: String | null = null       # unified diff 포맷. 있으면 DiffBlock 렌더링
  timestamp: String = iso8601()

$Model.Card:
  id: String = uuid()
  title: String
  description: String = ""
  messages: List($Model.Message) = []
  column_id: String
  created_at: String = iso8601()

$Model.Column:
  id: String = uuid()
  title: String
  order: Int
  card_ids: List(String) = []

$Model.Board:
  columns: List($Model.Column)
  cards: Map(String = $Model.Card)

# ============================================================
# 데이터 어댑터 인터페이스
# ============================================================

$DataAdapter:
  load_board(): $Model.Board
  save_board(board: $Model.Board): void
  add_message(card_id: String, msg: $Model.Message): void

$ManualAdapter :+ $DataAdapter:
  STORAGE_KEY = "hyeonpan_board_data"

  load_board():
    TX load_operation:
      raw <- localStorage.getItem(STORAGE_KEY)
      ? raw == null:
        => $Board.default_board()
      parsed = raw |> from_json()
      => parsed
    FAIL err:
      # JSON 파싱 실패 시 기본값 반환 (손상된 데이터 보호)
      /> console.warn("localStorage 파싱 실패, 기본 보드 로드", err)
      => $Board.default_board()

  save_board(board):
    TX save_operation:
      data = board |> to_json()
      >/ localStorage.setItem(STORAGE_KEY, data)
    FAIL err:
      /> console.warn("localStorage 저장 실패", err)

  add_message(card_id, msg):
    board = load_board()
    ? board.cards[card_id] == null:
      /> console.warn("존재하지 않는 card_id:", card_id)
      => void
    board.cards[card_id].messages |> append(msg)
    save_board(board)

$ApiAdapter :+ $DataAdapter:
  url api_base = ""    # .env VITE_API_BASE_URL에서 주입

  load_board():
    TX api_load:
      board <- $HTTP.get(api_base + "/board")
      => board
    FAIL err:
      /> console.warn("API 로드 실패", err)
      => $Board.default_board()

  save_board(board):
    TX api_save:
      >/ $HTTP.put(api_base + "/board", board)
    FAIL err:
      /> console.warn("API 저장 실패", err)

  add_message(card_id, msg):
    TX api_msg:
      >/ $HTTP.post(api_base + "/cards/" + card_id + "/messages", msg)
    FAIL err:
      /> console.warn("API 메시지 저장 실패", err)

# 어댑터 선택: .env의 VITE_ADAPTER_MODE로 결정
$Config:
  adapter_mode: String = import.meta.env.VITE_ADAPTER_MODE | "manual"
  api_base_url: String = import.meta.env.VITE_API_BASE_URL | ""

  get_adapter():
    ? adapter_mode == "api":
      => $ApiAdapter(api_base = api_base_url)
    => $ManualAdapter()

# ============================================================
# 컴포넌트 트리
# ============================================================

PUB $App.Root:
  use $Board.Provider

  UI app_container:
    $Board.Header
    $Board.ColumnList
    ? modal_card_id != null:
      $Card.DetailModal(modal_card_id)

# --- 헤더 ---

$Board.Header:
  UI header_bar:
    # 앱 타이틀 "현판" + 새 칼럼 추가 버튼
    CLK add_column_btn:
      $Board.Actions.add_column()

# --- 칼럼 목록 (@dnd-kit SortableContext로 칼럼 순서 변경) ---

$Board.ColumnList:
  use $dnd-kit/SortableContext
  UI column_list_container:
    # 가로 스크롤. 칼럼 드래그앤드롭으로 순서 변경 가능.
    * column in columns |> sort_by(order):
      $Board.Column(column)

    # 칼럼 드롭 이벤트 핸들링
    CLK on_drag_end_column:
      $Board.Actions.reorder_columns(active_id, over_id)

$Board.Column(column: $Model.Column):
  use $dnd-kit/SortableContext
  UI column_wrapper:
    UI column_header:
      ST is_editing_title: Bool = false

      CLK title_text:
        is_editing_title = true

      ? is_editing_title:
        UI edit_input:
          CLK on_blur:
            $Board.Actions.rename_column(column.id, new_title)
            is_editing_title = false

      CLK delete_column_btn:
        $Board.Actions.delete_column(column.id)

      CLK add_card_btn:
        $Board.Actions.add_card(column.id)

    # 카드 드롭 존 (@dnd-kit 드래그 영역)
    UI card_drop_zone:
      * card_id in column.card_ids:
        card = $Board.State.cards[card_id]
        ? card != null:
          $Board.CardTile(card)

      CLK on_drag_end_card:
        $Board.Actions.move_card(active_id, from_col, to_col, to_index)

# --- 카드 타일 ---

$Board.CardTile(card: $Model.Card):
  UI card_tile:
    # 드래그 핸들 + 제목 + 메시지 수 배지
    CLK card_surface:
      $Board.Actions.open_detail(card.id)

    CLK delete_btn:
      $Board.Actions.delete_card(card.id)

# --- 카드 상세 모달 (대화형 히스토리 뷰) ---

$Card.DetailModal(card_id: String):
  card = $Board.State.cards[card_id]
  ? card == null:
    => null

  UI modal_overlay:
    UI modal_content:
      UI title_input:
        CLK on_change:
          $Board.Actions.update_card(card_id, title = new_value)

      # 대화 타임라인
      UI conversation_timeline:
        * msg in card.messages:
          $Card.MessageBubble(msg)

      # 메시지 입력 영역
      UI message_input_area:
        ST new_message: String = ""
        ST new_role: String = "user"
        ST new_diff: String = ""
        ST show_diff_input: Bool = false

        # role 토글 버튼
        CLK role_toggle:
          new_role = ? new_role == "user": "agent" | "user"

        # diff 입력 토글
        CLK diff_toggle:
          show_diff_input = !show_diff_input

        ? show_diff_input:
          UI diff_textarea:
            # unified diff 포맷 입력

        CLK send_btn:
          MUST new_message != ""
          msg = $Model.Message(
            role = new_role
            content = new_message
            diff = ? new_diff != "": new_diff | null
          )
          $Board.Actions.add_message(card_id, msg)
          new_message = ""
          new_diff = ""

      CLK close_btn:
        $Board.Actions.close_detail()

# --- 메시지 말풍선 ---

$Card.MessageBubble(msg: $Model.Message):
  UI bubble_wrapper:
    # role == "user" → 좌측 정렬, 파란 계열
    # role == "agent" → 우측 정렬, 회색 계열

    UI bubble_content:
      msg.content

    ? msg.diff != null:
      $Card.DiffBlock(msg.diff)

    UI timestamp_label:
      msg.timestamp |> format_relative()

# --- Diff 블록 ---

$Card.DiffBlock(diff_text: String):
  UI diff_container:
    * line in diff_text |> split_lines():
      ? line |> starts_with("+"):
        UI diff_line_add: line       # 초록 배경
      ? line |> starts_with("-"):
        UI diff_line_remove: line    # 빨강 배경
      UI diff_line_context: line     # 무색

# ============================================================
# 상태 관리
# ============================================================

$Board.Provider:
  adapter = $Config.get_adapter()
  ST board: $Model.Board = adapter.load_board()
  ST modal_card_id: String | null = null

  $Board.State.on_change:
    /> adapter.save_board(board)

# ============================================================
# 액션 정의
# ============================================================

$Board.Actions:

  # --- 칼럼 CRUD ---

  add_column():
    new_col = $Model.Column(title = "새_칼럼", order = columns.length)
    board.columns |> append(new_col)
    => board

  delete_column(column_id: String):
    MUST column_id != ""
    target = board.columns |> find(c: c.id == column_id)
    ? target == null:
      /> console.warn("존재하지 않는 column_id:", column_id)
      => board
    # 연쇄 삭제: 칼럼 내 모든 카드를 board.cards에서 제거
    * card_id in target.card_ids:
      board.cards |> delete(card_id)
    # 칼럼 자체 제거
    board.columns = board.columns |> filter(c: c.id != column_id)
    => board

  rename_column(column_id: String, title: String):
    MUST title != ""
    target = board.columns |> find(c: c.id == column_id)
    ? target == null:
      => board
    target.title = title
    => board

  reorder_columns(active_id: String, over_id: String):
    # @dnd-kit onDragEnd 콜백에서 호출
    MUST active_id != over_id
    old_index = board.columns |> find_index(c: c.id == active_id)
    new_index = board.columns |> find_index(c: c.id == over_id)
    board.columns = board.columns |> array_move(old_index, new_index)
    # order 필드 재정렬
    * col, idx in board.columns:
      col.order = idx
    => board

  # --- 카드 CRUD ---

  add_card(column_id: String):
    column = board.columns |> find(c: c.id == column_id)
    ? column == null:
      /> console.warn("존재하지 않는 column_id:", column_id)
      => board
    new_card = $Model.Card(title = "새_카드", column_id = column_id)
    board.cards[new_card.id] = new_card
    column.card_ids |> append(new_card.id)
    => board

  delete_card(card_id: String):
    MUST card_id != ""
    card = board.cards[card_id]
    ? card == null:
      /> console.warn("존재하지 않는 card_id:", card_id)
      => board
    # 소속 칼럼의 card_ids에서 제거
    column = board.columns |> find(c: c.id == card.column_id)
    ? column != null:
      column.card_ids = column.card_ids |> filter(id: id != card_id)
    # board.cards에서 제거
    board.cards |> delete(card_id)
    => board

  update_card(card_id: String, updates: Object):
    card = board.cards[card_id]
    ? card == null:
      => board
    card |> merge(updates)
    => board

  move_card(card_id: String, from_col_id: String, to_col_id: String, to_index: Int):
    MUST card_id != ""
    from_col = board.columns |> find(c: c.id == from_col_id)
    to_col = board.columns |> find(c: c.id == to_col_id)
    ? from_col == null | to_col == null:
      /> console.warn("유효하지 않은 칼럼 ID")
      => board
    from_col.card_ids = from_col.card_ids |> filter(id: id != card_id)
    to_col.card_ids |> insert_at(to_index, card_id)
    board.cards[card_id].column_id = to_col_id
    => board

  # --- 메시지 ---

  add_message(card_id: String, msg: $Model.Message):
    card = board.cards[card_id]
    ? card == null:
      /> console.warn("존재하지 않는 card_id:", card_id)
      => board
    card.messages |> append(msg)
    /> adapter.add_message(card_id, msg)
    => board

  # --- 모달 ---

  open_detail(card_id: String):
    modal_card_id = card_id

  close_detail():
    modal_card_id = null

# ============================================================
# 기본 보드
# ============================================================

# v1 모드 (VITE_ADAPTER_MODE=manual)
$Board.default_board():
  => $Model.Board(
    columns:
      - $Model.Column(title = "할_일", order = 0, card_ids = [])
      - $Model.Column(title = "진행_중", order = 1, card_ids = [])
      - $Model.Column(title = "완료", order = 2, card_ids = [])
    cards: {}
  )

# ============================================================
# 테스트 전략
# ============================================================

# --- v1 테스트 (완료) ---
[x] 단위: $Board.Actions.add_column 칼럼_추가_정상_동작
[x] 단위: $Board.Actions.delete_column 칼럼_삭제_시_하위_카드_연쇄_제거
[x] 단위: $Board.Actions.delete_card 카드_삭제_시_칼럼_card_ids_정리
[x] 단위: $Board.Actions.move_card 카드_이동_후_from/to_칼럼_정합성
[x] 단위: $Board.Actions.reorder_columns 칼럼_순서_변경_후_order_재정렬
[x] 단위: $Board.Actions.add_message 메시지_추가_후_messages_배열_검증
[x] 단위: $Card.DiffBlock diff_줄별_파싱_및_색상_분류
[x] 단위: $ManualAdapter.load_board JSON_파싱_실패_시_기본값_반환
[x] 통합: 드래그앤드롭_카드_이동_→_상태_→_localStorage_동기화
[x] 통합: 칼럼_드래그앤드롭_순서_변경_→_order_필드_반영
[x] 통합: 카드_클릭_→_대화_타임라인_→_메시지_추가_→_저장
[x] 통합: 새로고침_후_보드_및_메시지_히스토리_완전_복원
[x] 통합: VITE_ADAPTER_MODE_전환_시_어댑터_경로_변경_검증
