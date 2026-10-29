// ===== 상수: 채널과 상태는 여기서만 정의한다 =====
const CHANNELS = {
  instagram: '인스타그램',
  youtube: '유튜브',
  blog: '블로그',
  newsletter: '뉴스레터',
};

const STATUSES = {
  planned: '기획',
  in_progress: '제작 중',
  review: '검토 중',
  published: '발행 완료',
};

const STORAGE_KEY = 'contentCalendar.items';
const DEFAULT_STATUS = 'planned';
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const EMPTY_ALL_MESSAGE = '아직 등록된 콘텐츠가 없어요. 첫 콘텐츠를 추가해 보세요.';
const EMPTY_FILTER_MESSAGE = '조건에 맞는 콘텐츠가 없어요.';

// ===== DOM 요소 =====
const todayEl = document.getElementById('today');
const formTitle = document.getElementById('form-title');
const form = document.getElementById('content-form');
const submitButton = document.getElementById('submit-button');
const cancelButton = document.getElementById('cancel-button');
const titleInput = document.getElementById('title-input');
const channelInput = document.getElementById('channel-input');
const dateInput = document.getElementById('date-input');
const statusInput = document.getElementById('status-input');
const channelFilter = document.getElementById('channel-filter');
const statusFilter = document.getElementById('status-filter');
const countEl = document.getElementById('content-count');
const listEl = document.getElementById('content-list');
const emptyEl = document.getElementById('empty-message');
const viewTabs = document.getElementById('view-tabs');
const calendarEl = document.getElementById('calendar');
const calendarTitle = document.getElementById('calendar-title');
const calendarGrid = document.getElementById('calendar-grid');
const prevMonthButton = document.getElementById('prev-month');
const nextMonthButton = document.getElementById('next-month');

const errorEls = {
  title: document.getElementById('title-error'),
  channel: document.getElementById('channel-error'),
  scheduledDate: document.getElementById('date-error'),
};

// ===== 데이터 =====
let contents = [];
// 수정 중인 콘텐츠 id. 등록 모드일 때는 null이다.
let editingId = null;
// 목록 필터. 저장하지 않으므로 새로고침하면 '전체'로 돌아간다.
const filters = { channel: 'all', status: 'all' };
// 현재 보기: 'list' 또는 'calendar'
let viewMode = 'list';
// 캘린더에서 보고 있는 연도와 월(0~11). 처음에는 이번 달이다.
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();

// 저장된 항목이 화면을 그릴 수 있는 형태인지 확인한다.
function isValidItem(item) {
  return Boolean(item) &&
    typeof item.id === 'string' &&
    typeof item.title === 'string' &&
    typeof item.scheduledDate === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(item.scheduledDate);
}

// localStorage에서 불러온다. 값이 없거나 깨져 있으면 빈 배열로 시작하고, 형태가 잘못된 항목은 건너뛴다.
function loadContents() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    contents = Array.isArray(saved) ? saved.filter(isValidItem) : [];
  } catch (error) {
    contents = [];
  }
}

// 현재 contents 배열을 localStorage에 저장한다.
function saveContents() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(contents));
}

// 고유 id를 만든다.
function createId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ===== 날짜 =====
// 숫자를 두 자리 문자열로 만든다. 예: 3 → '03'
function pad2(number) {
  return String(number).padStart(2, '0');
}

// 'YYYY-MM-DD'를 로컬 기준 Date로 바꾼다. new Date('YYYY-MM-DD')는 UTC로 해석되므로 쓰지 않는다.
function parseDate(dateString) {
  const [y, m, d] = dateString.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// 'YYYY-MM-DD'를 '10.20 (화)' 형식으로 바꾼다.
function formatDate(dateString) {
  const date = parseDate(dateString);
  return `${pad2(date.getMonth() + 1)}.${pad2(date.getDate())} (${WEEKDAYS[date.getDay()]})`;
}

// 로컬 기준 오늘 날짜를 'YYYY-MM-DD'로 돌려준다. toISOString()은 UTC 기준이라 쓰지 않는다.
function getTodayString() {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

// 예정일이 오늘보다 이전이고 발행 완료가 아니면 지연이다. (저장하지 않는 계산값)
function isDelayed(item, today) {
  return item.scheduledDate < today && item.status !== 'published';
}

// 헤더에 오늘 날짜를 로컬 기준으로 표시한다. 예: 2026.10.13 (화)
function renderToday() {
  const today = getTodayString();
  todayEl.textContent = `${today.slice(0, 4)}.${formatDate(today)}`;
}

// ===== select 옵션 채우기 =====
// 상수 객체(키 → 표시명)로 select에 option을 추가한다.
function appendOptions(selectEl, map) {
  Object.entries(map).forEach(([value, label]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    selectEl.appendChild(option);
  });
}

function initSelects() {
  appendOptions(channelInput, CHANNELS);
  appendOptions(statusInput, STATUSES);
  appendOptions(channelFilter, CHANNELS);
  appendOptions(statusFilter, STATUSES);
  statusInput.value = DEFAULT_STATUS;
  // 브라우저가 새로고침 전 선택값을 복원해도 filters와 어긋나지 않게 '전체'로 맞춘다.
  channelFilter.value = filters.channel;
  statusFilter.value = filters.status;
}

// ===== 폼 =====
// 폼 값을 읽는다. 제목은 앞뒤 공백을 지운다.
function getFormValues() {
  return {
    title: titleInput.value.trim(),
    channel: channelInput.value,
    scheduledDate: dateInput.value,
    status: statusInput.value,
  };
}

// 입력값을 검사하고 { 필드: 오류 문구 } 객체를 돌려준다. 비어 있으면 통과다.
function validate(values) {
  const errors = {};
  if (!values.title) {
    errors.title = '제목을 입력해 주세요.';
  }
  if (!CHANNELS[values.channel]) {
    errors.channel = '채널을 선택해 주세요.';
  }
  if (!values.scheduledDate) {
    errors.scheduledDate = '예정일을 선택해 주세요.';
  }
  return errors;
}

// 각 입력칸 아래에 오류 문구를 보여준다. 오류가 없는 칸은 비운다.
function showErrors(errors) {
  Object.keys(errorEls).forEach((field) => {
    errorEls[field].textContent = errors[field] || '';
  });
}

// 폼을 비우고 등록 모드로 되돌린 뒤 제목칸에 포커스를 둔다.
// 등록 완료, 수정 완료, 취소 모두 이 함수 하나로 처리한다.
function resetForm() {
  editingId = null;
  form.reset();
  statusInput.value = DEFAULT_STATUS;
  showErrors({});
  formTitle.textContent = '콘텐츠 등록';
  submitButton.textContent = '등록';
  cancelButton.hidden = true;
  updateEditingHighlight();
  titleInput.focus();
}

// 폼을 수정 모드로 바꾸고 기존 값을 채운다.
function startEdit(id) {
  const item = contents.find((content) => content.id === id);
  if (!item) {
    return;
  }

  editingId = id;
  titleInput.value = item.title;
  channelInput.value = item.channel;
  dateInput.value = item.scheduledDate;
  statusInput.value = item.status;
  showErrors({});
  formTitle.textContent = '콘텐츠 수정';
  submitButton.textContent = '수정 완료';
  cancelButton.hidden = false;
  updateEditingHighlight();
  titleInput.focus();
}

// 제출: 검사 → (수정 모드면 갱신 / 아니면 추가) → 저장 → 다시 그리기 → 폼 초기화
function handleSubmit(event) {
  event.preventDefault();

  const values = getFormValues();
  const errors = validate(values);
  showErrors(errors);
  if (Object.keys(errors).length > 0) {
    return;
  }

  const now = new Date().toISOString();
  const status = STATUSES[values.status] ? values.status : DEFAULT_STATUS;

  if (editingId) {
    const item = contents.find((content) => content.id === editingId);
    if (item) {
      item.title = values.title;
      item.channel = values.channel;
      item.scheduledDate = values.scheduledDate;
      item.status = status;
      item.updatedAt = now;
    }
  } else {
    contents.push({
      id: createId(),
      title: values.title,
      channel: values.channel,
      scheduledDate: values.scheduledDate,
      status,
      createdAt: now,
      updatedAt: now,
    });
  }

  saveContents();
  render();
  resetForm();
}

// 목록 클릭 이벤트 위임: 카드 안 버튼의 data-action으로 동작을 나눈다.
function handleListClick(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) {
    return;
  }

  if (button.dataset.action === 'edit') {
    startEdit(button.dataset.id);
  } else if (button.dataset.action === 'delete') {
    deleteContent(button.dataset.id);
  }
}

// 목록 change 이벤트 위임: 카드의 상태 select를 바꾸면 바로 저장하고 다시 그린다.
function handleListChange(event) {
  const select = event.target.closest('select[data-action="status"]');
  if (!select) {
    return;
  }

  const item = contents.find((content) => content.id === select.dataset.id);
  if (!item || !STATUSES[select.value]) {
    return;
  }

  item.status = select.value;
  item.updatedAt = new Date().toISOString();
  saveContents();
  render();

  // 다시 그리면 select가 새로 만들어지므로, 키보드 사용자를 위해 포커스를 되돌린다.
  const newSelect = listEl.querySelector(`select[data-action="status"][data-id="${CSS.escape(item.id)}"]`);
  if (newSelect) {
    newSelect.focus();
  }

  // 수정 중인 항목이면 폼의 상태 값도 맞춰 둔다.
  if (editingId === item.id) {
    statusInput.value = item.status;
  }
}

// 삭제: 확인 → 배열에서 제거 → 저장 → 다시 그리기. 수정 중이던 항목이면 폼도 초기화한다.
function deleteContent(id) {
  const item = contents.find((content) => content.id === id);
  if (!item || !confirm(`'${item.title}' 콘텐츠를 삭제할까요?`)) {
    return;
  }

  // 지운 카드의 화면상 위치를 기억해 두었다가, 다시 그린 뒤 그 자리 카드로 포커스를 옮긴다.
  const cards = [...listEl.querySelectorAll('.card')];
  const index = cards.findIndex((card) => card.dataset.id === id);

  contents = contents.filter((content) => content.id !== id);
  saveContents();
  render();

  if (editingId === id) {
    resetForm();
    return;
  }
  focusCardAt(index);
}

// index 위치(없으면 마지막) 카드의 삭제 버튼에 포커스를 둔다. 카드가 없으면 제목칸으로 보낸다.
function focusCardAt(index) {
  const buttons = listEl.querySelectorAll('button[data-action="delete"]');
  const target = buttons[Math.min(index, buttons.length - 1)];
  if (target) {
    target.focus();
  } else {
    titleInput.focus();
  }
}

// ===== 목록 그리기 =====
// 예정일 오름차순, 같으면 먼저 등록한 순서로 정렬한 새 배열을 돌려준다.
function getSortedContents(items) {
  return [...items].sort((a, b) => {
    if (a.scheduledDate !== b.scheduledDate) {
      return a.scheduledDate < b.scheduledDate ? -1 : 1;
    }
    return a.createdAt < b.createdAt ? -1 : 1;
  });
}

// 텍스트가 들어간 요소를 만든다. 사용자 입력은 반드시 textContent로 넣는다.
function createTextElement(tagName, className, text) {
  const el = document.createElement(tagName);
  el.className = className;
  el.textContent = text;
  return el;
}

// 카드의 수정·삭제 버튼을 만든다. 클릭은 목록 컨테이너에서 위임 처리한다.
function createActionButton(action, label, id) {
  const button = createTextElement('button', 'btn btn-small', label);
  button.type = 'button';
  button.dataset.action = action;
  button.dataset.id = id;
  if (action === 'delete') {
    button.classList.add('btn-danger');
  }
  return button;
}

// 카드의 상태 select를 만든다. 상태별 색은 data-status와 CSS로 보여준다.
function createStatusSelect(item) {
  const select = document.createElement('select');
  select.className = 'badge badge-status status-select';
  select.dataset.action = 'status';
  select.dataset.id = item.id;
  select.dataset.status = item.status;
  select.setAttribute('aria-label', `'${item.title}' 상태 변경`);
  appendOptions(select, STATUSES);
  select.value = item.status;
  return select;
}

// 콘텐츠 1건으로 카드(li)를 만든다.
function createCard(item, today) {
  const card = document.createElement('li');
  card.className = 'card';
  card.dataset.id = item.id;
  if (item.status === 'published') {
    card.classList.add('is-published');
  }

  const meta = document.createElement('div');
  meta.className = 'card-meta';
  const channelBadge = createTextElement('span', 'badge badge-channel', CHANNELS[item.channel] || item.channel);
  channelBadge.dataset.channel = item.channel;
  meta.append(channelBadge, createTextElement('span', 'card-date', formatDate(item.scheduledDate)));
  if (isDelayed(item, today)) {
    meta.appendChild(createTextElement('span', 'badge badge-delay', '지연'));
  }

  const title = createTextElement('p', 'card-title', item.title);

  const footer = document.createElement('div');
  footer.className = 'card-footer';
  const statusSelect = createStatusSelect(item);

  const actions = document.createElement('div');
  actions.className = 'card-actions';
  actions.append(
    createActionButton('edit', '수정', item.id),
    createActionButton('delete', '삭제', item.id),
  );
  footer.append(statusSelect, actions);

  card.append(meta, title, footer);
  return card;
}

// 수정 중인 카드에만 강조 클래스를 붙인다.
function updateEditingHighlight() {
  listEl.querySelectorAll('.card').forEach((card) => {
    card.classList.toggle('is-editing', card.dataset.id === editingId);
  });
}

// 필터가 하나라도 걸려 있는지 확인한다.
function isFiltering() {
  return filters.channel !== 'all' || filters.status !== 'all';
}

// 채널·상태 조건을 모두 만족하는 항목만 담은 새 배열을 돌려준다. 원본은 바꾸지 않는다.
function getFilteredContents(items) {
  return items.filter((item) =>
    (filters.channel === 'all' || item.channel === filters.channel) &&
    (filters.status === 'all' || item.status === filters.status));
}

// 필터 select 값을 filters에 반영하고 다시 그린다. 데이터 변경이 아니므로 저장하지 않는다.
function handleFilterChange() {
  filters.channel = channelFilter.value;
  filters.status = statusFilter.value;
  render();
}

// ===== 보기 전환과 캘린더 =====
// 탭 클릭 이벤트 위임: 보기를 바꾸고 다시 그린다.
function handleTabClick(event) {
  const button = event.target.closest('button[data-view]');
  if (!button) {
    return;
  }

  viewMode = button.dataset.view;
  viewTabs.querySelectorAll('button[data-view]').forEach((tab) => {
    tab.setAttribute('aria-pressed', String(tab.dataset.view === viewMode));
  });
  render();
}

// 보고 있는 달을 delta만큼 옮긴다. new Date가 12월 → 다음 해 1월처럼 연도를 알아서 넘겨준다.
function changeMonth(delta) {
  const date = new Date(currentYear, currentMonth + delta, 1);
  currentYear = date.getFullYear();
  currentMonth = date.getMonth();
  render();
}

// 캘린더 칩을 만든다. 누르면 목록의 [수정]과 같은 동작(data-action="edit")을 한다.
function createChip(item) {
  const chip = createTextElement('button', 'chip badge-channel', item.title);
  chip.type = 'button';
  chip.dataset.action = 'edit';
  chip.dataset.id = item.id;
  chip.dataset.channel = item.channel;
  chip.title = item.title;
  chip.setAttribute('aria-label', `${item.title} (${CHANNELS[item.channel] || item.channel}, ${STATUSES[item.status] || item.status}) 수정`);
  return chip;
}

// 빈 칸(이번 달이 아닌 칸)을 만든다.
function createEmptyCell() {
  const cell = document.createElement('div');
  cell.className = 'calendar-day is-empty';
  return cell;
}

// 보고 있는 달의 캘린더를 그린다. items는 필터·정렬이 끝난 목록이다.
function renderCalendar(items, today) {
  calendarTitle.textContent = `${currentYear}년 ${currentMonth + 1}월`;

  // 날짜별로 콘텐츠를 묶어 둔다.
  const itemsByDate = new Map();
  items.forEach((item) => {
    if (!itemsByDate.has(item.scheduledDate)) {
      itemsByDate.set(item.scheduledDate, []);
    }
    itemsByDate.get(item.scheduledDate).push(item);
  });

  const cells = WEEKDAYS.map((weekday) => createTextElement('div', 'calendar-weekday', weekday));

  // 1일의 요일만큼 앞칸을 비운다.
  const firstWeekday = new Date(currentYear, currentMonth, 1).getDay();
  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push(createEmptyCell());
  }

  // 1일부터 마지막 날까지 날짜 칸을 채운다. (다음 달 0일 = 이번 달 마지막 날)
  const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
  for (let day = 1; day <= lastDay; day += 1) {
    const dateString = `${currentYear}-${pad2(currentMonth + 1)}-${pad2(day)}`;
    const cell = document.createElement('div');
    cell.className = 'calendar-day';
    if (dateString === today) {
      cell.classList.add('is-today');
      cell.setAttribute('aria-current', 'date');
    }
    cell.appendChild(createTextElement('span', 'calendar-date', String(day)));
    (itemsByDate.get(dateString) || []).forEach((item) => {
      cell.appendChild(createChip(item));
    });
    cells.push(cell);
  }

  // 마지막 주의 남은 칸도 비워 격자를 맞춘다.
  const usedCells = firstWeekday + lastDay;
  for (let i = usedCells % 7; i > 0 && i < 7; i += 1) {
    cells.push(createEmptyCell());
  }

  calendarGrid.replaceChildren(...cells);
}

// contents 배열을 기준으로 현재 보기(목록/캘린더), 건수, 빈 상태 문구를 다시 그린다.
function render() {
  const today = getTodayString();
  const visible = getSortedContents(getFilteredContents(contents));
  const isListView = viewMode === 'list';

  listEl.hidden = !isListView;
  calendarEl.hidden = isListView;
  if (isListView) {
    listEl.replaceChildren(...visible.map((item) => createCard(item, today)));
    updateEditingHighlight();
  } else {
    renderCalendar(visible, today);
  }

  countEl.textContent = isFiltering()
    ? `${visible.length}건 / 전체 ${contents.length}건`
    : `전체 ${contents.length}건`;

  // 전체 0건과 필터 결과 0건은 문구를 다르게 보여준다. 캘린더 보기에서는 빈 달력이 그 역할을 한다.
  emptyEl.hidden = !isListView || visible.length > 0;
  emptyEl.textContent = contents.length === 0 ? EMPTY_ALL_MESSAGE : EMPTY_FILTER_MESSAGE;
}

// ===== 시작 =====
function init() {
  initSelects();
  renderToday();
  loadContents();
  render();
  form.addEventListener('submit', handleSubmit);
  cancelButton.addEventListener('click', resetForm);
  listEl.addEventListener('click', handleListClick);
  listEl.addEventListener('change', handleListChange);
  channelFilter.addEventListener('change', handleFilterChange);
  statusFilter.addEventListener('change', handleFilterChange);
  viewTabs.addEventListener('click', handleTabClick);
  calendarGrid.addEventListener('click', handleListClick);
  prevMonthButton.addEventListener('click', () => changeMonth(-1));
  nextMonthButton.addEventListener('click', () => changeMonth(1));
}

init();
