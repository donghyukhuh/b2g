const fs = require("fs");
const path = require("path");

const SERVICE_KEY = process.env.NARA_API_KEY;
const BASE_URL = "https://apis.data.go.kr/1230000/BidPublicInfoService/getBidPblancListInfoServcPPSSrch";

function fmtDate(d) {
  return d.toISOString().slice(0, 10).replace(/-/g, "") + "0000";
}

function toMoney(v) {
  const n = Number(v || 0);
  if (!n) return "-";
  return n.toLocaleString("ko-KR") + "원";
}

function loadKeywords() {
  const kwPath = path.join(__dirname, "data", "keywords.json");
  if (!fs.existsSync(kwPath)) {
    return ["로컬", "문화", "연구", "청년", "창업", "지역", "상권", "기본계획", "운영", "활성화"];
  }
  return JSON.parse(fs.readFileSync(kwPath, "utf8"));
}

async function fetchKeyword(keyword) {
  const today = new Date();
  const start = new Date(today.getTime() - 1000 * 60 * 60 * 24 * 30);

  const url = BASE_URL
    + "?serviceKey=" + SERVICE_KEY
    + "&numOfRows=100"
    + "&pageNo=1"
    + "&type=json"
    + "&inqryDiv=1"
    + "&inqryBgnDt=" + fmtDate(start)
    + "&inqryEndDt=" + fmtDate(today)
    + "&bidNtceNm=" + encodeURIComponent(keyword);

  const resp = await fetch(url);
  if (!resp.ok) throw new Error("HTTP " + resp.status);

  const data = await resp.json();

  const resultCode = data?.response?.header?.resultCode;
  if (resultCode && resultCode !== "00") {
    throw new Error("API 오류: " + data?.response?.header?.resultMsg);
  }

  const items = data?.response?.body?.items;
  if (!items) return [];

  const rows = Array.isArray(items) ? items : items.item || [];
  const normalized = Array.isArray(rows) ? rows : [rows];

  return normalized.slice(0, 20).map((it) => ({
    title: it.bidNtceNm || "-",
    amount: toMoney(it.asignBdgtAmt || it.presmptPrce),
    org: it.ntceInsttNm || it.dminsttNm || "-",
    due: it.bidClseDt || "-",
    fileUrl: it.ntceSpecDocUrl1 || it.ntceSpecDocUrl2 || it.ntceSpecDocUrl3 || "",
  }));
}

async function main() {
  if (!SERVICE_KEY) {
    console.error("NARA_API_KEY 환경변수가 없습니다.");
    process.exit(1);
  }

  const keywords = loadKeywords();
  console.log("키워드 " + keywords.length + "개 조회 시작");

  const output = { updatedAt: new Date().toISOString(), results: {} };

  for (const kw of keywords) {
    try {
      const rows = await fetchKeyword(kw);
      output.results[kw] = rows;
      console.log("  ✓ [" + kw + "] " + rows.length + "건");
    } catch (e) {
      output.results[kw] = [];
      console.error("  ✗ [" + kw + "] 실패: " + e.message);
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  const dataDir = path.join(__dirname, "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, "bids.json"), JSON.stringify(output, null, 2), "utf8");
  console.log("→ data/bids.json 저장 완료");
}

main();
