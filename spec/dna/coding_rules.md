# 코딩 규칙 (Coding Rules)

> 이 파일은 현판(Hyeonpan) 프로젝트의 코딩 컨벤션을 정의한다.
> 시스템 전체 규칙은 프로젝트 루트의 `DENAVY.md`에 정의되어 있다.

---

## 네이밍 컨벤션

- React 컴포넌트: **PascalCase** (`BoardColumn.tsx`, `CardModal.tsx`)
- 유틸 함수 / 훅: **camelCase** (`useBoard.ts`, `formatDate.ts`)
- 타입/인터페이스: **PascalCase + 접미사** (`BoardState`, `CardData`, `DataAdapter`)
- 상수: **UPPER_SNAKE_CASE** (`STORAGE_KEY`, `DEFAULT_COLUMNS`)
- CSS 클래스: **kebab-case** (`.card-tile`, `.diff-line-add`)
- 파일명: **PascalCase** (컴포넌트), **camelCase** (유틸/훅)

## 파일 구조

```
src/
├── components/        React 컴포넌트
│   ├── Board/
│   ├── Card/
│   └── common/
├── adapters/          DataAdapter 구현체
│   ├── ManualAdapter.ts
│   └── ApiAdapter.ts
├── models/            타입/인터페이스 정의
├── hooks/             커스텀 React 훅
├── utils/             유틸리티 함수
├── config/            설정 관리
├── App.tsx
├── App.css
└── main.tsx
```

## 금지 패턴 (BAN)

- `any` 타입 사용 금지 — 모든 변수에 명시적 타입 선언
- `console.log` 프로덕션 코드 잔류 금지
- `innerHTML` 직접 조작 금지 (XSS 방지)
- `eval()` / `Function()` 사용 금지
- 인라인 스타일 금지 — Vanilla CSS 파일로 분리

## 에러 핸들링 규칙

- 모든 외부 I/O (localStorage, API) 호출에 try-catch 필수
- JSON 파싱 실패 시 기본값 반환 (데이터 손실 방지)
- 존재하지 않는 ID 참조 시 silent fail + console.warn (개발 모드)

## 리뷰 체크리스트

- [ ] `any` 타입이 없는가
- [ ] 에러 핸들링이 모든 어댑터 호출에 존재하는가
- [ ] 하드코딩된 값이 없는가 (상수화 여부)
- [ ] 컴포넌트가 단일 책임 원칙을 따르는가
- [ ] CSS 클래스명이 kebab-case인가
