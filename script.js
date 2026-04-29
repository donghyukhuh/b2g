/**
 * script.js
 * GitHub Pages 프론트엔드.
 * API를 직접 호출하지 않고, GitHub Actions가 생성한
 * data/bids.json 을 fetch해서 렌더링합니다.
 */

// ── 상수 ──────────────────────────────────────────────────
const DEFAULT_KEYWORDS = [
  "로컬", "문화", "연구", "청년", "창업",
  "지역", "상권", "기본계획", "운영", "활성화",
];
const DATA_URL = "data/bids.json";

// ── 상태 ──────────────────────────────────────────────────
const state = {
  keywords: loadKeywords(),
  allData: {},   // { keyword: [rows] }
};

// ── DOM 참조 ──────────────────────────────────────────────
const keywordInput  = document.getElementById("keywordInput");
const addKeywordBtn = document.getElementById("addKeywordBtn");
const refreshBtn    = document.getElementById("refreshBtn");
const keywordChips  = document.getElementById("keywordChips");
const results       = document.getElementById("results");
const lastUpdated   = document.getElementById("lastUpdated");
const statusBadge   = document.getElementById("statusBadge");

// ── 키워드 저장/불러오기 ──────────────────────────────────
function loadKeywords() {
  try {
    const raw = localStorage.getItem("nara_keywords");
    return raw ? JSON.parse(raw) : [...DEFAULT_KEYWORDS];
  } catch {
    return [...DEFAULT_KEYWORDS];
  }
}

function saveKeywords() {
  localStorage.setItem("nara_keywords", JSON.stringify(state.keywords));
}

// ── 키워드 칩 렌더 ────────────────────────────────────────
function renderChips() {
  keywordChips.innerHTML = "";
  state.keywords.forEach((kw) => {
    const chip = document.createElement("div");
    chip.className = "chip";

    const label = document.createElement("span");
    label.textContent = kw;

    // 해당 키워드가 수집 데이터에 없으면 경고 표시
    if (state.allData && !(kw in state.allData)) {
      label.title = "이 키워드는 자동 수집 대상이 아닙니다.\ndata/keywords.json에 추가하면 다음 갱신 시 포함됩니다.";
      label.style.opacity = "0.6";
    }

    const del = document.createElement("button");
    del.className = "del";
    del.textContent = "✕";
    del.setAttribute("aria-label", `${kw} 삭제`);
    del.onclick = () => {
      state.keywords = state.keywords.filter((k) => k !== kw);
      saveKeywords();
      renderChips();
      renderResults();
    };

    chip.appendChild(label);
    chip.appendChild(del);
    keywordChips.appendChild(chip);
  });
}

// ── 결과 렌더 ─────────────────────────────────────────────
function renderResults() {
  const frag = document.createDocumentFragment();

  for (const kw of state.keywords) {
    const rows = state.allData[kw];
    frag.appendChild(renderSection(kw, rows));
  }

  results.innerHTML = "";
  results.appendChild(frag);
}

function renderSection(keyword, rows) {
  const section = document.createElement("section");

  const title = document.createElement("h3");
  title.className = "keyword-title";
  title.textContent = `키워드: ${keyword}`;
  section.appendChild(title);

  // 수집 대상 아닌 키워드 안내
  if (!rows) {
    const notice = document.createElement("p");
    notice.className = "small warn";
    notice.textContent =
      "이 키워드는 자동 수집 대상이 아닙니다. data/keywords.json에 추가 후 Actions를 실행하세요.";
    section.appendChild(notice);
    return section;
  }

  const wrap = document.createElement("div");
  wrap.className = "table-wrap";

  const table = document.createElement("table");
  table.innerHTML = `
    <thead>
      <tr>
        <th>공고명</th>
        <th>금액</th>
        <th>공고기관</th>
        <th>입찰마감일시</th>
        <th>첨부문서</th>
      </tr>
    </thead>
    <tbody>
      ${
        rows.length
          ? rows
              .map(
                (r) => `
        <tr>
          <td>${escHtml(r.title)}</td>
          <td>${escHtml(r.amount)}</td>
          <td>${escHtml(r.org)}</td>
          <td>${escHtml(r.due)}</td>
          <td>${
            r.fileUrl
              ? `<a href="${escHtml(r.fileUrl)}" target="_blank" rel="noopener noreferrer">다운로드</a>`
              : "-"
          }</td>
        </tr>`
              )
              .join("")
          : `<tr><td colspan="5" style="text-align:center;color:#888">검색 결과 없음</td></tr>`
      }
    </tbody>
  `;

  wrap.appendChild(table);
  section.appendChild(wrap);
  return section;
}

function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── 데이터 로드 ───────────────────────────────────────────
async function loadData() {
  setStatus("loading");
  results.innerHTML = `<p class="small" style="padding:8px">데이터를 불러오는 중…</p>`;

  try {
    // 캐시 방지: ?t=타임스탬프
    const resp = await fetch(`${DATA_URL}?t=${Date.now()}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const json = await resp.json();
    state.allData = json.results || {};

    const updatedAt = json.updatedAt
      ? new Date(json.updatedAt).toLocaleString("ko-KR")
      : "-";
    lastUpdated.textContent = `최근 갱신: ${updatedAt}`;

    renderChips();  // 수집 여부 반영
    renderResults();
    setStatus("ok");
  } catch (e) {
    results.innerHTML = `
      <p class="small warn" style="padding:8px">
        ⚠ data/bids.json 로드 실패: ${e.message}<br>
        GitHub Actions가 아직 실행되지 않았거나, Actions 실행 중일 수 있습니다.
        잠시 후 새로고침하거나 Actions 탭에서 수동 실행하세요.
      </p>`;
    setStatus("error");
  }
}

function setStatus(s) {
  if (!statusBadge) return;
  const map = {
    loading: ["로딩 중…",  "#f59e0b"],
    ok:      ["정상",       "#22c55e"],
    error:   ["오류",       "#ef4444"],
  };
  const [text, color] = map[s] || ["", ""];
  statusBadge.textContent = text;
  statusBadge.style.background = color;
}

// ── 이벤트 ────────────────────────────────────────────────
addKeywordBtn.onclick = () => {
  const kw = keywordInput.value.trim();
  if (!kw || state.keywords.includes(kw)) return;
  state.keywords.push(kw);
  keywordInput.value = "";
  saveKeywords();
  renderChips();
  renderResults();
};

keywordInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addKeywordBtn.click();
});

refreshBtn.onclick = loadData;

// ── 초기 실행 ─────────────────────────────────────────────
loadData();
// 5분마다 자동 갱신 (Actions가 실행된 경우 반영)
setInterval(loadData, 5 * 60 * 1000);
