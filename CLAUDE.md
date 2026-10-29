# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트

마케팅 콘텐츠 캘린더 웹 앱. 서버 없이 브라우저만으로 콘텐츠 일정(제목·채널·예정일·상태)을 등록·조회·수정·삭제한다.

- 요구사항 원본: `마케팅 콘텐츠 캘린더 앱 PRD.md` (기능 ID F-01~F-10, 완료 기준은 8장)
- 작업 순서: `콘텐츠_캘린더_앱_단계별_프롬프트_전략.txt` (Step 1~8 로드맵과 단계별 확인 체크리스트)

사용자에게 하는 설명과 질문, 코드 주석은 한국어로 쓴다.

## 실행

빌드·설치·테스트 도구가 없다. 이 폴더의 `index.html`을 브라우저에서 바로 연다(더블클릭, `file://`). 검증은 각 Step의 확인 체크리스트와 PRD 8장 완료 기준을 브라우저에서 직접 확인하는 방식이며, 개발자 도구 콘솔에 오류가 없어야 한다.

## 기술 제약 (어기면 안 됨)

- 앱 파일은 이 폴더(`contents_manager/`)에 `index.html`, `style.css`, `script.js` 3개만 둔다. PRD의 `content-calendar/` 폴더명은 쓰지 않는다.
- 순수 HTML/CSS/JavaScript(ES6+)만 사용한다. 프레임워크, jQuery·Bootstrap·Tailwind 등 라이브러리, CDN 링크(웹폰트 포함), npm, 빌드 도구 금지.
- 스크립트는 `<script src="script.js" defer>` 하나만 쓴다. `type="module"`은 `file://`로 열 때 CORS 오류가 나므로 쓰지 않는다.
- 데이터는 localStorage 키 `contentCalendar.items`에 JSON 배열로 저장한다.

## 아키텍처

- **데이터:** `contents` 배열 하나가 유일한 상태다. 항목 형태는 `{ id, title, channel, scheduledDate(YYYY-MM-DD), status, createdAt, updatedAt }`. `id`는 `Date.now().toString(36)` + 난수 문자열.
- **상수:** `CHANNELS`(instagram/youtube/blog/newsletter), `STATUSES`(planned/in_progress/review/published)를 `script.js` 맨 위에 키→표시명으로 한 번만 정의한다. 폼·필터 select 옵션과 배지는 모두 이 상수에서 생성한다. HTML에 옵션을 하드코딩하지 않는다.
- **변경 흐름:** 모든 변경(등록·수정·삭제·상태 변경)은 `contents` 변경 → `saveContents()` → `render()` 순서를 따른다. `loadContents()`는 값이 없거나 JSON 파싱에 실패하면 빈 배열로 시작한다(`try...catch`).
- **렌더링:** `render()`가 매번 목록 전체를 다시 그린다. 필터(`filters = { channel, status }`, AND 조건, 저장 안 함)는 원본을 바꾸지 않고 render 안에서만 거른다. 정렬 순서는 `scheduledDate` 오름차순, 같으면 `createdAt` 순.
- **보기 전환:** `viewMode`('list'|'calendar')에 따라 `render()`가 목록 또는 `renderCalendar()`를 그린다. 캘린더는 `currentYear`/`currentMonth`로 보고 있는 달을 관리하고, 같은 필터를 적용한다. 칩은 `data-action="edit"` 버튼이라 `#calendar-grid`에 위임된 `handleListClick`을 그대로 쓴다.
- **이벤트:** 카드 버튼(`data-action="edit"|"delete"`, `data-id`)과 상태 select의 click/change 이벤트는 `#content-list` 하나에 위임한다.
- **폼:** 등록과 수정이 같은 폼(`#content-form`)을 쓴다. 수정 중인 항목은 `editingId`로 구분하고, 유효성 검사 함수도 하나를 같이 쓴다. 등록 모드 복귀는 `resetForm()` 하나로 처리한다. 수정 중인 항목을 삭제하면 `resetForm()`을 호출한다.
- **지연:** 저장하지 않는 계산값이다. `scheduledDate < 오늘`이고 `status !== 'published'`이면 지연으로 본다.

## 자주 틀리는 부분

- 사용자 입력은 `createElement` + `textContent`로만 출력한다. `innerHTML` 금지(XSS). 제목 `<b>테스트</b>`가 글자 그대로 보여야 한다.
- 오류는 입력칸 아래 문구(`aria-live`)로 보여준다. `alert()` 금지. 삭제 확인만 `confirm()`을 쓴다.
- 오늘 날짜 문자열은 `getFullYear()/getMonth()/getDate()`로 만든다(`getTodayString()`). `toISOString()`은 UTC 기준이라 한국 시간 오전 9시 전에는 어제 날짜가 나온다.
- `new Date('YYYY-MM-DD')`는 UTC로 해석된다. 요일은 `new Date(y, m - 1, d)`로 구한다. `YYYY-MM-DD` 문자열은 `<`, `>`로 바로 비교해도 된다.
- 반응형: 768px 이상은 폼 왼쪽, 목록 오른쪽 2단, 미만은 폼 → 필터 → 목록 1단. 360px 폭에서 가로 스크롤이 없어야 한다.
- `var` 대신 `const`/`let`을 쓰고, 기능별로 함수를 나눈다.

## 작업 방식

- 한 번에 하나의 Step만 진행한다. 해당 Step의 PRD 기능 ID 범위를 넘는 기능은 미리 만들지 않는다.
- Step이 끝나면 바뀐 점을 짧게 요약하고, 사용자가 브라우저에서 확인할 그 Step의 체크리스트를 안내한다.
- 우선순위: P0(F-01~F-06, Step 1~4)가 필수, P1(F-07~F-09, Step 5~6)은 권장, P2(F-10, Step 8)는 선택. 시간이 부족하면 Step 4 다음에 바로 Step 7(마무리 점검)로 간다.
