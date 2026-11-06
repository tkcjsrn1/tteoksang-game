/* 차트 연습실 콘텐츠. 예시 데이터, 문제, 정답, 해설을 나눠 관리합니다. 모두 가상 기업과 가상 체결 기록입니다. */
import { aggregate, type Trade } from '../../../shared/candles';

export const LESSONS = [
  { id: 'candle', no: 1, title: '봉 하나 읽기', goal: '시가, 고가, 저가, 종가와 꼬리를 읽습니다.', ready: true },
  { id: 'compare', no: 2, title: '봉 여러 개 비교하기', goal: '1분봉과 5분봉, 거래량, 5일 이동평균선을 봅니다.', ready: true },
  { id: 'news', no: 3, title: '뉴스와 주가 연결하기', goal: '계약이 성사됐는데 주가가 떨어진 이유를 찾습니다.', ready: true },
  { id: 'orders', no: 4, title: '주문 화면 읽기', goal: '호가, 시장가, 지정가, 체결, 수수료를 익힙니다.', ready: false },
  { id: 'earnings', no: 5, title: '기업 실적 읽기', goal: '매출과 영업이익, 영업이익률을 비교합니다.', ready: false },
  { id: 'risk', no: 6, title: '내 자산과 위험 읽기', goal: '평가손익과 집중·분산 투자를 계산합니다.', ready: false }
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
