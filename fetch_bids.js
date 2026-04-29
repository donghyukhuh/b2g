/**
 * fetch_bids.js
 * GitHub Actions에서 실행되는 서버사이드 스크립트.
 * 나라장터 API를 호출해 data/bids.json 에 저장합니다.
 * Node.js 18+ 내장 fetch 사용 (별도 패키지 불필요).
 */

const fs = require("fs");
const path = require("path");

const SERVICE_KEY = process.env.NARA_API_KEY;
const BASE_URL =
  "https://apis.data.go.kr/1230000/BidPublicInfoService/getBidPblancListInfoServcPPSSrch";
const REGION_ALLOWED = ["서울", "경기", "전국"];

// ── 날짜 헬퍼 ─────────────────────────────────────────────
function fmtDate(d) {
  // API 요구 형식: YYYYMMDD0000
  const ymd = d.toISOString().slice(0, 10).replace(/-/g, "");
  return ymd + "0000";
}

function toMoney(v) {
  const n = Number(v || 0);
  if (!n) return "-";
  return n.toLocaleString("ko-KR") + "원";
}

function isRegionAllowed(item) {
  const txt = [
    item.rgstTyNm,
    item.dminsttNm,
    item.ntceInsttNm,
    item.bidNtceNm,
  ]
    .filter(Boolean)
    .join(" ");
  return REGION_ALLOWED.some((r) => txt.includes(r));
}

// ── 키워드 목록 로드 ──────────────────────────────────────
function loadKeywords() {
  const kwPath = path.join(__dirname, "data", "keywords.json");
  if (!fs.existsSync(kwPath)) {
    console.warn("data/keywords.json 없음 → 기본 키워드 사용");
    return ["로컬", "문화", "연구", "청년", "창업", "지역", "상권", "기본계획", "운영", "활성화"];
  }
  return JSON.parse(fs.readFileSync(kwPath, "utf8"));
}

// ── API 호출 ──────────────────────────────────────────────
async function fetchKeyword(keyword) {
  const today = new Date();
  const start = new Date(today.getTime() - 1000 * 60 * 60 * 24 * 30);

  const url = new URL(BASE_URL);
  url.searchParams.set("serviceKey", SERVICE_KEY);
  url.searchParams.set("numOfRows", "100");
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("type", "json");
  url.searchParams.set("inqryDiv", "1");
  url.searchParams.set("inqryBgnDt", fmtDate(start));
  url.searchParams.set("inqryEndDt", fmtDate(today));
  url.searchParams.set("bidNtceNm", keyword);

  const resp = await fetch(url.toString());
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

  const data = await resp.json();

  // API가 에러 코드를 반환하는 경우 처리
  const resultCode = data?.response?.header?.resultCode;
  if (resultCode && resultCode !== "00") {
    throw new Error(`API 오류: ${data?.response?.header?.resultMsg}`);
  }

  const items = data?.response?.body?.items;
  if (!items) return [];

  const rows = Array.isArray(items) ? items : items.item || [];
  const normalized = Array.isArray(rows) ? rows : [rows];

  return normalized
    .filter(isRegionAllowed)
    .slice(0, 20)
    .map((it) => ({
      title: it.bidNtceNm || "-",
      amount: toMoney(it.asignBdgtAmt || it.presmptPrce),
      org: it.ntceInsttNm || it.dminsttNm || "-",
      due: it.bidClseDt || "-",
      fileUrl:
        it.ntceSpecDocUrl1 || it.ntceSpecDocUrl2 || it.ntceSpecDocUrl3 || "",
      ntceNo: it.bidNtceNo || "",
    }));
}

// ── 메인 ──────────────────────────────────────────────────
async function main() {
  if (!SERVICE_KEY) {
    console.error("NARA_API_KEY 환경변수가 없습니다. GitHub Secret을 확인하세요.");
    process.exit(1);
  }

  const keywords = loadKeywords();
  console.log(`키워드 ${keywords.length}개 조회 시작`);

  const output = { updatedAt: new Date().toISOString(), results: {} };

  for (const kw of keywords) {
    try {
      const rows = await fetchKeyword(kw);
      output.results[kw] = rows;
      console.log(`  ✓ [${kw}] ${rows.length}건`);
    } catch (e) {
      output.results[kw] = [];
      console.error(`  ✗ [${kw}] 실패: ${e.message}`);
    }
    // API 과호출 방지 딜레이
    await new Promise((r) => setTimeout(r, 300));
  }

  const dataDir = path.join(__dirname, "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(
    path.join(dataDir, "bids.json"),
    JSON.stringify(output, null, 2),
    "utf8"
  );
  console.log("→ data/bids.json 저장 완료");
}

main();
