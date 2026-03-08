[Byeorim v1.4]
@CONSTRAINTS

NOW 2026-03-08

# === 기술 스택 (v1 유지) ===

lang: TypeScript
framework: React_19.2
bundler: Vite_7.3.1
styling: Vanilla_CSS
runtime: Node_24_LTS

# === 드래그앤드롭 (v1 유지) ===

dnd_library: @dnd-kit/core & @dnd-kit/sortable

# === 데이터 소스 (v2 신규) ===

# 카드 1개 = state.md 파일 1개 = Denavy 프로젝트/태스크 1개
# 칼럼 = FSM 상태별 자동 그룹핑 (BACKLOG ~ MERGED)
MUST 카드_단위는_state.md_파일_1개
MUST 칼럼은_FSM_상태_기반_고정_그룹핑

# === 프로젝트 탐색 전략 (A+B+C 복합) ===

# A) 자동 스캔: 지정된 상위 폴더를 재귀 탐색하여 .denavy/state.md 자동 발견
# B) 수동 등록: 사용자가 프로젝트 경로를 직접 추가/삭제
# C) 파일 피커: state.md 파일을 브라우저 File API로 직접 임포트
MUST 자동_스캔_모드 (설정된 루트 폴더 하위 재귀 탐색)
MUST 수동_등록_모드 (프로젝트 경로 리스트 관리)
MUST 파일_피커_임포트 (File API로 state.md 직접 열기)

# 자동 스캔 제약: 웹 브라우저의 File System Access API 또는
#                 로컬 dev 서버의 별도 엔드포인트 필요
# MVP에서는 B+C 우선 구현, A는 dev 서버 확장 시 지원
BAN 브라우저_샌드박스_제약_무시 (자동스캔은_서버사이드_or_FSA_API)

# === state.md 파싱 ===

MUST Byeorim_v1.4_파싱 (@FSM_STATE, @PROGRESS, @FEATURES 섹션)
MUST 파싱_실패_시_에러_카드_표시 (경고 + 원본 경로)
MUST task_이름_추출 (state.md의 task: 필드)
MUST 현재_actor_표시 (HUMAN 대기 중 → 강조)
MUST @PROGRESS_진행률_표시 ([x] 비율 → 프로그레스 바)

# === 칼럼 구조 ===

# FSM 상태 → 칼럼 매핑 (고정 순서)
# BACKLOG | SPEC_ANALYZE | SPEC_REVIEW | IMPLEMENTING |
# TEST_RUNNING | ADVERSARIAL_REVIEW | PENDING_APPROVAL | MERGED
MUST FSM_상태별_고정_칼럼_8개
MUST 사용자_액션_필요_칼럼_강조 (SPEC_REVIEW, PENDING_APPROVAL 등)
MUST 빈_칼럼_접기_옵션

# === 카드 클릭 시 상세 (기존 DetailModal 확장) ===

MUST 카드_클릭_시_state.md_전체_내용_표시
MUST @FEATURES_목록_표시 (체크리스트_UI)
MUST @PROGRESS_시각화 (프로그레스_바)
MUST 기존_대화형_히스토리_뷰_유지 (v1 호환)

# === UI/UX 제약 (v1 유지 + 확장) ===

MUST 반응형_레이아웃
MUST 노션_스타일_미니멀_디자인
MUST 다크_테마_유지
BAN 외부_UI_프레임워크

# === 에러 핸들링 ===

MUST state.md_파싱_실패_시_graceful_UI
MUST 파일_접근_권한_실패_시_안내_메시지
MUST 빈_프로젝트_리스트_시_온보딩_가이드

# === 성능 ===

MUST 초기_로딩 < 2s
MUST state.md_파싱 < 200ms_per_file

# === MVP 범위 제외 ===

# [MVP_외] 자동_스캔_A (서버사이드_필요)
# [MVP_외] state.md_실시간_파일_워치
# [MVP_외] 프로젝트_간_의존성_시각화
# [MVP_외] 다중_task_per_project (미래 확장)
