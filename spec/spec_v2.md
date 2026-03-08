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

# --- v2 테스트 (완료) ---
[x] 단위: $StateFileParser.parse 정상_state.md_→_ParsedProject_변환
[x] 단위: $StateFileParser.parse 손상된_파일_→_graceful_에러_ParsedProject
[x] 단위: $StateFileParser @PROGRESS_체크박스_상태_분류 ([x]/[-]/[_])
[x] 단위: $StateFileParser @FEATURES_test_status_파싱 (pass/fail/pending)
[x] 단위: $ProjectRegistry.add_manual 수동_등록_→_localStorage_저장_검증
[x] 단위: $ProjectRegistry.remove_project 삭제_→_리스트_갱신_검증
[x] 통합: 파일_피커_임포트_→_파싱_→_대시보드_칼럼_배치
[x] 통합: 복수_프로젝트_등록_→_FSM_상태별_칼럼_정확_분류
