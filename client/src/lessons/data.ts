/* 차트 연습실 콘텐츠. 예시 데이터, 문제, 정답, 해설을 나눠 관리합니다. 모두 가상 기업과 가상 체결 기록입니다. */
import { aggregate, type Trade } from '../../../shared/candles';

export const LESSONS = [
  { id: 'candle', no: 1, title: '봉 하나 읽기', goal: '시가, 고가, 저가, 종가와 꼬리를 읽습니다.', ready: true },
  { id: 'compare', no: 2, title: '봉 여러 개 비교하기', goal: '1분봉과 5분봉, 거래량, 5일 이동평균선을 봅니다.', ready: true },
  { id: 'news', no: 3, title: '뉴스와 주가 연결하기', goal: '계약이 성사됐는데 주가가 떨어진 이유를 찾습니다.', ready: true },
  { id: 'orders', no: 4, title: '주문 화면 읽기', goal: '호가, 시장가, 지정가, 슬리피지를 익힙니다.', ready: true },
  { id: 'earnings', no: 5, title: '기업 실적 읽기', goal: '매출과 영업이익, 영업이익률을 비교합니다.', ready: true },
  { id: 'risk', no: 6, title: '내 자산과 위험 읽기', goal: '평가손익과 업종 쏠림을 계산합니다.', ready: true }
];

/* ---------- 수업 1 ---------- */
export const candleExample = {
  company: '누바칸 미세전력',
  trades: [
    { minute: 0, price: 10000, qty: 120 },
    { minute: 1, price: 10400, qty: 80 },
    { minute: 2, price: 9800, qty: 150 },
    { minute: 3, price: 10200, qty: 90 }
  ] as Trade[]
};
export type CandlePart = 'open' | 'high' | 'low' | 'close' | 'body' | 'upper' | 'lower';
export const candleParts: Record<CandlePart, { term: string; meaning: string }> = {
  open: { term: '시가', meaning: '그날 첫 체결 가격입니다.' },
  close: { term: '종가', meaning: '그날 마지막 체결 가격입니다.' },
  high: { term: '고가', meaning: '그날 가장 높았던 체결 가격입니다.' },
  low: { term: '저가', meaning: '그날 가장 낮았던 체결 가격입니다.' },
  body: { term: '몸통', meaning: '시가와 종가 사이입니다. 종가가 시가보다 높으면 빨간 양봉, 낮으면 파란 음봉입니다.' },
  upper: { term: '윗꼬리', meaning: '몸통 위로 뻗은 선입니다. 장중에 고가까지 올랐다가 밀렸다는 뜻입니다.' },
  lower: { term: '아랫꼬리', meaning: '몸통 아래로 뻗은 선입니다. 장중에 저가까지 내렸다가 회복했다는 뜻입니다.' }
};
export const candleQuestion = {
  prompt: '이날 가장 낮았던 가격을 눌러보세요',
  answer: 'lower' as CandlePart,
  /** 저가 눌렀을 때 쓰는 끝점도 정답으로 칩니다. */
  alsoCorrect: ['low'] as CandlePart[],
  correct: '아랫꼬리 끝 · 저가 9,800원',
  explanation: '종가 10,200원이 시가 10,000원보다 높아 양봉입니다. 하지만 장중에는 시가 아래인 9,800원까지 내려갔습니다. 빨간 봉이라고 내내 오른 것은 아닙니다.',
  wrongHint: '가장 낮은 가격은 몸통이 아니라 봉의 맨 아래 끝에 있습니다. 강조된 아랫꼬리를 보세요.'
};

/* ---------- 수업 2 ---------- */
/* 같은 가상 체결 기록을 1분봉과 5분봉으로 묶어 봅니다. */
export const intradayTrades: Trade[] = [
  [0, 12400, 40], [0, 12450, 25], [1, 12500, 30], [1, 12430, 20], [2, 12380, 45], [2, 12420, 15], [3, 12470, 35], [4, 12520, 50], [4, 12490, 20],
  [5, 12460, 25], [5, 12400, 60], [6, 12350, 70], [6, 12390, 30], [7, 12330, 55], [8, 12370, 20], [8, 12410, 25], [9, 12440, 40],
  [10, 12480, 35], [11, 12550, 80], [11, 12600, 95], [12, 12580, 40], [13, 12620, 60], [13, 12590, 25], [14, 12640, 70]
].map(([minute, price, qty]) => ({ minute, price, qty }));
export const fiveMinute = () => aggregate(intradayTrades, 5);
export const oneMinute = () => aggregate(intradayTrades, 1);
export const dailyCloses = [12100, 12250, 12180, 12400, 12350, 12500, 12620, 12480, 12700, 12860, 12790, 12950];
export const compareQuestion = {
  prompt: '5분봉에서 거래량이 가장 많은 기간의 막대를 눌러보세요',
  answerStart: 10,
  correct: '10~14분 · 405주',
  explanation: '5분 동안 체결된 수량을 모두 더한 값이 거래량입니다. 가격이 오르는 구간에 수량까지 늘었다면 그 움직임에 참여한 매매가 많았다는 뜻입니다. 다만 거래량만으로 앞으로의 방향을 알 수는 없습니다.',
  wrongHint: '강조된 거래량 막대 중 가장 높은 것을 찾아보세요.'
};

/* ---------- 수업 3 ---------- */
export const newsCase = {
  company: '누바칸 미세전력',
  expectation: '시장 기대 1만 대',
  actual: '실제 계약 6천 대',
  chart: [
    { label: 'D-3', close: 9600 }, { label: 'D-2', close: 9800 }, { label: 'D-1', close: 10000 },
    { label: '공시일', close: 9540, base: 10000, headline: '누바칸, 공공 납품 6천 대 계약 체결' }
  ],
  breakdown: [
    { name: '기대에 못 미친 계약 규모', bp: -500, reason: '계약을 따냈지만 기대의 60%에 그침' },
    { name: '공통 시장 변동', bp: 30, reason: '그날 시장 전체의 움직임' },
    { name: '종목 변동', bp: 10, reason: '뉴스와 무관한 작은 움직임' }
  ]
};
export const newsQuestion = {
  prompt: '계약이 성사됐는데 누바칸은 왜 −4.60% 떨어졌을까요?',
  options: [
    { id: 'gap', label: '시장은 이미 1만 대를 기대했는데 6천 대에 그쳤다', correct: true, feedback: '맞습니다. 주가에는 기대가 먼저 들어가 있습니다. 좋은 소식이어도 기대보다 작으면 실망으로 내릴 수 있습니다.' },
    { id: 'fail', label: '계약이 취소되었다', correct: false, feedback: '계약은 성사되었습니다. 표의 실제 결과 칸을 다시 보세요.' },
    { id: 'fee', label: '수수료가 올라서 주가가 내렸다', correct: false, feedback: '수수료는 주가를 움직이지 않습니다. 시장 기대와 실제 결과의 차이를 보세요.' },
    { id: 'orders', label: '참가자들이 많이 팔았다', correct: false, feedback: '이 게임의 가격 산식에는 참가자 주문량이 들어가지 않습니다. 변동 근거를 다시 보세요.' }
  ],
  takeaway: '뉴스가 좋은지 나쁜지보다, 시장이 기대한 것과 얼마나 다른지가 가격을 움직입니다.'
};

/* ---------- 공통: 고르는 문제 ---------- */
export interface ChoiceQuestion { prompt: string; options: { id: string; label: string; correct: boolean; feedback: string }[]; takeaway: string }

/* ---------- 수업 4 ---------- */
/* 가상 호가창. 이 예시는 가격 한 칸(호가 단위)을 10원으로 둡니다. */
export const orderBook = {
  company: '누바칸 미세전력',
  asks: [{ price: 10050, qty: 300 }, { price: 10040, qty: 100 }, { price: 10030, qty: 150 }],   // 팔려는 주문(위가 비쌈)
  bids: [{ price: 10020, qty: 120 }, { price: 10010, qty: 200 }, { price: 10000, qty: 250 }],   // 사려는 주문
  buyQty: 400
};
/** 시장가 매수: 가장 싼 매도 호가부터 차례로 삽니다. */
export function marketBuy(asks: { price: number; qty: number }[], qty: number) {
  const fills: { price: number; qty: number }[] = [];
  let left = qty;
  for (const a of asks.slice().sort((x, y) => x.price - y.price)) {
    if (left <= 0) break;
    const q = Math.min(left, a.qty);
    fills.push({ price: a.price, qty: q });
    left -= q;
  }
  const filled = qty - left;
  const total = fills.reduce((x, f) => x + f.price * f.qty, 0);
  return { fills, filled, total, avg: filled ? total / filled : 0 };
}
export const orderQuestion: ChoiceQuestion = {
  prompt: '시장가로 400주를 사면 평균 몇 원에 사게 될까요?',
  options: [
    { id: 'best', label: '10,030원 (가장 싼 매도 호가)', correct: false, feedback: '10,030원에 팔려는 주문은 150주뿐입니다. 나머지는 더 비싼 호가에서 사야 합니다.' },
    { id: 'avg', label: '10,040원', correct: true, feedback: '맞습니다. 150주는 10,030원, 100주는 10,040원, 150주는 10,050원에 사서 평균 10,040원입니다.' },
    { id: 'top', label: '10,050원 (가장 비싼 매도 호가)', correct: false, feedback: '전부 10,050원에 사는 것은 아닙니다. 싼 호가부터 차례로 체결됩니다.' },
    { id: 'bid', label: '10,020원 (가장 비싼 매수 호가)', correct: false, feedback: '매수 호가는 사려는 사람들의 주문입니다. 내가 살 때는 매도 호가와 체결됩니다.' }
  ],
  takeaway: '화면에 보이는 가격보다 실제 평균 체결가가 불리해지는 것을 슬리피지라고 합니다. 지정가 주문으로 10,030원을 걸면 슬리피지는 없지만, 150주만 바로 사고 나머지는 기다려야 합니다.'
};

/* ---------- 수업 5 ---------- */
export const earningsCase = {
  companies: [
    { name: '하일로 냉동창고', revenue: 500, operatingProfit: 25 },   // 단위: 억 원
    { name: '루펠 배양액', revenue: 200, operatingProfit: 30 }
  ]
};
/** 영업이익률(%) = 영업이익 ÷ 매출 × 100 */
export const operatingMargin = (c: { revenue: number; operatingProfit: number }) => c.operatingProfit / c.revenue * 100;
export const earningsQuestion: ChoiceQuestion = {
  prompt: '1,000원어치를 팔았을 때 이익을 더 많이 남기는 회사는 어디일까요?',
  options: [
    { id: 'big', label: '하일로 냉동창고 (매출이 더 큼)', correct: false, feedback: '매출은 2.5배 크지만, 1,000원어치를 팔아 남기는 영업이익은 50원뿐입니다(영업이익률 5%).' },
    { id: 'margin', label: '루펠 배양액', correct: true, feedback: '맞습니다. 영업이익 30억 ÷ 매출 200억 = 15%. 1,000원어치를 팔면 150원을 남깁니다. 하일로는 5%입니다.' },
    { id: 'same', label: '둘이 비슷하다', correct: false, feedback: '영업이익 금액은 비슷해 보여도, 매출로 나누면 3배 차이가 납니다.' }
  ],
  takeaway: '매출이 크다고 많이 남기는 회사는 아닙니다. 영업이익률(영업이익 ÷ 매출)로 비교하세요. 그리고 주가는 숫자 자체보다 시장 기대와의 차이에 반응합니다.'
};

/* ---------- 수업 6 ---------- */
export const riskCase = {
  cash: 480_000,
  holdings: [
    { name: '누바칸 미세전력', sector: '분산 전력', qty: 300, avgCost: 12000, price: 12400 },
    { name: '라벤토 소형터빈', sector: '분산 전력', qty: 800, avgCost: 7500, price: 7200 },
    { name: '타르멜 물순환', sector: '물 재이용', qty: 200, avgCost: 10000, price: 10200 }
  ]
};
export function riskSummary(c: typeof riskCase) {
  const rows = c.holdings.map(h => ({ ...h, value: h.qty * h.price, pnl: h.qty * (h.price - h.avgCost) }));
  const total = c.cash + rows.reduce((a, r) => a + r.value, 0);
  const bySector = new Map<string, number>();
  rows.forEach(r => bySector.set(r.sector, (bySector.get(r.sector) ?? 0) + r.value));
  return { rows, total, pnl: rows.reduce((a, r) => a + r.pnl, 0), sectors: [...bySector].map(([sector, value]) => ({ sector, value, pct: value / total * 100 })) };
}
export const riskQuestion: ChoiceQuestion = {
  prompt: '종목은 3개입니다. 분산 전력 업종에 들어간 돈은 평가액의 몇 %일까요?',
  options: [
    { id: 'third', label: '약 33% (종목 3개 중 1개 업종이니까)', correct: false, feedback: '종목 수로 나누면 안 됩니다. 종목마다 들어간 돈(평가금액)이 다릅니다.' },
    { id: 'pct', label: '약 79%', correct: true, feedback: '맞습니다. 누바칸 372만 원 + 라벤토 576만 원 = 948만 원, 평가액 1,200만 원의 79%입니다.' },
    { id: 'half', label: '약 48%', correct: false, feedback: '라벤토 하나만 계산한 값입니다. 누바칸도 같은 업종입니다.' },
    { id: 'all', label: '100%', correct: false, feedback: '타르멜(물 재이용)과 현금도 있습니다.' }
  ],
  takeaway: '같은 업종 종목은 같은 뉴스에 함께 움직입니다(동조화). 종목이 여러 개여도 한 업종에 79%가 몰려 있으면 분산 효과가 작습니다. 평가손익은 아직 팔지 않은 손익이라 팔기 전까지 계속 바뀝니다.'
};
