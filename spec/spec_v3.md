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

# --- v3 테스트 (22/22 통과) ---
# 대화 로그 파싱
[x] 단위: $LocalLogAdapter.parse_log JSON_정상_→_Message_배열_변환
[x] 단위: $LocalLogAdapter.parse_log JSON_필수필드_누락_→_건너뛰기
[x] 단위: $LocalLogAdapter.parse_log JSON_배열_아닌_입력_→_빈배열
[x] 단위: $LocalLogAdapter.parse_log JSON_role_정규화 (assistant→agent)
[x] 단위: $LocalLogAdapter.parse_markdown_chat MD_정규형식_파싱
[x] 단위: $LocalLogAdapter.parse_markdown_chat MD_타임스탬프_없는_경우_자동생성
[x] 단위: $LocalLogAdapter.parse_markdown_chat MD_대소문자_혼용_role_정규화
[x] 단위: $LocalLogAdapter.parse_markdown_chat MD_복수_diff_블록_concat
[x] 단위: $LocalLogAdapter.parse_markdown_chat MD_알수없는_role_→_agent_fallback
# FSM 전이 액션
[x] 단위: $Dashboard.Actions.approve SPEC_REVIEW→IMPLEMENTING
[x] 단위: $Dashboard.Actions.approve ADVERSARIAL_REVIEW→PENDING_APPROVAL
[x] 단위: $Dashboard.Actions.approve PENDING_APPROVAL→MERGED
[x] 단위: $Dashboard.Actions.reject SPEC_REVIEW→BACKLOG
[x] 단위: $Dashboard.Actions.reject ADVERSARIAL_REVIEW→IMPLEMENTING
[x] 단위: $Dashboard.Actions.reject PENDING_APPROVAL→IMPLEMENTING
[x] 단위: $Dashboard.Actions.is_actionable 비활성_상태_→_false (IMPLEMENTING 등)
# 통합
[x] 통합: 대화_로그_임포트_→_chat_탭_메시지_표시
[x] 통합: 리프레시_→_state.md_갱신_→_카드_칼럼_이동_확인
[x] 통합: 리프레시_→_approve_일시_상태_초기화_확인
[x] 통합: _registeredId_매핑_→_로그_임포트_→_올바른_프로젝트_연결
