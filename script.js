const SERVICE_KEY = "45dd6772b86a0a8c153347fcff4f16f6df199aabbd2a4dd7bada3f3fa1739314";
const BASE_URL = "https://apis.data.go.kr/1230000/BidPublicInfoService/getBidPblancListInfoServcPPSSrch";
const DEFAULT_KEYWORDS = ["로컬", "문화", "연구", "청년", "창업", "지역", "상권", "기본계획", "운영", "활성화"];
const REGION_ALLOWED = ["서울", "경기", "전국"];

const state = {
  keywords: loadKeywords(),
};

const keywordInput = document.getElementById("keywordInput");
const addKeywordBtn = document.getElementById("addKeywordBtn");
const refreshBtn = document.getElementById("refreshBtn");
const keywordChips = document.getElementById("keywordChips");
const results = document.getElementById("results");
const lastUpdated = document.getElementById("lastUpdated");

function loadKeywords() {
  const raw = localStorage.getItem("nara_keywords");
  if (!raw) return [...DEFAULT_KEYWORDS];
  try { return JSON.parse(raw); } catch { return [...DEFAULT_KEYWORDS]; }
}

function saveKeywords() {
  localStorage.setItem("nara_keywords", JSON.stringify(state.keywords));
}

function renderChips() {
  keywordChips.innerHTML = "";
  state.keywords.forEach((kw) => {
    const chip = document.createElement("div");
    chip.className = "chip";
    chip.innerHTML = `<span>${kw}</span>`;

    const del = document.createElement("button");
    del.className = "del";
    del.textContent = "✕";
    del.onclick = () => {
      state.keywords = state.keywords.filter((k) => k !== kw);
      saveKeywords();
      renderChips();
      refreshAll();
    };

    chip.appendChild(del);
    keywordChips.appendChild(chip);
  });
}

function toMoney(v) {
  const n = Number(v || 0);
  if (!n) return "-";
  return n.toLocaleString("ko-KR") + "원";
}

function isRegionAllowed(item) {
  const txt = `${item.rgstTyNm || ""} ${item.dminsttNm || ""} ${item.ntceInsttNm || ""} ${item.bidNtceNm || ""}`;
  return REGION_ALLOWED.some((r) => txt.includes(r));
}

async function fetchKeyword(keyword) {
  const today = new Date();
  const start = new Date(today.getTime() - 1000 * 60 * 60 * 24 * 30);
  const fmt = (d) => d.toISOString().slice(0, 10).replaceAll("-", "");

  const url = new URL(BASE_URL);
  url.searchParams.set("serviceKey", SERVICE_KEY);
  url.searchParams.set("numOfRows", "100");
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("type", "json");
  url.searchParams.set("inqryDiv", "1");
  url.searchParams.set("inqryBgnDt", fmt(start));
  url.searchParams.set("inqryEndDt", fmt(today));
  url.searchParams.set("bidNtceNm", keyword);

  const resp = await fetch(url.toString());
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  const items = data?.response?.body?.items;

  if (!items) return [];
  const rows = Array.isArray(items) ? items : items.item || [];
  const normalized = Array.isArray(rows) ? rows : [rows];

  return normalized
    .filter((it) => isRegionAllowed(it))
    .slice(0, 10)
    .map((it) => ({
      title: it.bidNtceNm || "-",
      amount: toMoney(it.asignBdgtAmt || it.presmptPrce),
      org: it.ntceInsttNm || it.dminsttNm || "-",
      due: it.bidClseDt || "-",
      fileUrl: it.ntceSpecDocUrl1 || it.ntceSpecDocUrl2 || it.ntceSpecDocUrl3 || "",
    }));
}

function renderTable(keyword, rows, error = "") {
  const section = document.createElement("section");
  const title = document.createElement("h3");
  title.className = "keyword-title";
  title.textContent = `키워드: ${keyword}`;
  section.appendChild(title);

  if (error) {
    const p = document.createElement("p");
    p.className = "small";
    p.textContent = `조회 실패: ${error}`;
    section.appendChild(p);
    return section;
  }

  const wrap = document.createElement("div");
  wrap.className = "table-wrap";

  const table = document.createElement("table");
  table.innerHTML = `
    <thead>
      <tr>
        <th>공고명</th><th>금액</th><th>공고기관</th><th>입찰마감일시</th><th>파일첨부문서</th>
      </tr>
    </thead>
    <tbody>
      ${rows.length ? rows.map(r => `
        <tr>
          <td>${r.title}</td>
          <td>${r.amount}</td>
          <td>${r.org}</td>
          <td>${r.due}</td>
          <td>${r.fileUrl ? `<a href="${r.fileUrl}" target="_blank" rel="noopener">다운로드</a>` : "-"}</td>
        </tr>
      `).join("") : `<tr><td colspan="5">검색 결과 없음</td></tr>`}
    </tbody>
  `;

  wrap.appendChild(table);
  section.appendChild(wrap);
  return section;
}

async function refreshAll() {
  results.innerHTML = "조회 중...";
  const frag = document.createDocumentFragment();

  for (const kw of state.keywords) {
    try {
      const rows = await fetchKeyword(kw);
      frag.appendChild(renderTable(kw, rows));
    } catch (e) {
      frag.appendChild(renderTable(kw, [], e.message));
    }
  }

  results.innerHTML = "";
  results.appendChild(frag);
  lastUpdated.textContent = `최근 갱신: ${new Date().toLocaleString("ko-KR")}`;
}

addKeywordBtn.onclick = () => {
  const kw = keywordInput.value.trim();
  if (!kw || state.keywords.includes(kw)) return;
  state.keywords.push(kw);
  keywordInput.value = "";
  saveKeywords();
  renderChips();
  refreshAll();
};

refreshBtn.onclick = refreshAll;

renderChips();
refreshAll();
setInterval(refreshAll, 60000);
