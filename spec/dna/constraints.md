[Byeorim v1.4]
@CONSTRAINTS

NOW 2026-03-08

# === 기술 스택 ===

lang: TypeScript
framework: React_19.2
bundler: Vite_7.3.1
styling: Vanilla_CSS
runtime: Node_24_LTS

# === 드래그앤드롭 전략 ===

dnd_library: @dnd-kit/core & @dnd-kit/sortable
# @dnd-kit은 UI 프레임워크가 아닌 DnD 전용 경량 라이브러리.
# HTML5 Drag API는 모바일 미지원 + 커스텀 제약 → 배제.
# BAN 대상인 "외부 UI 프레임워크"에 해당하지 않음.
MUST 드래그_반응_지연 < 100ms

# === 데이터 영속성 ===

storage: localStorage (MVP)
future_storage: REST_API (옵션 전환)
MUST 데이터_어댑터_패턴_적용 (ManualAdapter & ApiAdapter)
MUST 어댑터_모드_전환_경로: .env 파일의 VITE_ADAPTER_MODE 변수
BAN 백엔드_서버_직접_의존 (어댑터_인터페이스로_격리)

# === UI/UX 제약 ===

MUST 반응형_레이아웃 (mobile_768px & desktop_1024px)
MUST 카드_드래그앤드롭_이동 (칼럼_간_및_칼럼_내)
MUST 칼럼_드래그앤드롭_순서_변경
MUST 노션_스타일_미니멀_디자인
MUST 카드_클릭_시_대화형_히스토리_뷰
MUST 대화_내_diff_인라인_표시 (추가:초록 & 삭제:빨강)
BAN 외부_UI_프레임워크 (MUI & Ant_Design 등. @dnd-kit은_예외_허용)

# === 에러 핸들링 ===

MUST 모든_어댑터_I/O에_try-catch
MUST JSON_파싱_실패_시_기본값_반환
MUST 존재하지_않는_ID_참조_시_graceful_fail

# === 보안 ===

BAN eval()_사용
BAN innerHTML_직접_조작 (XSS_방지)
BAN 하드코딩된_시크릿
BAN any_타입_사용

# === 로깅 전략 ===

# 개발 모드: console.warn 허용 (에러 핸들링 디버깅용)
# 프로덕션 빌드: vite-plugin-remove-console로 console.* 전량 strip
BAN console.log_프로덕션_잔류
MUST 프로덕션_빌드_시_console_strip_플러그인_적용

# === 성능 ===

MUST 초기_로딩 < 2s
MUST 드래그_반응_지연 < 100ms

# === MVP 범위 제외 (명시적) ===

# 아래 기능은 v1.0 MVP에 포함하지 않음.
# [MVP_외] 메시지_삭제_기능
# [MVP_외] 메시지_편집_기능
# [MVP_외] 카드_라벨/태그_시스템
# [MVP_외] 검색/필터_기능
# [MVP_외] 다크모드
