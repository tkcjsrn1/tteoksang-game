/* 가격과 주문 규칙. 정수만 사용합니다. 100bp = 1%p */
import type { EventImpact, GameMode, Holding, Level, Order, PriceBreakdown, RoomSettings, Side, StockCode } from './types';

export const DISCLAIMER = '게임용 가상 정보이며 투자 조언이 아닙니다';
export const START_CASH = 10_000_000;
export const MAX_RETURN_BP = 2000;
export const MARKET_MAX_BP = 50;
/* 거래 비용: 수수료는 살 때와 팔 때 모두, 증권거래세는 팔 때만 냅니다.
   실제 세율(2026년 양도분부터 코스피·코스닥 모두 농어촌특별세 포함 0.20%)을 그대로 쓰고, 수수료는 게임용 값입니다. */
export const FEE_BP = 10;
export const TAX_BP = 20;

/* 라운드 시간(초). 한 라운드 = 뉴스 + 주문 + 결과. 처음 하는 사람도 뉴스를 읽고 판단할 수 있게 한 라운드를 2분 넘게 둡니다(2026-11 결정). */
export const MODES: Record<GameMode, { rounds: number; news: number; trade: number; recap: number; maxPlayers: number; minToStart: number; arcs: number; cards: number; level: Level; label: string }> = {
  friend:   { rounds: 5,  news: 20, trade: 90, recap: 20, maxPlayers: 8,  minToStart: 2, arcs: 2, cards: 3, level: 'easy', label: '친구 대전' },
  solo:     { rounds: 5,  news: 20, trade: 90, recap: 20, maxPlayers: 1,  minToStart: 1, arcs: 2, cards: 3, level: 'easy', label: '혼자 연습' }
};

/* 방을 만들 때 고를 수 있는 값. 고르지 않으면 MODES와 STOCKS_PER_GAME 기본값을 씁니다. */
export const ROOM_OPTIONS: Record<'stocks' | 'rounds' | 'trade' | 'maxPlayers', readonly number[]> = {
  stocks: [10, 20, 30, 50], rounds: [3, 5, 8, 10], trade: [45, 60, 90, 120], maxPlayers: [8, 20, 40, 80]
};
/* 정원은 친구 대전에만 씁니다. 학술제처럼 한 방에 많이 들어오는 자리를 위해 열어 둔 값이고,
   기본값은 MODES.friend.maxPlayers(8명)입니다. 혼자 연습에는 적용하지 않습니다(서버가 거절). */
export const CAPACITY_NOTE = '친구 방에만 적용돼요. 많은 인원이 한 방에서 할 때만 올리세요';
/* 난이도. 쉬움은 시장가만 쓰고 어려운 장치를 감춥니다. 사건·속보·VI처럼 재미를 주는 부분은 그대로입니다. */
export const LEVELS: readonly Level[] = ['easy', 'pro'];
export const LEVEL_LABEL: Record<Level, string> = { easy: '쉬움', pro: '실전' };
export const LEVEL_NOTE: Record<Level, string> = {
  easy: '시장가로만 사고팝니다. 호가창·지정가·손절·익절은 숨깁니다',
  pro: '호가창·지정가·손절·익절까지 모두 씁니다'
};
export const isLevel = (v: unknown): v is Level => v === 'easy' || v === 'pro';
/** 한 판에 나오는 종목 수 기본값 */
export const STOCKS_PER_GAME = 10;
/** 기기에 저장해 둔 설정 문자열을 읽습니다. 깨졌거나 고를 수 없는 값은 버립니다. */
export function cleanSettings(saved: string | null | undefined): RoomSettings {
  let raw: unknown = null;
  try { raw = JSON.parse(saved ?? '{}'); } catch { return {}; }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: RoomSettings = {};
  for (const [key, choices] of Object.entries(ROOM_OPTIONS)) {
    const v = (raw as Record<string, unknown>)[key];
    if (typeof v === 'number' && choices.includes(v)) out[key as 'stocks' | 'rounds' | 'trade' | 'maxPlayers'] = v;
  }
  const level = (raw as Record<string, unknown>).level;
  if (isLevel(level)) out.level = level;
  return out;
}

/* 종목 50개 = 업종 10개 × 5종목. 그중 뉴스가 붙는 업종은 앞의 6개입니다. 각 업종의 첫 종목(대표 종목)이 뉴스의 주인공이고,
   같은 업종 종목은 대표 종목 뉴스에 linkBeta 비율만큼 함께 움직입니다(업종 동조화).
   한 판에는 대표 종목 6개와 방 설정으로 정한 수의 관련 종목이 나옵니다(server/src/plan.ts pickStocks).
   모든 기업은 지어낸 가상 기업입니다. */
export type StockGroup = 'power' | 'storage' | 'cold' | 'bio' | 'stage' | 'water' | 'space' | 'farm' | 'care' | 'recycle';
export const GROUPS: Record<StockGroup, { label: string; leader: StockCode; color: string }> = {
  power:   { label: '분산 전력',    leader: 'G01', color: '#E08E0B' },
  storage: { label: '열에너지 저장', leader: 'G02', color: '#7B61FF' },
  cold:    { label: '저온 물류',    leader: 'G03', color: '#00A88F' },
  bio:     { label: '배양 소재',    leader: 'G04', color: '#1F9D5C' },
  stage:   { label: '체험형 공연',  leader: 'G05', color: '#E8557A' },
  water:   { label: '물 재이용',    leader: 'G06', color: '#3B8DD9' },
  /* 아래 네 업종도 2026-11부터 사건(아크)이 붙었습니다. */
  space:   { label: '위성 통신',    leader: 'G31', color: '#5B7FFF' },
  farm:    { label: '스마트 농업',  leader: 'G36', color: '#6FA82B' },
  care:    { label: '돌봄 로봇',    leader: 'G41', color: '#D9743B' },
  recycle: { label: '금속 재활용',  leader: 'G46', color: '#8A8F98' }
};
export interface StockDef { code: StockCode; name: string; sector: string; group: StockGroup; start: number; maxMoveBp: number; linkBeta: number; desc: string }
export const STOCKS: StockDef[] = [
  { code: 'G01', name: '누바칸 미세전력', sector: '분산 전력 장치', group: 'power', start: 12400, maxMoveBp: 90, linkBeta: 1, desc: '소형 발전 모듈 판매. 시험 결과, 납품 승인, 부품 수급에 민감합니다.' },
  { code: 'G02', name: '세모륨 열전지',   sector: '열에너지 저장', group: 'storage', start: 18600, maxMoveBp: 150, linkBeta: 1, desc: '신형 열전지 개발. 실증 성능과 양산 수율에 따라 기대가 크게 바뀝니다.' },
  { code: 'G03', name: '도르넴 저온운송', sector: '저온 물류', group: 'cold', start: 8700, maxMoveBp: 60, linkBeta: 1, desc: '정기 운송 계약이 주 매출원. 폭염에 수요가 늘고 전력비에 마진이 줍니다.' },
  { code: 'G04', name: '아보튠 배양소재', sector: '배양 소재', group: 'bio', start: 14800, maxMoveBp: 120, linkBeta: 1, desc: '배양 원료 납품. 품질 검사, 납품 규격, 시설 가동 여부에 민감합니다.' },
  { code: 'G05', name: '피노벡 소리극장', sector: '체험형 공연', group: 'stage', start: 6300, maxMoveBp: 100, linkBeta: 1, desc: '소규모 음향 공연장 운영. 예약률, 행사 일정, 공연 취소가 매출을 좌우합니다.' },
  { code: 'G06', name: '타르멜 물순환',   sector: '물 재이용 설비', group: 'water', start: 10200, maxMoveBp: 50, linkBeta: 1, desc: '설비 관리 계약 비중이 높습니다. 장기 계약과 가뭄 발주에 반응합니다.' },
  { code: 'G07', name: '라벤토 소형터빈', sector: '소형 풍력 발전기', group: 'power', start: 7200, maxMoveBp: 110, linkBeta: 0.5, desc: '건물 옥상용 소형 발전기를 만듭니다. 분산 전력 업종 소식에 함께 움직입니다.' },
  { code: 'G08', name: '키오닉 전력망',   sector: '전력 거래 소프트웨어', group: 'power', start: 15600, maxMoveBp: 80, linkBeta: 0.35, desc: '소형 발전 전력을 사고파는 중개 프로그램. 업종 소식에는 덜 민감합니다.' },
  { code: 'G09', name: '바르셀 발전부품', sector: '발전 모듈 부품', group: 'power', start: 4850, maxMoveBp: 120, linkBeta: 0.6, desc: '발전 모듈용 부품 공급사. 대형 고객 납품이 늘면 함께 웃습니다.' },
  { code: 'G10', name: '오르메 열교환',   sector: '열교환기 제조', group: 'storage', start: 9300, maxMoveBp: 90, linkBeta: 0.45, desc: '열을 옮기는 장치를 만듭니다. 열에너지 저장 시장이 커지면 수요가 늡니다.' },
  { code: 'G11', name: '피레온 단열소재', sector: '고온 단열재', group: 'storage', start: 6100, maxMoveBp: 130, linkBeta: 0.55, desc: '고온을 견디는 단열재 공급. 열전지 양산 소식에 민감합니다.' },
  { code: 'G12', name: '카보린 셀테크',   sector: '차세대 전지 연구', group: 'storage', start: 23400, maxMoveBp: 170, linkBeta: 0.6, desc: '아직 매출이 거의 없는 연구 기업. 기대만으로 움직여 변동이 큽니다.' },
  { code: 'G13', name: '하일로 냉동창고', sector: '냉동 창고 임대', group: 'cold', start: 11800, maxMoveBp: 60, linkBeta: 0.5, desc: '냉동 창고를 빌려줍니다. 물동량이 늘면 가동률이 오릅니다.' },
  { code: 'G14', name: '멘토라 택배',     sector: '일반 택배', group: 'cold', start: 5400, maxMoveBp: 70, linkBeta: 0.35, desc: '상온 택배가 주력. 저온 물류 소식에는 일부만 반응합니다.' },
  { code: 'G15', name: '시노바 냉장트럭', sector: '냉장 트럭 제조', group: 'cold', start: 13200, maxMoveBp: 100, linkBeta: 0.4, desc: '냉장 트럭을 만들어 팝니다. 운송사들이 차량을 늘리면 주문이 늡니다.' },
  { code: 'G16', name: '루펠 배양액',     sector: '세포 배양액', group: 'bio', start: 21500, maxMoveBp: 130, linkBeta: 0.5, desc: '세포를 키우는 배양액을 만듭니다. 배양 소재 업종과 고객이 겹칩니다.' },
  { code: 'G17', name: '노르딘 검사',     sector: '품질 검사 대행', group: 'bio', start: 8100, maxMoveBp: 90, linkBeta: 0.4, desc: '식품·소재 품질 검사를 대신 해 줍니다. 규제가 강해지면 일이 늡니다.' },
  { code: 'G18', name: '에테온 단백',     sector: '배양 단백질 식품', group: 'bio', start: 16700, maxMoveBp: 150, linkBeta: 0.55, desc: '배양 단백질로 식품을 만듭니다. 원료 소식과 소비자 반응에 크게 흔들립니다.' },
  { code: 'G19', name: '모비아 티켓',     sector: '공연 예매 플랫폼', group: 'stage', start: 9900, maxMoveBp: 110, linkBeta: 0.5, desc: '공연 예매 수수료로 법니다. 공연 흥행이 곧 거래액입니다.' },
  { code: 'G20', name: '큐라 음향대여',   sector: '공연 장비 대여', group: 'stage', start: 7600, maxMoveBp: 90, linkBeta: 0.4, desc: '음향·조명 장비를 빌려줍니다. 공연 횟수에 따라 매출이 움직입니다.' },
  { code: 'G21', name: '소나레 기획',     sector: '공연 기획사', group: 'stage', start: 12300, maxMoveBp: 140, linkBeta: 0.55, desc: '공연을 기획하고 출연진을 관리합니다. 흥행 여부에 실적이 크게 갈립니다.' },
  { code: 'G22', name: '아쿠론 필터',     sector: '정수 필터', group: 'water', start: 6800, maxMoveBp: 60, linkBeta: 0.5, desc: '정수 설비용 필터를 교체 판매합니다. 설비가 늘면 꾸준히 팔립니다.' },
  { code: 'G23', name: '테라젠 배관',     sector: '배관 시공', group: 'water', start: 4300, maxMoveBp: 70, linkBeta: 0.4, desc: '물 재이용 설비 배관 공사. 발주가 늘면 공사가 늡니다.' },
  { code: 'G24', name: '리베아 수처리',   sector: '하수 처리 운영', group: 'water', start: 14100, maxMoveBp: 50, linkBeta: 0.45, desc: '지자체 하수 처리장을 장기 계약으로 운영합니다. 대표적인 방어주입니다.' },
  { code: 'G25', name: '헤르반 전력계측', sector: '분산 전력 계량', group: 'power', start: 10800, maxMoveBp: 85, linkBeta: 0.45, desc: '건물과 소형 발전소에 양방향 전력 계량기를 공급합니다. 분산 발전망이 늘면 설치 수요가 커집니다.' },
  { code: 'G26', name: '벨오스 축열제어', sector: '축열 설비 제어', group: 'storage', start: 13200, maxMoveBp: 115, linkBeta: 0.55, desc: '축열 설비의 충전과 방전을 제어하는 장치를 만듭니다. 대형 축열 시설의 준공 일정에 민감합니다.' },
  { code: 'G27', name: '이르벤 온도센서', sector: '저온 운송 센서', group: 'cold', start: 5900, maxMoveBp: 75, linkBeta: 0.4, desc: '냉장 화물의 온도 기록기를 공급합니다. 신선식품 운송량이 늘거나 온도 관리 기준이 강화되면 수요가 커집니다.' },
  { code: 'G28', name: '메로칸 배양장비', sector: '배양 공정 장비', group: 'bio', start: 17800, maxMoveBp: 125, linkBeta: 0.5, desc: '배양 탱크와 공정 제어기를 만듭니다. 배양 소재 업체들이 생산 시설을 늘릴 때 수주가 증가합니다.' },
  { code: 'G29', name: '로테빈 무대제작', sector: '조립식 공연 무대', group: 'stage', start: 8200, maxMoveBp: 105, linkBeta: 0.45, desc: '공연장과 축제에 조립식 무대를 공급합니다. 야외 행사 일정이 늘면 장비 대여가 늘어납니다.' },
  { code: 'G31', name: '레오링크 위성망',   sector: '저궤도 위성 통신', group: 'space', start: 21700, maxMoveBp: 130, linkBeta: 1, desc: '저궤도 위성으로 통신망을 운영합니다. 위성 수가 늘면 쓸 수 있는 지역이 넓어집니다.' },
  { code: 'G32', name: '아스트라 지상국',   sector: '위성 지상국 장비', group: 'space', start: 9400, maxMoveBp: 95, linkBeta: 0.55, desc: '위성과 통신하는 지상국 장비를 짓습니다. 위성망이 커지면 지상국도 늘어야 합니다.' },
  { code: 'G33', name: '페리온 안테나',     sector: '위상배열 안테나', group: 'space', start: 7200, maxMoveBp: 85, linkBeta: 0.5, desc: '움직이는 차량과 선박에 다는 납작한 안테나를 만듭니다.' },
  { code: 'G34', name: '하람 궤도추적',     sector: '궤도 추적 소프트웨어', group: 'space', start: 5600, maxMoveBp: 70, linkBeta: 0.45, desc: '위성 궤도를 계산하고 충돌을 피하게 하는 소프트웨어를 공급합니다.' },
  { code: 'G35', name: '미르반 발사지원',   sector: '발사 지상 설비', group: 'space', start: 13900, maxMoveBp: 110, linkBeta: 0.5, desc: '발사체를 세우고 연료를 넣는 지상 설비를 운영합니다. 발사 일정에 실적이 몰립니다.' },
  { code: 'G36', name: '그로벤 수직농장',   sector: '실내 수직 농장', group: 'farm', start: 8800, maxMoveBp: 100, linkBeta: 1, desc: '건물 안에서 층층이 작물을 기릅니다. 전기값과 수확량에 수익이 갈립니다.' },
  { code: 'G37', name: '하벤 양액제어',     sector: '양액 공급 제어', group: 'farm', start: 6300, maxMoveBp: 75, linkBeta: 0.5, desc: '작물에 주는 영양액의 농도를 자동으로 맞추는 장치를 만듭니다.' },
  { code: 'G38', name: '솔루마 생장조명',   sector: '식물 생장 조명', group: 'farm', start: 4900, maxMoveBp: 80, linkBeta: 0.55, desc: '작물이 잘 자라는 파장의 조명을 공급합니다. 농장이 늘면 함께 늘어납니다.' },
  { code: 'G39', name: '테르미 토양센서',   sector: '토양 수분 센서', group: 'farm', start: 3800, maxMoveBp: 65, linkBeta: 0.4, desc: '흙의 수분과 양분을 재는 센서를 밭과 농장에 공급합니다.' },
  { code: 'G40', name: '카로스 수확로봇',   sector: '수확 자동화 로봇', group: 'farm', start: 15200, maxMoveBp: 120, linkBeta: 0.55, desc: '열매를 알아보고 따는 로봇을 만듭니다. 일손이 부족할수록 수요가 커집니다.' },
  { code: 'G41', name: '케어민 보행보조',   sector: '보행 보조 로봇', group: 'care', start: 16400, maxMoveBp: 115, linkBeta: 1, desc: '걷기 힘든 사람을 돕는 착용형 로봇을 만듭니다. 요양 시설 도입이 실적을 좌우합니다.' },
  { code: 'G42', name: '노바린 이송로봇',   sector: '시설 내 이송 로봇', group: 'care', start: 10300, maxMoveBp: 90, linkBeta: 0.5, desc: '병원과 요양원 안에서 물품을 옮기는 로봇을 공급합니다.' },
  { code: 'G43', name: '셀리안 생체신호',   sector: '생체신호 측정 장비', group: 'care', start: 7700, maxMoveBp: 85, linkBeta: 0.5, desc: '맥박과 호흡을 멀리서 재는 장비를 만듭니다. 야간 관찰에 많이 씁니다.' },
  { code: 'G44', name: '포르테 재활기기',   sector: '재활 운동 기기', group: 'care', start: 5400, maxMoveBp: 70, linkBeta: 0.45, desc: '재활 운동을 돕는 기기를 병원에 납품합니다. 교체 주기가 꾸준합니다.' },
  { code: 'G45', name: '하늘솔 돌봄연계',   sector: '돌봄 연계 서비스', group: 'care', start: 11800, maxMoveBp: 75, linkBeta: 0.4, desc: '돌봄 인력과 가정을 이어 주는 서비스를 운영합니다. 계약 수가 실적입니다.' },
  { code: 'G46', name: '리메탈 정련',       sector: '폐금속 정련', group: 'recycle', start: 18600, maxMoveBp: 105, linkBeta: 1, desc: '버려진 금속을 녹여 다시 쓸 수 있게 만듭니다. 금속 시세에 실적이 크게 흔들립니다.' },
  { code: 'G47', name: '파우르 분쇄설비',   sector: '폐기물 분쇄 설비', group: 'recycle', start: 6700, maxMoveBp: 80, linkBeta: 0.5, desc: '폐기물을 잘게 부수는 설비를 만듭니다. 재활용 공장이 늘면 함께 늘어납니다.' },
  { code: 'G48', name: '엔베르 선별기',     sector: '금속 자동 선별', group: 'recycle', start: 9100, maxMoveBp: 90, linkBeta: 0.55, desc: '섞인 금속을 종류별로 자동으로 가려냅니다. 선별이 정확할수록 값을 더 받습니다.' },
  { code: 'G49', name: '크로마 합금회수',   sector: '희귀 합금 회수', group: 'recycle', start: 24300, maxMoveBp: 140, linkBeta: 0.6, desc: '적게 섞인 귀한 금속을 뽑아냅니다. 회수율이 조금만 올라도 수익이 크게 바뀝니다.' },
  { code: 'G50', name: '지온테크 폐배터리', sector: '폐배터리 재활용', group: 'recycle', start: 14700, maxMoveBp: 125, linkBeta: 0.55, desc: '다 쓴 배터리에서 금속을 회수합니다. 배터리 폐기량이 늘면 물량이 늘어납니다.' },
  { code: 'G30', name: '바노렐 수질계측', sector: '재이용수 수질 검사', group: 'water', start: 9700, maxMoveBp: 55, linkBeta: 0.45, desc: '재이용수의 탁도와 오염도를 측정하는 장비를 공급합니다. 처리 시설의 정기 검사와 신규 발주에 영향을 받습니다.' }
];
/* ---------- 기업 정보(가상) ----------
   shares: 발행 주식 수(주), netIncome: 지난해 순이익(억 원, 적자면 음수), dps: 지난해 주당 배당금(원).
   모두 지어낸 숫자입니다. 시작 가격 기준 PER이 업종 성격(성장주는 높고, 방어주는 낮음)에 맞게 정했습니다. */
export interface Fundamentals { shares: number; netIncome: number; dps: number }
export const FUNDAMENTALS: Record<StockCode, Fundamentals> = {
  G01: { shares: 40_000_000, netIncome: 310, dps: 0 },   G02: { shares: 30_000_000, netIncome: -120, dps: 0 },
  G03: { shares: 50_000_000, netIncome: 290, dps: 0 },   G04: { shares: 25_000_000, netIncome: 148, dps: 0 },
  G05: { shares: 35_000_000, netIncome: 98, dps: 0 },    G06: { shares: 42_000_000, netIncome: 476, dps: 350 },
  G07: { shares: 18_000_000, netIncome: 72, dps: 0 },    G08: { shares: 15_000_000, netIncome: 117, dps: 200 },
  G09: { shares: 22_000_000, netIncome: 89, dps: 0 },    G10: { shares: 16_000_000, netIncome: 93, dps: 0 },
  G11: { shares: 14_000_000, netIncome: 31, dps: 0 },    G12: { shares: 12_000_000, netIncome: -85, dps: 0 },
  G13: { shares: 20_000_000, netIncome: 197, dps: 300 }, G14: { shares: 30_000_000, netIncome: 147, dps: 150 },
  G15: { shares: 13_000_000, netIncome: 114, dps: 0 },   G16: { shares: 11_000_000, netIncome: 79, dps: 0 },
  G17: { shares: 17_000_000, netIncome: 92, dps: 0 },    G18: { shares: 15_000_000, netIncome: 50, dps: 0 },
  G19: { shares: 21_000_000, netIncome: 104, dps: 0 },   G20: { shares: 12_000_000, netIncome: 70, dps: 0 },
  G21: { shares: 10_000_000, netIncome: 41, dps: 0 },    G22: { shares: 19_000_000, netIncome: 108, dps: 180 },
  G23: { shares: 26_000_000, netIncome: 86, dps: 0 },    G24: { shares: 28_000_000, netIncome: 395, dps: 450 },
  G31: { shares: 24_000_000, netIncome: -140, dps: 0 },  G32: { shares: 18_000_000, netIncome: 77, dps: 0 },
  G33: { shares: 22_000_000, netIncome: 61, dps: 0 },    G34: { shares: 15_000_000, netIncome: 44, dps: 0 },
  G35: { shares: 13_000_000, netIncome: 119, dps: 200 }, G36: { shares: 20_000_000, netIncome: -62, dps: 0 },
  G37: { shares: 17_000_000, netIncome: 58, dps: 0 },    G38: { shares: 25_000_000, netIncome: 71, dps: 90 },
  G39: { shares: 29_000_000, netIncome: 48, dps: 60 },   G40: { shares: 12_000_000, netIncome: 96, dps: 0 },
  G41: { shares: 14_000_000, netIncome: 88, dps: 0 },    G42: { shares: 19_000_000, netIncome: 93, dps: 0 },
  G43: { shares: 21_000_000, netIncome: 74, dps: 0 },    G44: { shares: 27_000_000, netIncome: 112, dps: 150 },
  G45: { shares: 16_000_000, netIncome: 168, dps: 260 }, G46: { shares: 11_000_000, netIncome: 233, dps: 380 },
  G47: { shares: 23_000_000, netIncome: 69, dps: 0 },    G48: { shares: 18_000_000, netIncome: 101, dps: 0 },
  G49: { shares: 9_000_000, netIncome: 187, dps: 0 },    G50: { shares: 26_000_000, netIncome: 124, dps: 0 },
  G25: { shares: 17_000_000, netIncome: 98, dps: 0 },    G26: { shares: 19_000_000, netIncome: 103, dps: 0 },
  G27: { shares: 21_000_000, netIncome: 90, dps: 120 },  G28: { shares: 16_000_000, netIncome: 102, dps: 0 },
  G29: { shares: 14_000_000, netIncome: 66, dps: 0 },    G30: { shares: 23_000_000, netIncome: 174, dps: 240 }
};
export const fundOf = (code: StockCode): Fundamentals => FUNDAMENTALS[code] ?? { shares: 10_000_000, netIncome: 0, dps: 0 };
/** 시가총액(원) = 주가 × 발행 주식 수 */
export const marketCapWon = (code: StockCode, price: number) => price * fundOf(code).shares;
/** PER(배) = 시가총액 ÷ 순이익. 적자면 null(계산하지 않음). 소수 첫째 자리 */
export function perOf(code: StockCode, price: number): number | null {
  const ni = fundOf(code).netIncome;
  if (ni <= 0) return null;
  return Math.round(marketCapWon(code, price) / (ni * 100_000_000) * 10) / 10;
}
/** 배당수익률(bp) = 주당 배당금 ÷ 주가 */
export const dividendYieldBp = (code: StockCode, price: number) => Math.round(fundOf(code).dps * 10000 / price);
/** 배당 기준일 라운드(이 라운드 장 마감 때 가진 주식에 배당). 다음 라운드 시작 때 배당금 입금과 배당락. */
/* ---------- 변동성 완화장치(VI) ----------
   실제 정적 VI는 기준가격 대비 ±10%에서 2분 단일가 매매로 바뀝니다.
   이 게임은 한 라운드가 짧아서, 시가 대비 ±10%에서 그 종목만 VI_SECONDS초 동안 거래를 멈춥니다. */
export const VI_BP = 1000;
export const VI_SECONDS = 15;
/** 시가 대비 등락이 VI 기준을 넘었는지. 넘었으면 방향(1 위, -1 아래), 아니면 0 */
export function viDirection(open: number, price: number): 1 | -1 | 0 {
  if (open <= 0) return 0;
  const bp = Math.round((price - open) * 10000 / open);
  return bp >= VI_BP ? 1 : bp <= -VI_BP ? -1 : 0;
}

export const dividendRound = (rounds: number) => Math.ceil(rounds * 0.6);
/** 배당락 뒤 시가: 배당금만큼 낮춰 10원 단위로 반올림, 최저 100원 */
export const exDividendPrice = (price: number, dps: number) => Math.max(100, Math.round((price - dps) / 10) * 10);
/** 이번 판 종목으로 만든 시가총액 가중 지수. 판 시작 = 1000 */
/** 억 원 단위 금액을 "4,960억 원", "1조 2,340억 원"처럼 */
export function formatEok(won: number): string {
  const eok = Math.round(won / 100_000_000);
  const jo = Math.floor(Math.abs(eok) / 10000), rest = Math.abs(eok) % 10000;
  const sign = eok < 0 ? '−' : '';
  if (!jo) return `${sign}${rest.toLocaleString('ko-KR')}억 원`;
  return `${sign}${jo.toLocaleString('ko-KR')}조${rest ? ` ${rest.toLocaleString('ko-KR')}억` : ''} 원`;
}

/* ---------- 참가자 이름 ---------- */
export const LABEL_MAX = 12;
/** 이름 다듬기: 앞뒤 공백과 연속 공백을 정리하고, 보이지 않는 글자와 꺾쇠를 막습니다. 쓸 수 없으면 null */
export function cleanLabel(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  /* 제어 문자와 줄바꿈, 꺾쇠(<>)를 빼고 공백을 한 칸으로 */
  const t = raw.replace(/[\u0000-\u001F\u007F<>]/g, ' ').replace(/\s+/g, ' ').trim();
  if (t.length === 0 || t.length > LABEL_MAX) return null;
  return t;
}

/** 예전 저장 데이터(종목 6개 시절)를 복구할 때 쓰는 기본 종목 */
export const LEGACY_CODES: StockCode[] = ['G01', 'G02', 'G03', 'G04', 'G05', 'G06'];
export const stockOf = (code: StockCode) => STOCKS.find(s => s.code === code)!;

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
export const feeOf = (gross: number) => Math.ceil(gross * FEE_BP / 10000);
/** 증권거래세(팔 때만). 원 미만은 버립니다 */
export const taxOf = (gross: number) => Math.floor(gross * TAX_BP / 10000);
/** 이 거래에서 빠져나가는 비용 합계: 수수료 + (매도면) 거래세 */
export const chargeOf = (side: Side, gross: number) => feeOf(gross) + (side === 'sell' ? taxOf(gross) : 0);
export const upperLimit = (P: number) => Math.floor(P * 12000 / 100000) * 10;
export const lowerLimit = (P: number) => Math.max(100, Math.ceil(P * 8000 / 100000) * 10);

export function formatPct(bp: number, digits = 1): string {
  const v = Math.abs(bp) / 100;
  return `${bp > 0 ? '+' : bp < 0 ? '−' : ''}${v.toFixed(digits)}%`;
}

/** 원시 수익률 = 사건 합계 + 시장 + 종목. 제한 → 10원 반올림 → 상·하한가 순으로 적용합니다. */
export function computeClose(round: number, P: number, events: EventImpact[], marketBp: number, stockBp: number): PriceBreakdown {
  const eventBp = events.reduce((a, e) => a + e.bp, 0);
  const rawBp = eventBp + marketBp + stockBp;
  const cappedBp = clamp(rawBp, -MAX_RETURN_BP, MAX_RETURN_BP);
  const roundedPrice = Math.floor((P * (10000 + cappedBp) + 50000) / 100000) * 10;
  const hi = upperLimit(P), lo = lowerLimit(P);
  const closePrice = clamp(roundedPrice, lo, hi);
  const limit: PriceBreakdown['limit'] = roundedPrice > hi || (closePrice === hi && cappedBp >= MAX_RETURN_BP) ? 'upper'
    : roundedPrice < lo || (closePrice === lo && cappedBp <= -MAX_RETURN_BP) ? 'lower' : null;
  const changeBp = Math.round((closePrice - P) * 10000 / P);
  const main = events.slice().sort((a, b) => Math.abs(b.bp) - Math.abs(a.bp))[0];
  return {
    round, basePrice: P, closePrice, changeBp,
    summary: `${formatPct(changeBp)} · ${main ? main.label : '시장·종목 변동'}`,
    events, eventBp, marketBp, stockBp, rawBp, cappedBp, capped: cappedBp !== rawBp,
    roundedPrice, roundingWon: roundedPrice - Math.round(P * (10000 + cappedBp) / 10000),
    limit, upperLimit: hi, lowerLimit: lo
  };
}

export interface OrderContext { cash: number; holdings: Partial<Record<StockCode, Holding>>; orders: Partial<Record<StockCode, Order>> }
export type OrderCheck =
  | { ok: true; price: number; slipBp: number; gross: number; fee: number; reserve: number }
  | { ok: false; reason: string };
/** limit: 지정가(이 가격에 체결, 슬리피지 없음). replace: 같은 종목에 걸어 둔 예약을 대신하는 주문이면 true(그 예약금·수량은 돌려받았다고 봄). */
export interface OrderOpts { limit?: number; replace?: boolean; book?: QuoteBook }

/* ---------- 호가창(가상 시장) ----------
   주문의 상대방은 가상 시장입니다. 지금 시세 위로 팔려는 주문(매도 호가), 아래로 사려는 주문(매수 호가)이
   10원 간격으로 쌓여 있다고 보고, 시장가 주문은 가장 좋은 호가부터 차례로 사거나 팝니다.
   - 최우선 매도 호가 = 지금 시세, 최우선 매수 호가 = 지금 시세 − 10원(호가 한 칸 차이, 스프레드)
   - 단계마다 걸린 금액은 평균 150만 원(대표 종목은 1.5배)이고, 멀어질수록 조금씩 늘어납니다.
   - 수량은 종목·라운드·초·단계로 정해지는 결정적 값이라 모두에게 같은 호가창이 보입니다(시드와 무관, 결말 없음).
   - 가격 제한폭 밖에는 호가가 없습니다. 하한가에서는 사려는 주문이 없어 시장가로 팔 수 없습니다.
   - 참가자 주문은 호가창과 시세를 바꾸지 않습니다(1~2명 판에서 가격을 움직여 이득을 보는 길을 막음).
   실제 한국 시장의 호가 단위는 가격대마다 다르지만, 이 게임은 모든 가격에서 10원으로 단순화했습니다. */
export const TICK_WON = 10;
export const BOOK_DEPTH = 10;
export const BOOK_SHOW = 5;
export const LEVEL_WON = 1_500_000;
export interface BookLevel { price: number; qty: number }
/** asks: 최우선 매도 호가부터 위로, bids: 최우선 매수 호가부터 아래로 */
export interface QuoteBook { asks: BookLevel[]; bids: BookLevel[] }
function hash01(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10000) / 10000;
}
/** price: 지금 시세, open: 이번 라운드 기준가(가격 제한폭 계산용), k: 주문 시간 시작부터 지난 초 */
export function quoteBook(code: StockCode, price: number, open: number, round: number, k: number): QuoteBook {
  const hi = upperLimit(open), lo = lowerLimit(open);
  const depth = LEVEL_WON * (stockOf(code)?.linkBeta === 1 ? 1.5 : 1);
  const level = (p: number, side: string, i: number) => ({ price: p, qty: Math.max(1, Math.round(depth * (0.6 + 0.8 * hash01(`${code}:${round}:${k}:${side}:${i}`)) * (1 + 0.25 * i) / p)) });
  const asks: BookLevel[] = [], bids: BookLevel[] = [];
  for (let i = 0; i < BOOK_DEPTH; i++) {
    const pa = price + i * TICK_WON, pb = price - (i + 1) * TICK_WON;
    if (pa <= hi) asks.push(level(pa, 'a', i));
    if (pb >= lo && pb >= TICK_WON) bids.push(level(pb, 'b', i));
  }
  return { asks, bids };
}
/** 시장가 체결: 가장 좋은 호가부터 차례로 채웁니다. 호가창보다 많으면 마지막 단계 가격으로 채웁니다.
    price는 평균 체결가(매수 올림, 매도 내림), slipBp는 최우선 호가와의 차이. 반대편 호가가 없으면 null(상한가 매수·하한가 매도). */
export function marketFill(book: QuoteBook, side: Side, qty: number): { price: number; slipBp: number; best: number; levels: number } | null {
  const lv = side === 'buy' ? book.asks : book.bids;
  if (!lv.length) return null;
  const best = lv[0].price;
  if (qty < 1) return { price: best, slipBp: 0, best, levels: 0 };
  let left = qty, total = 0, used = 0;
  for (const l of lv) { if (left <= 0) break; const q = Math.min(left, l.qty); total += q * l.price; left -= q; used++; }
  if (left > 0) total += left * lv[lv.length - 1].price;
  const price = side === 'buy' ? Math.ceil(total / qty) : Math.floor(total / qty);
  return { price, slipBp: Math.round(Math.abs(price - best) * 10000 / best), best, levels: used };
}
const reservedExcept = (ctx: OrderContext, code: StockCode | null) => Object.values(ctx.orders).reduce((a, o) => a + (o && o.code !== code ? o.reserve : 0), 0);

/** 주문 검증. ref는 지금 가격(장중 시세)입니다.
    - 시장가: 호가창(opts.book, 없으면 ref로 만듦)을 따라 바로 체결합니다. 걸어 둔 예약의 예약금·수량은 쓸 수 없습니다.
    - 지정가(opts.limit): 그 가격에 체결될 때를 기준으로 예약금을 잡습니다. 같은 종목 예약은 새 예약으로 바뀝니다. */
export function checkOrder(ctx: OrderContext, code: StockCode, side: Side, qty: number, ref: number, opts: OrderOpts = {}): OrderCheck {
  if (!Number.isSafeInteger(qty) || qty < 1) return { ok: false, reason: '수량은 1주 이상 정수여야 합니다' };
  const replace = opts.replace ?? opts.limit !== undefined;
  const same = ctx.orders[code];
  const lockedSell = !replace && same?.side === 'sell' ? same.qty : 0;
  if (side === 'sell' && qty > (ctx.holdings[code]?.qty ?? 0) - lockedSell) return { ok: false, reason: lockedSell ? '매도 예약에 묶인 수량을 빼면 보유 수량이 모자랍니다' : '보유 수량을 넘었습니다' };
  const unit = opts.limit ?? ref;
  if (side === 'buy' && unit * qty > ctx.cash) return { ok: false, reason: '주문 가능 현금이 부족합니다' };   // 큰 수 곱셈 전에 먼저 거릅니다
  let price: number, slipBp = 0;
  if (opts.limit !== undefined) price = opts.limit;
  else {
    const f = marketFill(opts.book ?? quoteBook(code, ref, ref, 0, 0), side, qty);
    if (!f) return { ok: false, reason: side === 'sell' ? '사려는 주문이 없어 지금은 시장가로 팔 수 없습니다(하한가)' : '팔려는 주문이 없어 지금은 시장가로 살 수 없습니다' };
    price = f.price; slipBp = f.slipBp;
  }
  const gross = price * qty, fee = chargeOf(side, gross);
  if (side === 'buy') {
    const reserve = gross + fee;
    if (reservedExcept(ctx, replace ? code : null) + reserve > ctx.cash) return { ok: false, reason: '주문 가능 현금이 부족합니다' };
    return { ok: true, price, slipBp, gross, fee, reserve };
  }
  return { ok: true, price, slipBp, gross, fee, reserve: 0 };
}
/** 슬리피지와 수수료까지 넣어 살 수 있는 최대 수량. 지정가면 그 가격 기준 */
export function maxBuyQty(ctx: OrderContext, code: StockCode, ref: number, opts: OrderOpts = {}): number {
  const replace = opts.replace ?? opts.limit !== undefined;
  const av = ctx.cash - reservedExcept(ctx, replace ? code : null);
  const unit = opts.limit ?? ref;
  if (av <= 0 || unit <= 0) return 0;
  const book = opts.book ?? quoteBook(code, ref, ref, 0, 0);
  const cost = (n: number) => { const p = opts.limit ?? marketFill(book, 'buy', n)?.price; if (p === undefined) return Infinity; const g = p * n; return g + feeOf(g); };
  let lo = 0, hi = Math.floor(av / unit);
  while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (cost(mid) <= av) lo = mid; else hi = mid - 1; }
  return lo;
}

/* ---------- 장중 시세 ----------
   주문 시간 동안 1초마다 가격이 움직입니다. 움직임은 시장 분위기(marketBp)와 종목 변동(stockBp), 장중 속보 반응을 합친
   목표까지 가는 무작위 경로(브라운 다리)입니다. 사건의 최종 결과는 경로에 넣지 않고 마감 때 한 번에 반영하므로,
   장중 시세로 결말을 미리 알 수 없습니다. 같은 시드면 같은 경로가 나옵니다. */
/** 장중 속보가 뜰 때 헤드라인 방향으로 먼저 튀는 폭(대표 종목 기준, bp = 3.5%). 같은 업종 종목은 linkBeta배.
    종목 하루 변동폭(maxMoveBp 50~150bp)보다 크게 잡아야 속보가 떴다는 걸 화면에서 알아볼 수 있습니다. */
export const REACT_BP = 350;
/** 장중 흔들림 크기: 종목 변동폭(maxMoveBp)의 이 배수가 한 라운드 표준편차 */
export const WIGGLE_X = 1.2;
/** 0~1 균등 난수 함수 */
export type Rnd = () => number;
const gauss = (rnd: Rnd) => (rnd() + rnd() + rnd() + rnd() - 2) * Math.sqrt(3);   // 평균 0, 표준편차 1 근사
/** base에서 출발해 steps초 뒤 endBp(만분율)에 닿는 경로. jump가 있으면 그 초에 bp만큼 튑니다(속보 반응, endBp에 포함).
    가격은 10원 단위, base의 상·하한가 안. 길이 steps+1, 첫 값은 base. */
export function intradayPath(rnd: Rnd, base: number, endBp: number, steps: number, wiggleBp: number, jump?: { at: number; bp: number }): number[] {
  const n = Math.max(1, Math.floor(steps));
  const w: number[] = [0];
  const sd = wiggleBp / Math.sqrt(n);
  for (let k = 1; k <= n; k++) w.push(w[k - 1] + gauss(rnd) * sd);
  const jb = jump && jump.at >= 1 && jump.at <= n ? jump.bp : 0;
  const hi = upperLimit(base), lo = lowerLimit(base);
  const out: number[] = [];
  for (let k = 0; k <= n; k++) {
    const bridge = w[k] - (k / n) * w[n];
    const x = Math.round(bridge + (k / n) * (endBp - jb) + (jb && k >= jump!.at ? jb : 0));
    const p = k === 0 ? base : Math.round(base * (10000 + x) / 100000) * 10;
    out.push(Math.min(hi, Math.max(lo, p)));
  }
  return out;
}
