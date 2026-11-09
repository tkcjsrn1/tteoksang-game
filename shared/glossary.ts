/* 주식 용어 사전. 게임 화면의 뉴스·해설·라벨에 나오는 낱말을 눌러 뜻을 보게 합니다.
   서버와 클라이언트가 함께 씁니다. 결말 정보는 없으므로 클라이언트에 들어가도 안전합니다.

   작성 규칙
   - short: 한 줄 뜻(40자 안팎). 툴팁 첫 줄과 퀴즈 보기로 씁니다.
   - body: 처음 보는 사람도 이해할 2~3문장. 예시를 넣습니다.
   - game: 이 게임에서는 어떻게 적용되는지. 실제 시장과 다르면 반드시 여기에 적습니다.
   - match: 본문에서 자동으로 링크할 낱말. 두 글자 이하 한글은 앞 글자가 한글이면 건너뜁니다('공고가'의 '고가' 방지).
   - skipAfter: 이 말 바로 뒤에 오면 링크하지 않습니다. 예: '계약 체결'은 주문 체결이 아닙니다.
   - 실제 제도의 숫자(세율·한도 등)는 바뀌므로 꼭 필요한 것만 쓰고, 바뀔 수 있다고 밝힙니다. */

export type TermCategory = 'basic' | 'order' | 'price' | 'asset' | 'news' | 'economy' | 'risk' | 'chart';

export const CATEGORIES: { id: TermCategory; label: string }[] = [
  { id: 'basic', label: '기초' },
  { id: 'order', label: '주문·체결' },
  { id: 'price', label: '가격·등락' },
  { id: 'asset', label: '내 자산' },
  { id: 'news', label: '뉴스·공시' },
  { id: 'economy', label: '경제·업종' },
  { id: 'risk', label: '위험·심리' },
  { id: 'chart', label: '차트' }
];

export interface Term {
  id: string; term: string; en?: string; category: TermCategory;
  short: string; body: string; game?: string;
  match: string[]; related: string[]; skipAfter?: string[];
}

export const TERMS: Term[] = [
  /* ---------- 기초 ---------- */
  { id: 'stock', term: '주식', en: 'Stock', category: 'basic',
    short: '회사의 소유권을 잘게 나눈 조각',
    body: '주식 1주를 가지면 그 회사의 아주 작은 주인이 됩니다. 회사가 잘되면 주식의 가치가 오르고, 이익 일부를 배당으로 받기도 합니다.',
    game: '게임 속 24개 기업은 모두 지어낸 가상 기업입니다. 한 판에는 그중 10개가 나옵니다.',
    match: ['주식'], related: ['share-price', 'market-cap', 'shareholder'] },
  { id: 'share-price', term: '주가', category: 'basic',
    short: '주식 1주가 거래되는 가격',
    body: '주가는 사려는 사람과 팔려는 사람이 합의한 가격입니다. 회사의 실적뿐 아니라 앞으로에 대한 기대가 함께 들어 있습니다.',
    game: '이 게임의 주가는 참가자 주문량과 상관없이 사건 결과, 시장 변동, 종목 변동으로만 정해집니다.',
    match: ['주가'], related: ['expectation', 'close-price', 'change-rate'] },
  { id: 'shareholder', term: '주주', category: 'basic',
    short: '주식을 가진 사람',
    body: '주주는 가진 주식 수만큼 회사에 대한 권리를 가집니다. 주주총회에서 의결권을 쓰고, 배당을 받을 수 있습니다.',
    match: ['주주'], related: ['stock', 'dilution'] },
  { id: 'market-cap', term: '시가총액', en: 'Market capitalization', category: 'basic',
    short: '주가 × 발행 주식 수. 시장이 매긴 회사 전체 값',
    body: '주가가 1만 원이고 주식이 1천만 주라면 시가총액은 1천억 원입니다. 주가만 보면 회사 크기를 알 수 없어서, 회사끼리 비교할 때는 시가총액을 봅니다.',
    match: ['시가총액'], related: ['share-price', 'dilution'] },
  { id: 'growth-stock', term: '성장주', en: 'Growth stock', category: 'basic',
    short: '지금보다 미래 이익 기대로 값이 매겨지는 주식',
    body: '아직 이익이 작아도 앞으로 크게 성장할 거라는 기대로 주가가 높게 형성된 주식입니다. 기대가 바뀌면 주가가 크게 흔들리고, 금리에 민감합니다.',
    game: '세모륨 열전지(G02)가 대표적인 성장주 역할입니다.',
    match: ['성장주'], related: ['interest-rate', 'defensive-stock', 'volatility'] },
  { id: 'defensive-stock', term: '방어주', en: 'Defensive stock', category: 'basic',
    short: '경기와 상관없이 실적이 꾸준한 주식',
    body: '전기·수도·통신·생활필수품처럼 경기가 나빠도 수요가 크게 줄지 않는 업종의 주식입니다. 오를 때 덜 오르지만, 내릴 때도 덜 내리는 편입니다.',
    game: '타르멜 물순환(G06)이 방어주 역할입니다. 변동 폭이 가장 작습니다.',
    match: ['방어주'], related: ['growth-stock', 'long-term-contract'] },

  /* ---------- 주문·체결 ---------- */
  { id: 'buy', term: '매수', en: 'Buy', category: 'order',
    short: '주식을 사는 것',
    body: '매수 주문을 내고 파는 사람의 주문과 맞으면 거래가 성사되어 주식이 내 계좌로 들어옵니다.',
    game: '주문 시간에 매수를 예약하면 마감 때 기준가로 한꺼번에 체결됩니다.',
    match: ['매수'], related: ['sell', 'execution', 'reference-price'] },
  { id: 'sell', term: '매도', en: 'Sell', category: 'order',
    short: '가진 주식을 파는 것',
    body: '매도가 체결되면 주식이 빠져나가고 그 대금이 들어옵니다. 실제 시장에서는 매도할 때 세금(증권거래세)도 붙습니다.',
    game: '라운드를 시작할 때 갖고 있던 수량까지만 팔 수 있고, 매도 대금은 다음 라운드부터 씁니다. 이 게임에는 세금이 없습니다.',
    match: ['매도'], related: ['buy', 'settlement', 'realized-pnl'] },
  { id: 'execution', term: '체결', en: 'Execution', category: 'order',
    short: '주문이 실제 거래로 성사되는 것',
    body: '주문을 냈다고 바로 사지는 것이 아닙니다. 반대편 주문과 가격·수량이 맞아야 체결됩니다. 체결되지 않은 주문은 취소하거나 바꿀 수 있습니다.',
    game: '이 게임은 마감 때 예약한 주문을 전량 체결합니다. 실제 시장처럼 일부만 체결되는 일은 없습니다.',
    match: ['체결'], skipAfter: ['계약 ', '계약을 ', '협정 '], related: ['buy', 'sell', 'order-book'] },
  { id: 'reference-price', term: '기준가', category: 'order',
    short: '이번 라운드 주문에 쓰이는 가격(직전 종료가)',
    body: '실제 시장에서 기준가는 그날 가격 제한폭을 계산하는 출발점으로, 보통 전날 종가입니다.',
    game: '이 게임은 모든 주문을 기준가, 즉 직전 라운드 종료가로 체결합니다. 상·하한가도 기준가에서 계산합니다.',
    match: ['기준가', '이전가'], related: ['close-price', 'price-limit', 'execution'] },
  { id: 'fee', term: '수수료', en: 'Commission', category: 'order',
    short: '거래할 때마다 증권사에 내는 비용',
    body: '사고팔 때마다 거래 금액의 일정 비율을 냅니다. 비율은 작아도 자주 거래하면 쌓여서 수익을 깎습니다. 비율은 증권사와 상품마다 다릅니다.',
    game: '매수·매도 모두 거래대금의 0.20%를 원 단위로 올려서 냅니다.',
    match: ['수수료'], related: ['turnover', 'execution'] },
  { id: 'slippage', term: '슬리피지', en: 'Slippage', category: 'order',
    short: '주문할 때 본 가격과 실제 체결된 가격의 차이',
    body: '큰 주문은 호가창의 여러 가격대를 한꺼번에 사거나 팔아야 해서, 평균 체결가가 처음 본 가격보다 불리해지기 쉽습니다. 거래가 적은 종목일수록 차이가 커집니다. 수수료처럼 눈에 띄지 않지만 실제 비용입니다.',
    game: '주문 금액(기준가 × 수량)이 200만 원을 넘으면 100만 원마다 5bp씩, 최대 40bp(0.40%) 불리하게 체결됩니다. 매수는 비싸게, 매도는 싸게. 내 체결가에만 적용되고 종료가와 다른 사람 가격은 바꾸지 않습니다.',
    match: ['슬리피지'], related: ['fee', 'execution', 'order-book', 'volume'] },
  { id: 'turnover', term: '거래대금', category: 'order',
    short: '가격 × 수량. 거래된 돈의 크기',
    body: '1만 원짜리 주식을 100주 사면 거래대금은 100만 원입니다. 수수료와 세금은 거래대금에 비율을 곱해 계산합니다.',
    match: ['거래대금'], related: ['fee', 'volume'] },
  { id: 'deposit-reserved', term: '매수 예약금', category: 'order',
    short: '체결 전 매수 주문을 위해 묶어 둔 현금',
    body: '실제 증권 계좌에서도 매수 주문을 내면 그만큼의 돈이 주문 가능 금액에서 빠집니다. 주문을 취소하면 다시 풀립니다.',
    game: '예약한 매수 금액과 수수료를 합쳐 묶어 둡니다. 남은 돈이 "주문 가능" 금액입니다.',
    match: ['매수 예약금', '예약금'], related: ['buy', 'cash'] },
  { id: 'settlement', term: '결제일(T+2)', en: 'Settlement', category: 'order',
    short: '체결 뒤 돈과 주식이 실제로 오가는 날',
    body: '한국 주식시장은 체결한 날(T) 기준 2영업일 뒤에 돈과 주식이 실제로 오갑니다. 그래서 오늘 판 돈을 바로 인출할 수 없습니다.',
    game: '이 게임은 이를 단순화해 "매도 대금은 다음 라운드부터 쓸 수 있다"로 바꿨습니다.',
    match: ['결제일'], related: ['sell', 'cash'] },
  { id: 'order-book', term: '호가', en: 'Quote', category: 'order',
    short: '사거나 팔겠다고 부른 가격',
    body: '"이 가격에 사겠다"는 매수 호가와 "이 가격에 팔겠다"는 매도 호가가 줄지어 있는 것을 호가창이라고 합니다. 둘이 만나면 체결됩니다.',
    game: '이 게임에는 호가창이 없습니다. 모든 주문은 기준가 하나로 체결됩니다.',
    match: ['호가'], related: ['limit-order', 'market-order', 'execution'] },
  { id: 'limit-order', term: '지정가 주문', en: 'Limit order', category: 'order',
    short: '원하는 가격을 정해 두고 내는 주문',
    body: '"1만 원 이하일 때만 사겠다"처럼 가격을 정합니다. 원하는 가격에 사지만, 시장이 그 가격에 오지 않으면 체결되지 않을 수 있습니다.',
    match: ['지정가'], related: ['market-order', 'order-book'] },
  { id: 'market-order', term: '시장가 주문', en: 'Market order', category: 'order',
    short: '가격을 정하지 않고 지금 가능한 가격에 바로 거래',
    body: '빨리 체결되는 대신 얼마에 체결될지 정확히 모릅니다. 거래가 적은 종목에서는 생각보다 비싸게 사거나 싸게 팔 수 있습니다.',
    match: ['시장가'], related: ['limit-order', 'order-book'] },

  /* ---------- 가격·등락 ---------- */
  { id: 'close-price', term: '종가', en: 'Closing price', category: 'price',
    short: '그날 마지막으로 체결된 가격',
    body: '하루의 끝 가격이라 다음 날 등락률을 계산하는 기준이 됩니다. 뉴스에서 "OO원에 마감했다"는 종가를 말합니다.',
    game: '이 게임에서는 라운드마다 정해지는 "종료가"가 종가 역할을 합니다.',
    match: ['종가', '종료가'], related: ['open-price', 'reference-price', 'candle'] },
  { id: 'open-price', term: '시가', en: 'Opening price', category: 'price',
    short: '그날 처음 체결된 가격',
    body: '전날 밤 사이 나온 뉴스가 반영되어 전날 종가와 다르게 출발하기도 합니다.',
    match: ['시가'], related: ['close-price', 'high-low', 'candle'] },
  { id: 'high-low', term: '고가·저가', category: 'price',
    /* '저가 수주'(싸게 따낸 계약)처럼 다른 뜻이 많아 자동 링크하지 않고, 차트 화면에서 직접 연결합니다. */
    short: '그날 가장 높았던 가격과 가장 낮았던 가격',
    body: '종가만 보면 하루 동안 얼마나 출렁였는지 알 수 없습니다. 고가와 저가를 함께 보면 장중 움직임의 폭을 알 수 있습니다.',
    game: '이 게임은 라운드 안의 가격 움직임을 계산하지 않아서, 봉 차트의 고가·저가는 연출입니다. 가격 제한폭 안에서만 그립니다.',
    match: [], related: ['candle', 'volatility'] },
  { id: 'change-rate', term: '등락률', category: 'price',
    short: '기준 가격보다 몇 % 오르거나 내렸는지',
    body: '(현재가 − 기준가) ÷ 기준가 × 100으로 계산합니다. 한국에서는 오르면 빨강(▲), 내리면 파랑(▼)으로 표시합니다. 미국 등 해외는 반대인 경우가 많습니다.',
    match: ['등락률', '등락'], related: ['bp', 'reference-price'] },
  { id: 'bp', term: 'bp(베이시스 포인트)', en: 'Basis point', category: 'price',
    short: '0.01%. 100bp = 1%',
    body: '금리나 수익률의 작은 변화를 정확히 말할 때 씁니다. "금리 25bp 인상"은 0.25%p 인상입니다.',
    game: '가격 변동 근거는 bp로 보여 줍니다. +780bp는 +7.80%입니다.',
    match: ['bp'], related: ['change-rate', 'percent-point'] },
  { id: 'percent-point', term: '%p(퍼센트포인트)', category: 'price',
    short: '퍼센트끼리의 차이를 나타내는 단위',
    body: '금리가 3%에서 5%가 되면 "2%p 올랐다"고 합니다. "2% 올랐다"고 하면 3%의 2%인 0.06%p로 오해할 수 있어 구분합니다.',
    match: ['%p'], related: ['bp', 'interest-rate'] },
  { id: 'price-limit', term: '상한가·하한가', category: 'price',
    short: '하루에 오르거나 내릴 수 있는 한계 가격',
    body: '급격한 가격 변동을 막기 위한 장치입니다. 한국 주식시장(코스피·코스닥)은 기준가 대비 ±30%가 한도입니다.',
    game: '이 게임은 ±20%로 더 좁게 정했습니다. 상한가는 10원 단위로 내리고, 하한가는 10원 단위로 올립니다.',
    match: ['상한가', '하한가', '상·하한가'], related: ['reference-price', 'volatility'] },
  { id: 'volatility', term: '변동성', en: 'Volatility', category: 'price',
    short: '가격이 얼마나 크게 출렁이는지',
    body: '변동성이 크면 짧은 시간에 크게 벌 수도, 크게 잃을 수도 있습니다. 같은 수익률이라면 변동성이 작은 쪽이 마음 편히 들고 있기 쉽습니다.',
    game: '종목마다 뉴스와 상관없는 "종목 변동" 폭이 다릅니다. 세모륨이 가장 크고 타르멜이 가장 작습니다.',
    match: ['변동성'], related: ['diversification', 'growth-stock'] },
  { id: 'systematic-risk', term: '시장 위험(체계적 위험)', en: 'Systematic risk', category: 'price',
    short: '시장 전체가 함께 움직여서 생기는 위험',
    body: '금리, 경기, 전쟁처럼 모든 주식에 영향을 주는 위험은 종목을 여러 개 사도 없어지지 않습니다. 반대로 한 회사만의 문제는 분산으로 줄일 수 있습니다.',
    game: '가격 근거의 "공통 시장 변동"이 시장 전체에 똑같이 적용되는 몫입니다.',
    match: ['공통 시장 변동', '체계적 위험'], related: ['diversification', 'interest-rate'] },

  /* ---------- 내 자산 ---------- */
  { id: 'cash', term: '예수금(보유 현금)', category: 'asset',
    short: '계좌에 있는, 주식으로 바꾸지 않은 돈',
    body: '증권 계좌에 들어 있는 현금을 예수금이라고 합니다. 주문 가능 금액은 예수금에서 이미 주문에 묶인 돈을 뺀 금액입니다.',
    match: ['예수금', '주문 가능 금액'], related: ['deposit-reserved', 'portfolio-value'] },
  { id: 'portfolio-value', term: '평가액', category: 'asset',
    short: '지금 가격으로 따진 내 자산 전체',
    body: '현금 + (보유 수량 × 현재가)입니다. 아직 팔지 않았으니 실제로 손에 쥔 돈은 아니고, 가격이 바뀌면 함께 바뀝니다.',
    match: ['평가액'], related: ['unrealized-pnl', 'return-rate'] },
  { id: 'return-rate', term: '수익률', en: 'Return', category: 'asset',
    short: '처음 돈 대비 얼마나 늘었거나 줄었는지(%)',
    body: '(지금 평가액 − 처음 자금) ÷ 처음 자금 × 100입니다. 수수료와 세금을 빼고 계산해야 실제 수익률입니다.',
    game: '시작 자금 1,000만 원을 기준으로 계산하고, 낸 수수료가 이미 반영되어 있습니다.',
    match: ['수익률'], related: ['portfolio-value', 'fee'] },
  { id: 'avg-cost', term: '평균 단가', en: 'Average cost', category: 'asset',
    short: '내가 산 주식 1주의 평균 가격',
    body: '1만 원에 10주, 1만 2천 원에 10주를 샀다면 평균 단가는 1만 1천 원입니다. 지금 가격이 평균 단가보다 높으면 이익, 낮으면 손실입니다.',
    game: '이 게임의 평균 단가에는 수수료를 넣지 않았습니다.',
    match: ['평균 단가', '평단'], related: ['unrealized-pnl', 'realized-pnl'] },
  { id: 'unrealized-pnl', term: '평가손익', category: 'asset',
    short: '팔지 않은 주식의 장부상 이익·손실',
    body: '(현재가 − 평균 단가) × 보유 수량입니다. 팔기 전까지는 확정이 아니어서 "평가"라는 말이 붙습니다.',
    match: ['평가손익', '평가이익', '평가손실'], related: ['realized-pnl', 'avg-cost', 'disposition-effect'] },
  { id: 'realized-pnl', term: '실현손익', category: 'asset',
    short: '실제로 팔아서 확정된 이익·손실',
    body: '팔고 나면 손익이 확정됩니다. 세금은 보통 실현손익이나 거래에 붙습니다.',
    match: ['실현손익', '실현이익', '실현손실'], related: ['unrealized-pnl', 'disposition-effect'] },
  { id: 'portfolio', term: '포트폴리오', en: 'Portfolio', category: 'asset',
    short: '내가 가진 자산들의 묶음',
    body: '어떤 종목을 얼마씩 갖고 있는지를 말합니다. 비중이 한 종목에 쏠려 있으면 그 종목 하나에 계좌 전체가 흔들립니다.',
    match: ['포트폴리오'], related: ['diversification', 'concentration'] },

  /* ---------- 뉴스·공시 ---------- */
  { id: 'disclosure', term: '공시', en: 'Disclosure', category: 'news',
    short: '회사가 투자자에게 중요한 정보를 공식으로 알리는 것',
    body: '실적, 계약, 증자처럼 주가에 영향을 줄 정보는 법에 따라 공시해야 합니다. 한국에서는 금융감독원 전자공시시스템(DART)에서 누구나 볼 수 있습니다. 소문보다 공시가 먼저입니다.',
    match: ['공시'], related: ['insider-info', 'rumor'] },
  { id: 'expectation', term: '시장 기대치(컨센서스)', en: 'Consensus', category: 'news',
    short: '시장이 미리 예상하고 주가에 반영해 둔 숫자',
    body: '증권사 분석가들의 예상 평균 같은 것을 컨센서스라고 합니다. 결과가 좋아도 기대보다 못하면 주가가 내릴 수 있고, 나빠도 기대보다 덜 나쁘면 오를 수 있습니다.',
    game: '이 게임의 핵심 규칙입니다. 뉴스의 "시장의 기대치"와 실제 결과의 차이가 주가를 움직입니다.',
    match: ['시장의 기대치', '시장 기대치', '기대치', '컨센서스'], related: ['priced-in', 'earnings-surprise'] },
  { id: 'priced-in', term: '선반영', en: 'Priced in', category: 'news',
    short: '좋은·나쁜 소식이 이미 주가에 들어가 있는 상태',
    body: '모두가 예상한 호재는 발표 전에 이미 주가가 올라 있어서, 막상 발표되면 더 오르지 않거나 오히려 떨어지기도 합니다. "소문에 사서 뉴스에 팔라"는 말이 여기서 나왔습니다.',
    game: '"이미 주가에 반영된 규모"라는 해설이 나오면 선반영입니다.',
    match: ['선반영', '이미 주가에 반영'], related: ['expectation', 'earnings-surprise'] },
  { id: 'earnings-surprise', term: '어닝 서프라이즈·쇼크', en: 'Earnings surprise', category: 'news',
    short: '실적이 기대를 크게 넘거나(서프라이즈) 크게 밑돎(쇼크)',
    body: '실적 발표에서 시장 기대치와 실제 숫자의 차이를 말합니다. 주가는 실적의 절대 크기보다 이 차이에 더 크게 반응합니다.',
    match: ['어닝 서프라이즈', '어닝 쇼크', '기대 대비 실망'], related: ['expectation', 'priced-in'] },
  { id: 'rumor', term: '찌라시(루머)', category: 'news',
    short: '출처가 확인되지 않은 소문',
    body: '"OO가 인수된다더라" 같은 소문은 공시로 확인되기 전까지 사실이 아닙니다. 일부러 소문을 퍼뜨려 주가를 띄우고 파는 것은 불법인 시세 조종이 될 수 있습니다.',
    match: ['찌라시', '루머', '소문', '풍문'], related: ['disclosure', 'leading-room'] },
  { id: 'order-backlog', term: '수주잔고(주문 잔고)', en: 'Backlog', category: 'news',
    short: '받아 놓았지만 아직 납품하지 않은 주문',
    body: '앞으로 매출로 바뀔 일감이라 미래 실적을 미리 보여 주는 지표입니다. 잔고가 늘면 몇 분기 뒤 매출이 늘 가능성이 큽니다.',
    match: ['주문 잔고', '수주잔고'], related: ['leading-indicator', 'contract-win'] },
  { id: 'contract-win', term: '수주', category: 'news',
    short: '일감(주문·계약)을 따내는 것',
    body: '수주 자체도 중요하지만 얼마에 따냈는지가 이익을 정합니다. 경쟁이 치열하면 낮은 가격에 따내 이익이 거의 남지 않기도 합니다.',
    match: ['수주', '입찰', '낙찰'], related: ['margin', 'order-backlog'] },
  { id: 'yield-rate', term: '수율', en: 'Yield', category: 'news',
    short: '만든 제품 중 쓸 수 있는 정상품의 비율',
    body: '100개를 만들어 70개가 정상이면 수율 70%입니다. 수율이 낮으면 버리는 물건이 많아 원가가 올라갑니다. 반도체·배터리 기업 뉴스에 자주 나옵니다.',
    match: ['수율'], related: ['mass-production', 'margin'] },
  { id: 'mass-production', term: '양산', category: 'news',
    short: '시험 생산을 넘어 대량으로 만드는 단계',
    body: '실험실에서 잘 되던 제품도 대량 생산에서는 불량이 늘 수 있습니다. 양산 시점이 늦어지면 매출 시점도 늦어집니다.',
    match: ['양산'], related: ['yield-rate'] },
  { id: 'rights-offering', term: '유상증자(신주 발행)', en: 'Rights offering', category: 'news',
    short: '회사가 새 주식을 발행해 투자자에게 팔아 돈을 모으는 것',
    body: '회사는 돈을 얻지만 주식 수가 늘어 기존 주주의 몫이 줄어듭니다(지분 희석). 그래서 대규모 유상증자 발표에 주가가 내리는 경우가 많습니다.',
    match: ['신주 발행', '유상증자'], related: ['dilution', 'shareholder'] },
  { id: 'dilution', term: '지분 희석', en: 'Dilution', category: 'news',
    short: '주식 수가 늘어 1주의 몫이 줄어드는 것',
    body: '피자를 8조각에서 10조각으로 다시 자르면 한 조각이 작아지는 것과 같습니다. 회사 가치가 그대로라면 주당 가치는 내려갑니다.',
    match: ['지분 희석', '희석'], related: ['rights-offering', 'market-cap'] },
  { id: 'margin', term: '마진(이익률)', en: 'Margin', category: 'news',
    short: '매출에서 비용을 빼고 남는 몫의 비율',
    body: '1만 원어치 팔아 2천 원이 남으면 이익률 20%입니다. 매출이 늘어도 비용이 더 늘면 마진이 줄어 주가가 내릴 수 있습니다.',
    match: ['마진', '이익률', '영업이익률'], related: ['pricing-power', 'contract-win'] },
  { id: 'dividend', term: '배당', en: 'Dividend', category: 'news',
    short: '회사가 이익 일부를 주주에게 나눠 주는 돈',
    body: '보통 1년에 한 번, 회사에 따라 분기나 반기마다 줍니다. 주가 대비 배당금 비율을 배당수익률이라고 합니다. 배당은 회사가 정하는 것이라 줄거나 없어질 수도 있습니다.',
    game: '이 게임은 배당금을 실제로 지급하지 않고, 배당 소식이 주가에 주는 영향만 보여 줍니다.',
    match: ['배당'], related: ['ex-dividend', 'buyback', 'shareholder', 'defensive-stock'] },
  { id: 'ex-dividend', term: '배당락', en: 'Ex-dividend', category: 'news',
    short: '배당받을 권리가 사라지는 날, 그만큼 주가가 내려가는 것',
    body: '배당을 받으려면 정해진 날까지 주식을 갖고 있어야 합니다. 그 권리가 사라지는 날에는 배당금만큼의 가치가 빠져 주가가 내려가는 경우가 많습니다. 배당만 보고 직전에 사면 이득이 없을 수 있는 이유입니다.',
    match: ['배당락'], related: ['dividend'] },
  { id: 'buyback', term: '자사주 매입', en: 'Share buyback', category: 'news',
    short: '회사가 자기 회사 주식을 시장에서 사들이는 것',
    body: '시장에 도는 주식 수가 줄어 1주의 몫이 커지는 효과가 있고, 회사가 "우리 주가가 싸다"고 보는 신호로 읽히기도 합니다. 사들인 주식을 없애는(소각) 경우 효과가 더 확실합니다.',
    match: ['자사주 매입', '자사주'], related: ['dividend', 'dilution'] },
  { id: 'inquiry-disclosure', term: '조회공시', category: 'news',
    short: '소문이나 급격한 주가 변동에 대해 거래소가 회사에 사실을 묻는 것',
    body: '풍문이나 보도가 돌거나 주가가 이유 없이 크게 움직이면, 거래소가 회사에 사실 여부를 공시하라고 요구합니다. 회사의 답변 공시를 보면 소문이 맞는지 확인할 수 있습니다.',
    match: ['조회공시'], related: ['disclosure', 'rumor'] },
  { id: 'operating-profit', term: '영업이익', en: 'Operating profit', category: 'news',
    short: '본업으로 번 이익. 매출에서 원가와 판매·관리비를 뺀 것',
    body: '매출이 늘어도 비용이 더 늘면 영업이익은 줄어듭니다. 그래서 실적 발표 때 시장은 매출보다 영업이익과 그 기대치를 더 눈여겨봅니다.',
    match: ['영업이익', '영업적자'], related: ['margin', 'earnings-surprise', 'guidance'] },
  { id: 'guidance', term: '가이던스(실적 전망)', en: 'Guidance', category: 'news',
    short: '회사가 스스로 내놓는 앞으로의 실적 예상치',
    body: '지난 실적이 좋아도 다음 전망을 낮추면 주가가 내릴 수 있습니다. 주가는 과거보다 미래 기대를 반영하기 때문입니다.',
    match: ['가이던스'], related: ['expectation', 'operating-profit'] },
  { id: 'mna', term: '인수·합병(M&A)', en: 'Mergers and acquisitions', category: 'news',
    short: '다른 회사를 사들이거나 두 회사가 하나로 합치는 것',
    body: '인수하는 쪽은 보통 시장 가격보다 비싸게 사는데, 이 웃돈을 인수 프리미엄이라고 합니다. 그래서 인수설만으로 주가가 오르기도 하지만, 무산되면 그만큼 빠집니다.',
    match: ['인수·합병', 'M&A', '인수 프리미엄', '인수설'], related: ['rumor', 'inquiry-disclosure'] },
  { id: 'business-report', term: '사업보고서', category: 'news',
    short: '상장사가 사업 내용과 재무 상태를 자세히 적어 내는 정기 보고서',
    body: '1년에 한 번 내는 사업보고서와 분기·반기보고서가 있습니다. 주요 계약, 원료 조달, 위험 요소까지 적혀 있어 소문보다 믿을 만한 근거가 됩니다. 전자공시시스템(DART)에서 누구나 볼 수 있습니다.',
    match: ['사업보고서'], related: ['disclosure'] },
  { id: 'ir', term: 'IR(기업설명회)', en: 'Investor relations', category: 'news',
    short: '회사가 투자자에게 사업과 실적을 직접 설명하는 활동',
    body: '실적 발표 뒤 설명회를 열거나 자료를 공개합니다. 공시보다 자세한 설명을 들을 수 있지만, 회사가 좋게 말하고 싶은 내용 위주일 수 있습니다.',
    match: ['기업설명회', 'IR'], related: ['disclosure', 'guidance'] },
  { id: 'utilization', term: '가동률·고정비', category: 'news',
    short: '설비를 얼마나 쓰는지(가동률)와 쓰든 안 쓰든 드는 비용(고정비)',
    body: '창고·공장은 임대료, 감가상각 같은 고정비가 커서 가동률이 낮으면 손해, 높으면 이익이 빠르게 늘어납니다.',
    match: ['가동률', '고정비'], related: ['margin', 'operating-profit'] },
  { id: 'injunction', term: '가처분', category: 'news',
    short: '정식 판결 전에 법원이 임시로 내리는 금지·보전 명령',
    body: '특허 분쟁에서 "판매 금지 가처분"이 받아들여지면 재판이 끝나기 전에도 제품을 팔 수 없게 됩니다. 그래서 본안 판결보다 가처분 결과에 주가가 먼저 크게 움직이기도 합니다.',
    match: ['가처분'], related: ['royalty'] },
  { id: 'royalty', term: '로열티', en: 'Royalty', category: 'news',
    short: '특허·기술·상표를 쓰는 대가로 계속 내는 사용료',
    body: '매출의 몇 %처럼 정해서 계속 냅니다. 한 번 내고 끝나는 합의금과 달리 앞으로의 이익률을 계속 깎습니다.',
    match: ['로열티'], related: ['injunction', 'margin'] },
  { id: 'leading-indicator', term: '선행 지표', en: 'Leading indicator', category: 'news',
    short: '실적이나 경기를 미리 보여 주는 숫자',
    body: '예약률, 주문 잔고, 신규 주문처럼 나중에 매출로 이어지는 숫자입니다. 실적 발표 전에 방향을 짐작하는 데 씁니다.',
    match: ['선행 지표'], related: ['order-backlog', 'expectation'] },
  { id: 'long-term-contract', term: '장기 계약', category: 'news',
    short: '여러 해 동안 거래를 약속한 계약',
    body: '경기가 나빠져도 정해진 매출이 들어와 실적이 안정됩니다. 반대로 큰 장기 계약이 끝나면 매출이 한꺼번에 빠질 수 있습니다.',
    match: ['장기 계약', '장기 공급'], related: ['defensive-stock'] },

  { id: 'correction-disclosure', term: '정정 공시', category: 'news',
    short: '이미 낸 공시의 내용을 고쳐 다시 내는 것',
    body: '계약 금액, 일정, 조건 같은 내용이 바뀌거나 틀렸을 때 냅니다. 처음 공시만 보고 샀다가 정정 공시로 내용이 작아지면 실망 매물이 나올 수 있습니다. 공시는 첨부된 조건까지 읽는 것이 좋습니다.',
    match: ['정정 공시', '정정공시'], related: ['disclosure', 'contract-win'] },
  { id: 'recall', term: '리콜', en: 'Recall', category: 'news',
    short: '결함이 있는 제품을 회사가 거둬들여 고치거나 바꿔 주는 것',
    body: '리콜 비용은 범위(몇 대, 몇 개)와 누가 비용을 내는지에 따라 크게 달라집니다. 원인이 좁게 확인되면 걱정이 빨리 걷히기도 합니다.',
    match: ['리콜'], related: ['operating-profit'] },
  { id: 'overhang', term: '오버행(물량 부담)', en: 'Overhang', category: 'news',
    short: '언제든 시장에 나올 수 있는 대량의 주식',
    body: '상장 때 일정 기간 팔지 않기로 약속한 주식(의무보유, 보호예수)이 풀리거나, 큰 주주가 팔 수 있다는 소식이 있으면 실제로 팔리지 않아도 주가가 눌리기 쉽습니다.',
    match: ['오버행', '물량 부담', '의무보유', '보호예수'], related: ['block-deal', 'dilution'] },
  { id: 'block-deal', term: '블록딜', en: 'Block deal', category: 'news',
    short: '많은 주식을 정해진 가격에 한꺼번에 넘기는 거래',
    body: '보통 장이 끝난 뒤 큰 투자자끼리 거래하며, 사는 쪽을 끌어들이려고 현재가보다 할인된 가격을 쓰는 경우가 많습니다. 그 가격이 다음 날 주가의 기준처럼 작용하기도 합니다.',
    match: ['블록딜'], related: ['overhang'] },
  { id: 'proxy-fight', term: '경영권 분쟁', category: 'news',
    short: '회사를 누가 경영할지를 두고 주주끼리 다투는 것',
    body: '지분을 더 사들이거나 주주총회 표 대결로 결론을 냅니다. 지분 경쟁 기대로 주가가 오르기도 하지만, 분쟁이 끝나거나 길어지면 크게 흔들릴 수 있습니다.',
    match: ['경영권 분쟁', '경영권'], related: ['shareholder', 'mna'] },
  { id: 'turnaround', term: '흑자 전환·적자 전환', category: 'news',
    short: '손실을 내던 회사가 이익을 내기 시작함(흑자 전환), 또는 그 반대(적자 전환)',
    body: '흑자 전환은 큰 호재로 여겨지지만, 시장이 이미 기대하고 있었다면 발표 당일 오름 폭은 작을 수 있습니다. 숫자 자체보다 기대와의 차이를 보세요.',
    match: ['흑자 전환', '적자 전환', '흑자'], related: ['operating-profit', 'expectation'] },
  { id: 'theme-stock', term: '테마주', category: 'news',
    short: '같은 이야기(테마)로 묶여 함께 움직이는 종목들',
    body: '"가상 공연 관련주"처럼 유행하는 이야기로 묶입니다. 실적보다 기대로 움직여 변동이 크고, 테마가 식으면 빠르게 내립니다. 회사의 실제 사업과 연결되는지 확인해야 합니다.',
    match: ['테마주', '테마'], related: ['rumor', 'herding', 'sector'] },

  /* ---------- 경제·업종 ---------- */
  { id: 'interest-rate', term: '기준금리', en: 'Policy rate', category: 'economy',
    short: '중앙은행이 정하는, 모든 금리의 기준이 되는 금리',
    body: '금리가 오르면 돈을 빌리기 어려워지고 예금이 매력적이 되어 주식 수요가 줄어드는 편입니다. 특히 먼 미래 이익에 기대는 성장주가 크게 흔들립니다. 한국은 한국은행 금융통화위원회가 정합니다.',
    match: ['기준금리', '금리'], related: ['growth-stock', 'percent-point', 'systematic-risk'] },
  { id: 'business-cycle', term: '경기', category: 'economy',
    short: '나라 전체 경제 활동이 좋고 나쁜 흐름',
    body: '경기가 좋으면 소비와 투자가 늘어 기업 실적이 좋아지고, 나쁘면 반대입니다. 업종마다 경기에 반응하는 정도가 다릅니다.',
    match: ['경기 흐름', '경기순환'], related: ['defensive-stock', 'consumption-index'] },
  { id: 'consumption-index', term: '소비 지표', category: 'economy',
    short: '사람들이 돈을 얼마나 쓰는지 보여 주는 통계',
    body: '카드 사용액, 소매 판매액 같은 숫자입니다. 여가·외식처럼 꼭 필요하지 않은 소비가 먼저 줄고 먼저 늡니다.',
    match: ['소비 지표'], related: ['business-cycle', 'leading-indicator'] },
  { id: 'pricing-power', term: '가격 결정력', en: 'Pricing power', category: 'economy',
    short: '원가가 올라도 판매 가격을 올릴 수 있는 힘',
    body: '전기요금·원재료비가 올랐을 때 이를 고객에게 넘길 수 있는 회사는 마진을 지킵니다. 경쟁자가 많은 회사는 비용을 혼자 떠안기 쉽습니다.',
    match: ['가격 결정력'], related: ['margin'] },
  { id: 'beneficiary', term: '수혜(수혜주)', category: 'economy',
    short: '어떤 사건·정책 덕분에 이익을 보는 것(그런 주식)',
    body: '"규제 강화의 수혜", "폭염 수혜주"처럼 씁니다. 다만 수혜 기대만으로 오른 주가는, 실제 시기나 규모가 기대보다 작으면 실망으로 되돌아가기 쉽습니다.',
    match: ['수혜'], related: ['expectation'] },

  { id: 'sector', term: '업종', en: 'Sector', category: 'economy',
    short: '비슷한 일을 하는 회사들의 묶음',
    body: '반도체, 운송, 식품처럼 하는 일이 비슷한 회사끼리 묶은 것입니다. 같은 업종은 같은 뉴스·원가·수요에 함께 영향을 받는 일이 많습니다.',
    game: '게임에는 업종 6개가 있고, 업종마다 대장주 1개와 관련 종목 3개가 있습니다. 같은 업종은 종목 아이콘 색이 같습니다.',
    match: ['업종'], related: ['leader-stock', 'co-movement', 'diversification'] },
  { id: 'leader-stock', term: '대장주', en: 'Sector leader', category: 'economy',
    short: '한 업종에서 가장 주목받고 흐름을 이끄는 종목',
    body: '업종 소식이 나오면 대장주가 먼저, 크게 움직이고 나머지 종목이 따라가는 일이 많습니다. 다만 따라가는 정도는 회사마다 다르고, 늘 따라가는 것도 아닙니다.',
    game: '뉴스는 업종 대장주를 직접 다룹니다. 같은 업종 다른 종목은 대장주 사건 영향의 일부만큼 함께 움직입니다.',
    match: ['대장주'], related: ['sector', 'co-movement'] },
  { id: 'co-movement', term: '동조화', en: 'Co-movement', category: 'economy',
    short: '여러 종목이나 시장이 같은 방향으로 함께 움직이는 것',
    body: '같은 업종, 같은 원가 구조, 같은 고객을 가진 회사들은 한 소식에 함께 오르내리기 쉽습니다. 서로 함께 움직이는 종목만 여러 개 사면, 종목 수가 많아도 분산 효과가 작습니다.',
    game: '결과 화면의 근거에 "업종 동반"으로 표시됩니다. 대장주 사건 영향에 종목마다 정해진 비율(0.35~0.6배)을 곱한 만큼 움직입니다.',
    match: ['동조화', '업종 동반', '함께 움직'], related: ['sector', 'leader-stock', 'diversification'] },

  { id: 'fx-rate', term: '환율', en: 'Exchange rate', category: 'economy',
    short: '우리 돈과 다른 나라 돈을 바꾸는 비율',
    body: '1달러에 필요한 원화가 늘어나면(환율 상승, 원화 가치 하락) 수입품이 비싸지고 수출품은 해외에서 싸집니다. 그래서 원료를 수입하는 회사는 원가가 오르고, 수출하는 회사는 유리해지는 편입니다. 미리 환율을 고정해 두는 계약으로 대비하기도 합니다.',
    match: ['환율'], related: ['margin', 'pricing-power'] },
  { id: 'credit-rating', term: '신용등급', en: 'Credit rating', category: 'economy',
    short: '빚을 제때 갚을 능력을 평가 기관이 매긴 등급',
    body: '등급이 내려가면 회사가 돈을 빌리거나 회사채를 낼 때 이자를 더 내야 합니다. 이자 부담은 이익과 배당 여력을 줄입니다.',
    match: ['신용등급', '신용평가'], related: ['corporate-bond', 'interest-rate'] },
  { id: 'corporate-bond', term: '회사채', en: 'Corporate bond', category: 'economy',
    short: '회사가 돈을 빌리면서 발행하는 채권',
    body: '정해진 날에 이자와 원금을 갚기로 약속하는 증서입니다. 신용등급이 낮거나 시장에 돈이 부족하면 더 높은 금리를 줘야 팔립니다. 주식을 새로 찍지 않으므로 지분 희석은 없습니다.',
    match: ['회사채'], related: ['credit-rating', 'rights-offering', 'interest-rate'] },

  /* ---------- 위험·심리 ---------- */
  { id: 'diversification', term: '분산 투자', en: 'Diversification', category: 'risk',
    short: '서로 다르게 움직이는 여러 자산에 나눠 투자',
    body: '"달걀을 한 바구니에 담지 마라"는 말입니다. 한 회사의 사고로 계좌 전체가 무너지는 위험을 줄입니다. 다만 시장 전체가 내리는 위험은 분산으로도 피하기 어렵습니다.',
    game: 'NPC 분산형은 업종마다 한 종목씩 6종목을 15%씩 사고 한 종목이 25%를 넘지 않게 관리합니다. 같은 업종끼리는 함께 움직이므로, 종목 수보다 업종을 나누는 것이 중요합니다.',
    match: ['분산 투자', '분산투자', '나눠서 담'],   /* '분산'만 쓰면 '분산 전력 장치'(업종명)에 잘못 붙습니다 */ related: ['concentration', 'systematic-risk', 'portfolio'] },
  { id: 'concentration', term: '몰빵(집중 투자)', category: 'risk',
    short: '한 종목에 돈 대부분을 넣는 것',
    body: '맞으면 크게 벌지만 틀리면 크게 잃습니다. 거래 정지처럼 팔고 싶어도 못 파는 상황이 오면 피할 방법이 없습니다.',
    match: ['몰빵', '집중 투자'], related: ['diversification'] },
  { id: 'leverage', term: '레버리지(빚투)', en: 'Leverage', category: 'risk',
    short: '빌린 돈으로 투자 규모를 키우는 것',
    body: '내 돈 100만 원에 100만 원을 빌려 200만 원을 투자하면 10% 하락에 내 돈은 20% 줄어듭니다. 이익도 손실도 같이 커지고, 이자까지 냅니다. 증권사에서 빌리는 것을 신용거래라고 합니다.',
    match: ['레버리지', '빚투', '신용 한도', '신용거래'], related: ['margin-call'] },
  { id: 'margin-call', term: '반대매매', category: 'risk',
    short: '빌린 돈의 담보가 부족해지면 증권사가 주식을 강제로 파는 것',
    body: '빚으로 산 주식 값이 떨어져 담보가 모자라면, 정해진 기한 안에 채우지 못할 경우 증권사가 내 뜻과 상관없이 주식을 팝니다. 바닥에서 팔리는 경우가 많아 손실이 확정됩니다.',
    match: ['반대매매'], related: ['leverage'] },
  { id: 'insider-info', term: '미공개 중요 정보', category: 'risk',
    short: '공시되기 전의 회사 내부 정보',
    body: '공시 전 정보로 거래하면 자본시장법 위반입니다. 내부자뿐 아니라 그 정보를 전해 듣고 거래한 사람도 처벌이나 과징금 대상이 될 수 있습니다.',
    match: ['미공개 중요 정보', '미공개 정보', '내부 정보', '내부자 거래'], related: ['disclosure'] },
  { id: 'leading-room', term: '리딩방', category: 'risk',
    short: '종목을 찍어 준다며 돈을 받는 단체 대화방',
    body: '"수익 보장", "오늘만 가입" 같은 말은 대표적인 사기 신호입니다. 투자 조언을 하는 업체인지 금융감독원 "파인(FINE)"에서 먼저 확인하세요. 가입비만 받고 사라지는 경우가 많습니다.',
    match: ['리딩방', '유사투자자문'], related: ['rumor', 'herding'] },
  { id: 'herding', term: '군집 행동', en: 'Herding', category: 'risk',
    short: '근거보다 남들이 하니까 따라 하는 행동',
    body: '모두가 산다는 말에 따라 사면 이미 오른 가격에 들어가기 쉽습니다. 더 사 줄 사람이 남아 있지 않으면 가격은 쉽게 꺾입니다.',
    match: ['군집 행동', '군중'], related: ['fomo', 'overreaction'] },
  { id: 'fomo', term: 'FOMO(포모)', en: 'Fear of missing out', category: 'risk',
    short: '나만 기회를 놓칠까 봐 조급해지는 마음',
    body: '"다들 벌었대"라는 말에 근거 없이 서둘러 사게 만듭니다. 조급할수록 왜 사는지 한 줄로 적어 보는 것이 도움이 됩니다.',
    match: ['FOMO', '포모'], related: ['herding'] },
  { id: 'loss-aversion', term: '손실 회피', en: 'Loss aversion', category: 'risk',
    short: '같은 크기라도 이익보다 손실을 더 아프게 느끼는 심리',
    body: '10만 원을 잃는 고통이 10만 원을 버는 기쁨보다 크게 느껴집니다. 그래서 공포에 한꺼번에 팔거나, 반대로 손실을 확정하기 싫어 끝까지 버티기도 합니다.',
    match: ['손실 회피'], related: ['disposition-effect'] },
  { id: 'disposition-effect', term: '처분 효과', en: 'Disposition effect', category: 'risk',
    short: '오른 주식은 빨리 팔고 내린 주식은 오래 들고 있는 경향',
    body: '이익은 빨리 확정하고 싶고 손실은 인정하기 싫어서 생깁니다. 결과적으로 좋은 종목은 일찍 팔고 나쁜 종목만 남기기 쉽습니다.',
    game: '학술제 모드 리포트에서 이익 실현 비율과 손실 실현 비율을 비교해 보여 줍니다.',
    match: ['처분 효과'], related: ['loss-aversion', 'realized-pnl', 'unrealized-pnl'] },
  { id: 'overreaction', term: '과잉 반응', en: 'Overreaction', category: 'risk',
    short: '뉴스 제목만 보고 실제보다 크게 반응하는 것',
    body: '자극적인 헤드라인에 몰려 사고팔다 보면, 세부 내용이 확인된 뒤 가격이 되돌아가는 일이 많습니다.',
    match: ['과잉 반응'], related: ['expectation', 'herding'] },
  { id: 'overconfidence', term: '과신', en: 'Overconfidence', category: 'risk',
    short: '내 판단이 실제보다 더 정확하다고 믿는 것',
    body: '확신이 강할수록 거래를 많이 하고 한 종목에 몰기 쉽습니다. 내 예측이 실제로 몇 번 맞았는지 기록해 보면 과신을 줄일 수 있습니다.',
    match: ['과신'], related: ['concentration'] },

  { id: 'stop-loss', term: '손절(손절매)', en: 'Stop-loss', category: 'risk',
    short: '손실을 더 키우지 않으려고 손해를 보고 파는 것',
    body: '위험 관리의 기본입니다. 다만 기준 없이 겁이 나서 팔면 가장 낮은 곳에서 팔기 쉽습니다. 사기 전에 "이런 일이 생기면 판다"는 기준을 정해 두는 것이 좋습니다.',
    match: ['손절매', '손절'], related: ['loss-aversion', 'disposition-effect'] },
  { id: 'averaging-down', term: '물타기', category: 'risk',
    short: '손실 중인 종목을 더 사서 평균 단가를 낮추는 것',
    body: '평균 단가는 내려가지만 이미 난 손실은 그대로이고, 한 종목 비중이 커져 위험이 늘어납니다. "지금 처음 봤다면 이 가격에 살까?"로 판단하는 편이 낫습니다.',
    match: ['물타기'], related: ['avg-cost', 'concentration'] },

  /* ---------- 차트 ---------- */
  { id: 'candle', term: '봉(캔들)', en: 'Candlestick', category: 'chart',
    short: '일정 기간의 시가·고가·저가·종가를 한 막대로 그린 것',
    body: '몸통은 시가와 종가 사이, 위아래 꼬리는 고가와 저가입니다. 하루를 한 봉으로 그리면 일봉, 1분이면 1분봉입니다.',
    game: '게임 화면에서는 라운드 하나가 봉 하나입니다. 몸통(시가→종가)은 실제 계산값이고, 꼬리(고가·저가)는 라운드 안 움직임을 보여 주는 연출입니다. 그 라운드에 매수 체결이 많으면 위 꼬리가, 매도 체결이 많으면 아래 꼬리가 길어집니다. 차트 연습실 수업 1~2에서는 체결 기록으로 진짜 봉을 만들어 봅니다.',
    match: ['캔들', '일봉', '분봉'], related: ['bull-bear-candle', 'open-price', 'close-price', 'high-low'] },
  { id: 'bull-bear-candle', term: '양봉·음봉', category: 'chart',
    short: '종가가 시가보다 높으면 양봉(빨강), 낮으면 음봉(파랑)',
    body: '양봉이라고 하루 종일 오른 것은 아닙니다. 장중에 시가 아래로 내려갔다가 회복했을 수도 있습니다. 꼬리를 함께 보세요.',
    match: ['양봉', '음봉'], related: ['candle'] },
  { id: 'volume', term: '거래량', en: 'Volume', category: 'chart',
    short: '일정 기간 동안 거래된 주식 수',
    body: '가격이 움직일 때 거래량이 많으면 그 움직임에 많은 사람이 참여했다는 뜻입니다. 다만 거래량만으로 앞으로의 방향을 알 수는 없습니다.',
    game: '게임 차트 아래 막대는 라운드마다 참가자와 NPC가 체결한 수량 합계입니다. 거래량은 종료가를 바꾸지 않습니다.',
    match: ['거래량'], related: ['candle', 'turnover'] },
  { id: 'moving-average', term: '이동평균선', en: 'Moving average', category: 'chart',
    short: '최근 N일 종가의 평균을 이어 그린 선',
    body: '5일선은 최근 5일 종가 평균입니다. 하루하루의 잡음을 줄여 흐름을 보여 주지만, 이미 지난 가격의 평균이라 늦게 반응합니다.',
    match: ['이동평균선', '이동평균', '5일선'], related: ['candle'] }
];

export const termById = new Map(TERMS.map(t => [t.id, t] as const));
export const categoryLabel = (c: TermCategory) => CATEGORIES.find(x => x.id === c)!.label;

/* ---------- 본문 자동 링크 ---------- */
export type Segment = { text: string; termId: string | null };

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const MATCHES = TERMS.flatMap(t => t.match.map(m => ({ m, id: t.id }))).sort((a, b) => b.m.length - a.m.length);
const MATCH_ID = new Map(MATCHES.map(x => [x.m, x.id] as const));
const PATTERN = new RegExp(MATCHES.map(x => escape(x.m)).join('|'), 'g');
const HANGUL = /[가-힣]/;
/** 짧은 한글 낱말이 다른 낱말 속에 묻혀 있거나, 다른 뜻으로 쓰인 자리인지 봅니다. */
function embedded(text: string, at: number, word: string, id: string) {
  if (word.length <= 2 && HANGUL.test(word) && at > 0 && HANGUL.test(text[at - 1])) return true;
  return (termById.get(id)!.skipAfter ?? []).some(p => text.slice(Math.max(0, at - p.length), at) === p);
}

/** 글을 조각으로 나눕니다. 같은 용어는 한 글에서 처음 한 번만 링크하고, 긴 표현을 먼저 찾습니다. */
export function linkTerms(text: string, already: Set<string> = new Set()): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  PATTERN.lastIndex = 0;
  for (let m = PATTERN.exec(text); m; m = PATTERN.exec(text)) {
    const id = MATCH_ID.get(m[0])!;
    if (already.has(id) || embedded(text, m.index, m[0], id)) continue;
    already.add(id);
    if (m.index > last) out.push({ text: text.slice(last, m.index), termId: null });
    out.push({ text: m[0], termId: id });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), termId: null });
  return out;
}
/** 여러 글에 나온 용어 id를 처음 나온 순서대로 모읍니다. */
export function termsIn(texts: string[]): string[] {
  const seen = new Set<string>();
  texts.forEach(t => linkTerms(t, seen));
  return [...seen];
}

/* ---------- 용어 퀴즈 ---------- */
export interface QuizQuestion { termId: string; options: { termId: string; text: string }[]; answer: number }

/** 표제어를 보고 알맞은 뜻을 고르는 문제를 만듭니다. 오답 보기는 가능하면 같은 분류에서 고릅니다. */
export function makeQuiz(rnd: () => number, count = 5, pool: string[] = TERMS.map(t => t.id)): QuizQuestion[] {
  const pick = <T,>(a: T[]) => a.splice(Math.floor(rnd() * a.length), 1)[0];
  const ids = pool.filter(id => termById.has(id));
  const out: QuizQuestion[] = [];
  while (out.length < count && ids.length) {
    const t = termById.get(pick(ids))!;
    const same = TERMS.filter(x => x.id !== t.id && x.category === t.category);
    const other = TERMS.filter(x => x.id !== t.id && x.category !== t.category);
    const wrong: Term[] = [];
    while (wrong.length < 3 && same.length) wrong.push(pick(same));
    while (wrong.length < 3 && other.length) wrong.push(pick(other));
    const options = [t, ...wrong].map(x => ({ termId: x.id, text: x.short }));
    for (let i = options.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [options[i], options[j]] = [options[j], options[i]]; }
    out.push({ termId: t.id, options, answer: options.findIndex(o => o.termId === t.id) });
  }
  return out;
}
