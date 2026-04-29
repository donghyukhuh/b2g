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

    const label = document.createElement("span");
    label.textContent = kw;
    chip.appendChild(label);

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

function sanitizeHttpUrl(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.href;
    }
  } catch {
    return "";
  }
  return "";
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
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  ["공고명", "금액", "공고기관", "입찰마감일시", "파일첨부문서"].forEach((text) => {
    const th = document.createElement("th");
    th.textContent = text;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);

  const tbody = document.createElement("tbody");

  if (!rows.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 5;
    td.textContent = "검색 결과 없음";
    tr.appendChild(td);
    tbody.appendChild(tr);
  } else {
    rows.forEach((r) => {
      const tr = document.createElement("tr");

      const titleCell = document.createElement("td");
      titleCell.textContent = r.title;
      tr.appendChild(titleCell);

      const amountCell = document.createElement("td");
      amountCell.textContent = r.amount;
      tr.appendChild(amountCell);

      const orgCell = document.createElement("td");
      orgCell.textContent = r.org;
      tr.appendChild(orgCell);

      const dueCell = document.createElement("td");
      dueCell.textContent = r.due;
      tr.appendChild(dueCell);

      const fileCell = document.createElement("td");
      const safeUrl = sanitizeHttpUrl(r.fileUrl);
      if (safeUrl) {
        const link = document.createElement("a");
        link.href = safeUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "다운로드";
        fileCell.appendChild(link);
      } else {
        fileCell.textContent = "-";
      }
      tr.appendChild(fileCell);

      tbody.appendChild(tr);
    });
  }

  table.appendChild(thead);
  table.appendChild(tbody);

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
