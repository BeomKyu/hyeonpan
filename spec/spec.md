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

# v2 모드 (VITE_ADAPTER_MODE=dashboard)
$Board.dashboard_board():
  => $Model.Board(
    columns:
      - $Model.Column(title = "BACKLOG",             order = 0, card_ids = [])
      - $Model.Column(title = "SPEC_ANALYZE",        order = 1, card_ids = [])
      - $Model.Column(title = "SPEC_REVIEW",         order = 2, card_ids = [])
      - $Model.Column(title = "IMPLEMENTING",        order = 3, card_ids = [])
      - $Model.Column(title = "TEST_RUNNING",        order = 4, card_ids = [])
      - $Model.Column(title = "ADVERSARIAL_REVIEW",  order = 5, card_ids = [])
      - $Model.Column(title = "PENDING_APPROVAL",    order = 6, card_ids = [])
      - $Model.Column(title = "MERGED",              order = 7, card_ids = [])
    cards: {}
  )

# ============================================================
# v2: state.md 파싱 모델
# ============================================================

$Model.ParsedProject:
  file_path: String                         # state.md 절대/상대 경로
  task: String                              # state.md의 task: 필드
  state: String                             # FSM 상태 (BACKLOG ~ MERGED)
  actor: String                             # 현재 actor (HUMAN, EDITOR, ...)
  retry: String                             # "0 / max: 5" 형태
  time: String                              # 마지막 상태 전이 시각
  test_res: String | null                   # 테스트 결과
  review_score: String | null               # 리뷰 점수
  progress: List($Model.ProgressItem) = []  # @PROGRESS 섹션
  features: List($Model.FeatureItem) = []   # @FEATURES 섹션
  raw_content: String                       # 원본 파일 전문

$Model.ProgressItem:
  label: String
  status: String          # "done" | "in_progress" | "pending"
  # [x] → done, [-] → in_progress, [_] → pending

$Model.FeatureItem:
  label: String
  status: String          # "done" | "in_progress" | "pending"
  test_status: String     # "pass" | "fail" | "pending" | "manual_pass"

# ============================================================
# v2: state.md 파서
# ============================================================

$StateFileParser:
  # Byeorim v1.4 state.md 파일을 파싱하여 ParsedProject로 변환

  parse(content: String, file_path: String): $Model.ParsedProject
    lines = content |> split_lines()

    # @FSM_STATE 섹션 파싱
    task = lines |> find_field("task:")
    state = lines |> find_field("state:")
    actor = lines |> find_field("actor:")
    retry = lines |> find_field("retry:")
    time = lines |> find_field("time:")

    # meta 섹션 파싱
    test_res = lines |> find_field("test_res:")
    review_score = lines |> find_field("review_score:")

    # @PROGRESS 섹션 파싱
    progress = lines |> extract_checklist("@PROGRESS")
      |> map(line =>
        ? line |> starts_with("[x]"): { label: line, status: "done" }
        ? line |> starts_with("[-]"): { label: line, status: "in_progress" }
        : { label: line, status: "pending" }
      )

    # @FEATURES 섹션 파싱
    features = lines |> extract_checklist("@FEATURES")
      |> map(line =>
        status = ? line |> starts_with("[x]"): "done"
                 ? line |> starts_with("[-]"): "in_progress"
                 : "pending"
        test_status = ? line |> contains("test: pass"): "pass"
                      ? line |> contains("test: fail"): "fail"
                      ? line |> contains("test: manual_pass"): "manual_pass"
                      : "pending"
        => { label: line, status, test_status }
      )

    => $Model.ParsedProject(
      file_path, task, state, actor, retry, time,
      test_res, review_score, progress, features,
      raw_content = content
    )

  FAIL parse_error:
    /> console.warn("state.md 파싱 실패:", file_path, parse_error)
    => $Model.ParsedProject(
      file_path, task = "파싱_실패", state = "UNKNOWN",
      actor = "none", retry = "0", time = "",
      test_res = null, review_score = null,
      progress = [], features = [],
      raw_content = content
    )

# ============================================================
# v2: 프로젝트 레지스트리
# ============================================================

$ProjectRegistry:
  # 등록된 프로젝트 목록 관리 (localStorage 영속)
  STORAGE_KEY = "hyeonpan_project_registry"

  ST projects: List($Model.RegisteredProject) = load_projects()

  $Model.RegisteredProject:
    id: String = uuid()
    label: String                    # 사용자 지정 프로젝트 이름
    source_type: String              # "manual" | "file_picker"
    file_content: String | null      # 파일 피커로 읽은 원본 내용
    file_path: String | null         # 수동 등록 경로 (표시용)
    last_updated: String = iso8601()

  # B) 수동 등록: 경로 + 라벨 입력
  add_manual(label: String, file_path: String, content: String):
    project = $Model.RegisteredProject(
      label, source_type = "manual", file_content = content, file_path
    )
    projects |> append(project)
    save_projects()

  # C) 파일 피커: File API로 읽기
  add_from_picker(file: File):
    TX file_read:
      content <- file.text()
      label = file.name |> replace(".md", "")
      project = $Model.RegisteredProject(
        label, source_type = "file_picker",
        file_content = content, file_path = file.name
      )
      projects |> append(project)
      save_projects()
    FAIL err:
      /> console.warn("파일 읽기 실패:", err)

  remove_project(id: String):
    projects = projects |> filter(p: p.id != id)
    save_projects()

  # 등록된 모든 프로젝트를 파싱하여 ParsedProject 목록 반환
  get_parsed_projects(): List($Model.ParsedProject)
    => projects
      |> filter(p: p.file_content != null)
      |> map(p: $StateFileParser.parse(p.file_content, p.file_path))

  load_projects(): List($Model.RegisteredProject)
    TX:
      raw <- localStorage.getItem(STORAGE_KEY)
      ? raw == null: => []
      => raw |> from_json()
    FAIL: => []

  save_projects():
    TX:
      >/ localStorage.setItem(STORAGE_KEY, projects |> to_json())

# ============================================================
# v2: 대시보드 뷰 (FSM 칼럼 모드)
# ============================================================

$Dashboard.View:
  # VITE_ADAPTER_MODE=dashboard일 때 활성화
  # FSM 상태별 8칼럼 + 프로젝트 카드 자동 배치

  use $ProjectRegistry

  FSM_COLUMNS: List(String) = [
    "BACKLOG", "SPEC_ANALYZE", "SPEC_REVIEW",
    "IMPLEMENTING", "TEST_RUNNING", "ADVERSARIAL_REVIEW",
    "PENDING_APPROVAL", "MERGED"
  ]

  # Actor 기반 강조 라벨
  HUMAN_ACTION_STATES: List(String) = [
    "SPEC_REVIEW", "PENDING_APPROVAL"
  ]

  build_dashboard_board(): $Model.Board
    parsed = $ProjectRegistry.get_parsed_projects()
    board = $Board.dashboard_board()

    * project in parsed:
      # state → 칼럼 매핑
      col_index = FSM_COLUMNS |> find_index(s: s == project.state)
      ? col_index == -1:
        col_index = 0     # 알 수 없는 상태 → BACKLOG

      # progress 진행률 계산
      total = project.progress |> length()
      done = project.progress |> filter(p: p.status == "done") |> length()
      progress_pct = ? total > 0: (done / total * 100) |> round() | 0

      card = $Model.Card(
        title = project.task
        description = project.state + " | " + project.actor
        column_id = board.columns[col_index].id
        # messages는 비워둠 (대화뷰는 v1 호환)
      )
      # 카드에 파싱된 프로젝트 정보를 메타데이터로 첨부
      card._parsed = project
      card._progress_pct = progress_pct
      card._needs_human = project.actor == "HUMAN"
                        | FSM_COLUMNS[col_index] in HUMAN_ACTION_STATES

      board.cards[card.id] = card
      board.columns[col_index].card_ids |> append(card.id)

    => board

  # 빈 칼럼 접기 토글
  ST collapse_empty: Bool = false

  get_visible_columns(board: $Model.Board): List($Model.Column)
    ? collapse_empty:
      => board.columns |> filter(c: c.card_ids |> length() > 0)
    => board.columns

# ============================================================
# v2: 대시보드 카드 타일 (확장)
# ============================================================

$Dashboard.CardTile(card: $Model.Card):
  UI dashboard_card_tile:
    # 프로젝트명 (task)
    UI task_title: card.title

    # FSM 상태 배지 + Actor 배지
    UI status_row:
      UI state_badge: card._parsed.state
      UI actor_badge: card._parsed.actor
        # actor == "HUMAN" → 주황 강조 "내 액션 필요"
        ? card._needs_human:
          CSS class = "needs-human"

    # @PROGRESS 진행률 바
    UI progress_bar:
      width = card._progress_pct + "%"

    # 테스트/리뷰 결과 (있으면)
    ? card._parsed.test_res != null & card._parsed.test_res != "none":
      UI test_badge: card._parsed.test_res
    ? card._parsed.review_score != null & card._parsed.review_score != "none":
      UI review_badge: card._parsed.review_score

    CLK card_surface:
      $Board.Actions.open_detail(card.id)

# ============================================================
# v2: 상세 모달 확장 (기존 대화뷰 + @FEATURES/@PROGRESS)
# ============================================================

$Dashboard.DetailModal(card_id: String):
  card = $Board.State.cards[card_id]
  ? card == null: => null

  UI modal_overlay:
    UI modal_content:
      UI modal_header:
        UI title: card.title
        ? card._parsed:
          UI state_badge: card._parsed.state
          UI actor_badge: card._parsed.actor

      # 탭 UI: "프로젝트 정보" | "원본" | "대화" (v1 호환)
      ST active_tab: String = "info"

      UI tab_bar:
        CLK tab_info:    active_tab = "info"
        CLK tab_raw:     active_tab = "raw"
        CLK tab_chat:    active_tab = "chat"

      ? active_tab == "info":
        # @PROGRESS 시각화
        UI progress_section:
          UI progress_title: "@PROGRESS"
          * item in card._parsed.progress:
            UI progress_item:
              UI checkbox: item.status
              UI label: item.label

        # @FEATURES 체크리스트
        UI features_section:
          UI features_title: "@FEATURES"
          * feat in card._parsed.features:
            UI feature_item:
              UI checkbox: feat.status
              UI label: feat.label
              UI test_badge: feat.test_status

        # 메타정보
        UI meta_section:
          UI meta_row: "retry: " + card._parsed.retry
          UI meta_row: "time: " + card._parsed.time
          ? card._parsed.test_res:
            UI meta_row: "test: " + card._parsed.test_res
          ? card._parsed.review_score:
            UI meta_row: "review: " + card._parsed.review_score

      ? active_tab == "raw":
        # state.md 원본 전문 표시
        UI raw_content_section:
          UI raw_pre: card._parsed.raw_content
            # 모노스페이스, 스크롤 가능

      ? active_tab == "chat":
        # 기존 v1 대화 타임라인 (재사용)
        $Card.DetailModal.conversation_timeline(card)

      CLK close_btn:
        $Board.Actions.close_detail()

# ============================================================
# v2: 프로젝트 등록 UI
# ============================================================

$Dashboard.ProjectManager:
  ST error_message: String | null = null

  UI project_manager_panel:
    # 에러 토스트 (파일 읽기 실패 등)
    ? error_message != null:
      UI error_toast:
        UI error_text: error_message
        CLK dismiss_btn:
          error_message = null

    # 빈 프로젝트 리스트 → 온보딩 가이드
    ? $ProjectRegistry.projects |> length() == 0:
      UI onboarding_guide:
        UI guide_title: "프로젝트를 추가하세요"
        UI guide_step_1: "1. 아래 '파일 선택' 버튼으로 .denavy/state.md 파일을 임포트하세요"
        UI guide_step_2: "2. 또는 '수동 등록' 폼에 state.md 내용을 직접 붙여넣기하세요"
        UI guide_step_3: "3. 등록된 프로젝트가 FSM 상태별 칼럼에 자동 배치됩니다"

    # 등록된 프로젝트 목록
    * project in $ProjectRegistry.projects:
      UI project_row:
        UI project_label: project.label
        UI project_source: project.source_type
        UI project_time: project.last_updated
        CLK remove_btn:
          $ProjectRegistry.remove_project(project.id)

    # 수동 등록 폼
    UI manual_add_form:
      ST label_input: String = ""
      ST content_input: String = ""
      CLK add_btn:
        MUST label_input != ""
        MUST content_input != ""
        $ProjectRegistry.add_manual(label_input, "", content_input)
        label_input = ""
        content_input = ""

    # 파일 피커
    CLK file_picker_btn:
      TX:
        file <- File.open(accept = ".md")
        $ProjectRegistry.add_from_picker(file)
      FAIL err:
        error_message = "파일을 열 수 없습니다: " + err.message

# ============================================================
# v2: Config 확장
# ============================================================

$Config.v2:
  # VITE_ADAPTER_MODE 확장값
  # "manual"    → v1 수동 칸반 모드
  # "dashboard" → v2 Denavy 대시보드 모드
  # "api"       → 미래 API 연동 모드

  get_view_mode(): String
    ? adapter_mode == "dashboard": => "dashboard"
    => "manual"

# ============================================================
# v2: App.Root 확장
# ============================================================

$App.Root.v2:
  use $Board.Provider
  view_mode = $Config.v2.get_view_mode()

  UI app_container:
    ? view_mode == "dashboard":
      $Dashboard.Header
      $Dashboard.ProjectManager    # 사이드바 or 접기식
      $Dashboard.ColumnList        # FSM 8칼럼
      ? modal_card_id != null:
        $Dashboard.DetailModal(modal_card_id)
    :
      # v1 호환
      $Board.Header
      $Board.ColumnList
      ? modal_card_id != null:
        $Card.DetailModal(modal_card_id)

# ============================================================
# v3: 대화 로그 소스 (Conversation Log Source)
# ============================================================

# 카드(프로젝트)와 연결된 대화 기록의 출처를 추상화.
# v3 MVP: 로컬 파일 (대화 로그 .md/.json 임포트) → 읽기 전용
# BAN: 수동 메시지 입력, AI/LLM API 연동 (v3 범위 외)
# 미래: API 서버 연동, 실시간 양방향 통신

$ConversationLogSource:
  # 어댑터 패턴 — v1 DataAdapter와 동일 사상
  load_messages(project_id: String): List($Model.Message)
  # 미래: save_message(), subscribe() 등 확장

$LocalLogAdapter :+ $ConversationLogSource:
  # 로컬 파일에서 대화 기록 로드 (읽기 전용)
  # 지원 포맷: .md (마크다운 대화 로그), .json (메시지 배열)
  # MUST 파일 크기 < 5MB, 파싱 < 500ms (초과 시 에러 토스트 + 거부)

  load_messages(project_id: String): List($Model.Message)
    registered = $ProjectRegistry.find(project_id)
    ? registered.log_content == null:
      => []
    => parse_log(registered.log_content, registered.log_format)

  parse_log(content: String, format: String): List($Model.Message)
    ? format == "json":
      TX:
        raw = content |> from_json()
        # 배열이 아닌 JSON → 빈 배열
        ? !Array.isArray(raw):
          /> console.warn("JSON 대화 로그: 배열이 아님")
          => []
        # 메시지별 검증 + 정규화
        => raw |> filter(validate_message) |> map(normalize_message)
      FAIL:
        /> console.warn("JSON 대화 로그 파싱 실패")
        => []
    ? format == "md":
      => content |> parse_markdown_chat()
    => []

  # --- JSON 메시지 검증/정규화 ---

  validate_message(msg: Object): Bool
    # 필수 필드: role, content
    ? msg.role == null | msg.content == null:
      /> console.warn("필수 필드 누락, 메시지 건너뛰기:", msg)
      => false
    => true

  normalize_message(msg: Object): $Model.Message
    => $Model.Message(
      id = msg.id | uuid()
      role = normalize_role(msg.role)
      content = msg.content
      diff = msg.diff | null
      timestamp = msg.timestamp | iso8601()
    )

  normalize_role(role: String): String
    ? role == "user": => "user"
    # "assistant", "system", 기타 → "agent" fallback
    => "agent"

  # --- 마크다운 대화 로그 파싱 ---

  # 정규 형식 (canonical format):
  #
  # ```md
  # ## user
  # 2026-03-08T15:00:00+09:00
  #
  # state.md의 progress 섹션을 분석해줘.
  #
  # ## agent
  # 2026-03-08T15:01:00+09:00
  #
  # 분석 결과입니다:
  #
  # ```diff
  # -[_] Stage_3_코드_구현
  # +[-] Stage_3_코드_구현
  # ```
  # ```
  #
  # 파싱 규칙:
  # 1. "## user" 또는 "## agent" (소문자 고정) → role
  #    - 대소문자 혼용 (## User, ## AGENT 등) → 소문자 정규화
  #    - 알 수 없는 role (## system, ## assistant 등) → "agent" fallback
  # 2. 헤더 바로 다음 줄이 ISO8601 형식이면 → timestamp
  #    - 없으면 현재 시각 자동 생성
  # 3. timestamp 이후 ~ 다음 "## " 헤더 전까지 → content
  # 4. ```diff 블록 → diff 필드
  #    - 복수 diff 블록 → 연결(concat)하여 단일 diff 필드로 병합
  #    - 다른 코드 블록 (```js, ```python 등) → content에 포함 (diff 아님)
  # 5. 빈 메시지 (content 없음) → 건너뛰기
  # 6. 파일 앞 frontmatter/제목 등 role이 아닌 텍스트 → SKIP (role이 한 단어가 아닌 경우)

  parse_markdown_chat(content: String): List($Model.Message)
    sections = content |> split_by("## ")
    messages: List = []

    * section in sections:
      ? section |> trim() == "":
        SKIP

      first_line = section |> first_line()
      role_raw = first_line |> trim() |> lowercase()
      # frontmatter 방어: role이 한 단어가 아닌 경우 → SKIP
      ? role_raw |> contains(" ") | role_raw |> length() > 20:
        SKIP
      role = normalize_role(role_raw)

      remaining = section |> after_first_line()

      # timestamp 추출
      second_line = remaining |> first_line() |> trim()
      ? second_line |> is_iso8601():
        timestamp = second_line
        body = remaining |> after_first_line()
      :
        timestamp = iso8601()
        body = remaining

      # diff 블록 추출 (```diff ... ``` → 연결)
      diff_blocks = body |> extract_fenced_blocks("diff")
      diff = ? diff_blocks |> length() > 0:
        diff_blocks |> join("\n")
      | null

      # content = body에서 diff 블록 제거 후 trim
      text_content = body |> remove_fenced_blocks("diff") |> trim()

      ? text_content != "":
        messages |> append($Model.Message(
          id = uuid()
          role = role
          content = text_content
          diff = diff
          timestamp = timestamp
        ))

    => messages

  FAIL parse_error:
    /> console.warn("MD 대화 로그 파싱 실패:", parse_error)
    => []

$ApiLogAdapter :+ $ConversationLogSource:
  # [미래] REST API에서 대화 기록 로드
  url api_base = import.meta.env.VITE_CHAT_API_URL | ""

  load_messages(project_id: String): List($Model.Message)
    TX:
      messages <- $HTTP.get(api_base + "/projects/" + project_id + "/messages")
      => messages
    FAIL err:
      /> console.warn("대화 API 로드 실패:", err)
      => []

# ============================================================
# v3: 대화 기록 임포트 — RegisteredProject 확장
# ============================================================

$Model.RegisteredProject.v3:
  # v2 필드 유지 + 대화 로그 필드 추가
  log_content: String | null = null     # 대화 로그 원본
  log_format: String = "md"             # "md" | "json"
  # MUST 기존 데이터 하위 호환: logContent/logFormat 없으면 기본값

$ProjectRegistry.v3:
  # 대화 로그 임포트
  # MUST 프로젝트당 대화 로그 1:1 (재임포트 시 덮어쓰기)
  # MUST 파일 크기 < 5MB (초과 시 거부 + 에러 토스트)
  import_log(project_id: String, file: File):
    TX:
      # 파일 크기 검증
      ? file.size > 5 * 1024 * 1024:
        ?=> Error("파일 크기 5MB 초과")
      content <- file.text()
      format = ? file.name |> ends_with(".json"): "json" | "md"
      project = projects |> find(p: p.id == project_id)
      # 기존 로그 덮어쓰기 (1:1)
      project.log_content = content
      project.log_format = format
      save_projects()
    FAIL err:
      /> console.warn("대화 로그 임포트 실패:", err)
      $Dashboard.ProjectManager.error_message = "로그 임포트 실패: " + err.message

# ============================================================
# v3: DashboardCard — _registeredId 매핑
# ============================================================

# build_dashboard_board()에서 카드 생성 시 RegisteredProject.id를 매핑
# 대화 로그 load/import 전부 _registeredId 기반으로 통일

$Dashboard.View.v3.build_dashboard_board():
  # REPLACES $Dashboard.View.build_dashboard_board() (L594-624)
  # v2의 snake_case (_progress_pct, _needs_human) → camelCase (_progressPct, _needsHuman) 정규화
  # v2 로직 유지 + registeredId 매핑 추가
  parsed_with_ids = $ProjectRegistry.projects
    |> filter(p: p.file_content != null)
    |> map(p: {
      registered_id: p.id,
      parsed: $StateFileParser.parse(p.file_content, p.file_path)
    })

  board = $Board.dashboard_board()

  * item in parsed_with_ids:
    project = item.parsed
    col_index = FSM_COLUMNS |> find_index(s: s == project.state)
    ? col_index == -1:
      col_index = 0

    # progress 진행률 계산
    total = project.progress |> length()
    done = project.progress |> filter(p: p.status == "done") |> length()
    progress_pct = ? total > 0: (done / total * 100) |> round() | 0

    card = $Model.Card(
      title = project.task
      description = project.state + " | " + project.actor
      column_id = board.columns[col_index].id
    )
    card._parsed = project
    card._progressPct = progress_pct
    card._needsHuman = project.actor == "HUMAN"
                      | FSM_COLUMNS[col_index] in HUMAN_ACTION_STATES
    card._registeredId = item.registered_id    # ← v3 신규

    board.cards[card.id] = card
    board.columns[col_index].card_ids |> append(card.id)

  => board

# ============================================================
# v3: 대시보드 DetailModal 대화 탭 통합
# ============================================================

$Dashboard.DetailModal.v3:
  # chat 탭에서 실제 대화 기록 표시 (v2 placeholder 교체)
  # BAN 수동 메시지 입력 (읽기 전용)

  ? active_tab == "chat":
    messages = $ConversationLogSource.load_messages(card._registeredId)

    ? messages |> length() == 0:
      UI empty_chat:
        UI text: "대화 기록이 없습니다"
        UI hint: ".md 또는 .json 형식의 대화 로그를 임포트하세요"
        CLK import_log_btn:
          file <- File.open(accept = ".md,.json")
          $ProjectRegistry.v3.import_log(card._registeredId, file)
          # 임포트 성공 후 → messages 상태 재로드 (자동 re-render)
          messages = $ConversationLogSource.load_messages(card._registeredId)

    ? messages |> length() > 0:
      UI conversation_timeline:
        * msg in messages:
          $Card.MessageBubble(msg)    # v1 메시지 말풍선 재사용

# ============================================================
# v3: FSM 액션 (Dashboard에서 /approve, /reject 실행)
# ============================================================

$Dashboard.Actions:
  # 카드(프로젝트)에 대해 FSM 전이 액션 실행
  # state.md 파일을 직접 수정할 수 없으므로 (브라우저 제한),
  # "다음에 할 일"을 안내하고 상태를 로컬에서 시뮬레이션

  # MUST approve/reject 버튼: 3상태에서만 활성화
  #   SPEC_REVIEW, ADVERSARIAL_REVIEW, PENDING_APPROVAL
  # 그 외 상태에서는 버튼 비활성화 (disabled)

  ACTIONABLE_STATES: List(String) = [
    "SPEC_REVIEW", "ADVERSARIAL_REVIEW", "PENDING_APPROVAL"
  ]

  is_actionable(state: String): Bool
    => state in ACTIONABLE_STATES

  # [MVP] 로컬 시뮬레이션 — 세션 한정
  # MUST localStorage에 영속하지 않음 (렌더링용 일시 상태)
  # MUST 리프레시 시 state.md 내용으로 강제 덮어쓰기
  # MUST 새로고침(F5) 시 원래 state.md 상태로 복원

  approve(card: $DashboardCard):
    current_state = card._parsed.state
    next_state = FSM_TRANSITION_MAP.approve[current_state]
    ? next_state == null:
      => void    # 전이 불가 상태
    # 세션 내 렌더링용 상태만 변경
    card._parsed.state = next_state
    # 보드 재빌드하여 카드를 새 칼럼으로 이동 (UX 직관적)
    /> $Dashboard.View.rebuild_board_session()
    UI toast: "✅ " + current_state + " → " + next_state + " 전이. state.md 파일도 수정해주세요."

  reject(card: $DashboardCard):
    current_state = card._parsed.state
    next_state = FSM_TRANSITION_MAP.reject[current_state]
    ? next_state == null:
      => void    # 전이 불가 상태
    card._parsed.state = next_state
    /> $Dashboard.View.rebuild_board_session()
    UI toast: "🔙 " + current_state + " → " + next_state + " 롤백. state.md 파일도 수정해주세요."

  FSM_TRANSITION_MAP:
    approve:
      SPEC_REVIEW: IMPLEMENTING
      ADVERSARIAL_REVIEW: PENDING_APPROVAL
      PENDING_APPROVAL: MERGED
    reject:
      SPEC_REVIEW: BACKLOG
      ADVERSARIAL_REVIEW: IMPLEMENTING
      PENDING_APPROVAL: IMPLEMENTING

  # [미래] File System Access API로 state.md 직접 수정
  # [미래] API 서버 경유 state.md 원격 수정

# ============================================================
# v3: 파일 리프레시
# ============================================================

$Dashboard.FileRefresh:
  # 등록된 프로젝트의 state.md를 다시 읽어 최신 상태로 갱신
  # BAN refresh_all (MVP — 파일 피커 N회 반복 UX 재앙)
  # [미래] File System Access API FileHandle → 자동 재읽기 시 전체 리프레시 재도입

  # 개별 리프레시 (파일 피커 재선택)
  refresh_project(project_id: String):
    file <- File.open(accept = ".md")
    TX:
      content <- file.text()
      project = $ProjectRegistry.find(project_id)
      project.file_content = content
      project.last_updated = iso8601()
      $ProjectRegistry.save_projects()
      # 대시보드 보드 재빌드 (approve/reject 일시 상태 초기화됨)
      $Dashboard.View.refresh()
    FAIL err:
      $Dashboard.ProjectManager.error_message = "리프레시 실패: " + err.message

  # [미래] File System Access API — 파일 핸들 저장 → 자동 재읽기
  # [미래] FileSystemObserver API — 파일 변경 감지 → 자동 리프레시

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

# --- v2 테스트 (완료) ---
[x] 단위: $StateFileParser.parse 정상_state.md_→_ParsedProject_변환
[x] 단위: $StateFileParser.parse 손상된_파일_→_graceful_에러_ParsedProject
[x] 단위: $StateFileParser @PROGRESS_체크박스_상태_분류 ([x]/[-]/[_])
[x] 단위: $StateFileParser @FEATURES_test_status_파싱 (pass/fail/pending)
[x] 단위: $ProjectRegistry.add_manual 수동_등록_→_localStorage_저장_검증
[x] 단위: $ProjectRegistry.remove_project 삭제_→_리스트_갱신_검증
[x] 통합: 파일_피커_임포트_→_파싱_→_대시보드_칼럼_배치
[x] 통합: 복수_프로젝트_등록_→_FSM_상태별_칼럼_정확_분류

# --- v3 테스트 (신규) ---
# 대화 로그 파싱
[_] 단위: $LocalLogAdapter.parse_log JSON_정상_→_Message_배열_변환
[_] 단위: $LocalLogAdapter.parse_log JSON_필수필드_누락_→_건너뛰기
[_] 단위: $LocalLogAdapter.parse_log JSON_배열_아닌_입력_→_빈배열
[_] 단위: $LocalLogAdapter.parse_log JSON_role_정규화 (assistant→agent)
[_] 단위: $LocalLogAdapter.parse_markdown_chat MD_정규형식_파싱
[_] 단위: $LocalLogAdapter.parse_markdown_chat MD_타임스탬프_없는_경우_자동생성
[_] 단위: $LocalLogAdapter.parse_markdown_chat MD_대소문자_혼용_role_정규화
[_] 단위: $LocalLogAdapter.parse_markdown_chat MD_복수_diff_블록_concat
[_] 단위: $LocalLogAdapter.parse_markdown_chat MD_알수없는_role_→_agent_fallback
# FSM 전이 액션
[_] 단위: $Dashboard.Actions.approve SPEC_REVIEW→IMPLEMENTING
[_] 단위: $Dashboard.Actions.approve ADVERSARIAL_REVIEW→PENDING_APPROVAL
[_] 단위: $Dashboard.Actions.approve PENDING_APPROVAL→MERGED
[_] 단위: $Dashboard.Actions.reject SPEC_REVIEW→BACKLOG
[_] 단위: $Dashboard.Actions.reject ADVERSARIAL_REVIEW→IMPLEMENTING
[_] 단위: $Dashboard.Actions.reject PENDING_APPROVAL→IMPLEMENTING
[_] 단위: $Dashboard.Actions.is_actionable 비활성_상태_→_false (IMPLEMENTING 등)
# 통합
[_] 통합: 대화_로그_임포트_→_chat_탭_메시지_표시
[_] 통합: 리프레시_→_state.md_갱신_→_카드_칼럼_이동_확인
[_] 통합: 리프레시_→_approve_일시_상태_초기화_확인
[_] 통합: _registeredId_매핑_→_로그_임포트_→_올바른_프로젝트_연결

