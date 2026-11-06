/* 시나리오 데이터. 서버 전용입니다. 클라이언트 번들에 들어가면 결말이 새므로 client에서 import하지 마세요.
   step = 공개 시점(사건 안에서 몇 번째 뉴스인지), requires = 직전 단계 결말이 이것일 때만 발생,
   signal = 헤드라인이 주는 인상(NPC 속보 추격형이 읽음), clueDir = 단서가 가리키는 방향(밸런스 검증용),
   weight = 결말 확률 가중치. beat = 시장 기대를 넘었는지. */
import type { StockCode } from '../../shared/types';

export interface Outcome {
  id: string; weight: number; beat: boolean; actual: string; gap: string; label: string;
  impacts: { code: StockCode; bp: number; reason: string }[];
}
export interface Stage {
  id: string; step: number; requires?: string[]; headline: string; facts: string; expectation: string;
  remaining: string; clue: string; targets: StockCode[]; signal: Partial<Record<StockCode, 1 | -1>>;
  clueDir: 1 | -1; concept: string; outcomes: Outcome[];
}
export interface Arc { id: string; title: string; stages: Stage[] }
export interface ChoiceCard { id: string; title: string; body: string; concept: string; condition: string; options: { key: 'A' | 'B'; label: string; feedback: string }[] }

export const ARCS: Arc[] = [
  { id: 'nuvakan', title: '누바칸 납품 사건', stages: [
    { id: 'nu-1', step: 1, targets: ['G01'], signal: { G01: 1 }, clueDir: 1, concept: '실증 결과는 납품 기대를 먼저 움직입니다.',
      headline: '누바칸, 소형 발전 모듈 실증 마지막 구간 진입', facts: '시험장 3곳 중 2곳에서 목표 출력을 달성했습니다.', expectation: '시장은 3곳 모두 통과를 기대합니다.', remaining: '혹한 구간인 마지막 시험장의 결과', clue: '마지막 시험장의 예비 측정값이 목표의 96%까지 올라왔습니다.',
      outcomes: [
        { id: 'pass', weight: 65, beat: true, actual: '3곳 모두 목표 출력 달성', gap: '기대 충족, 납품 일정이 앞당겨질 가능성', label: '실증 전 구간 통과', impacts: [{ code: 'G01', bp: 700, reason: '납품 불확실성이 줄어듦' }] },
        { id: 'fail', weight: 35, beat: false, actual: '마지막 시험장 출력 미달', gap: '기대한 3곳 통과에 1곳 부족', label: '마지막 시험장 미달', impacts: [{ code: 'G01', bp: -900, reason: '재시험으로 납품이 늦어질 우려' }] }
      ] },
    { id: 'nu-2a', step: 2, requires: ['pass'], targets: ['G01'], signal: { G01: 1 }, clueDir: -1, concept: '조사 일정이 길어지면 좋은 결과도 늦게 반영됩니다.',
      headline: '공공기관, 누바칸 납품 사전 조사 착수', facts: '실증 통과 후 품질 조사에 들어갔습니다.', expectation: '시장은 이번 분기 안에 승인될 것으로 봅니다.', remaining: '조사 기간과 추가 자료 요구 여부', clue: '조사 담당 부서가 “서류 보완 요청이 나갔다”고 확인했습니다.',
      outcomes: [
        { id: 'approved', weight: 35, beat: true, actual: '이번 분기 납품 승인', gap: '기대대로 일정 확정', label: '납품 승인 확정', impacts: [{ code: 'G01', bp: 600, reason: '매출 시점이 확정됨' }] },
        { id: 'delayed', weight: 65, beat: false, actual: '서류 보완으로 승인 다음 분기로 연기', gap: '기대보다 한 분기 늦음', label: '승인 일정 지연', impacts: [{ code: 'G01', bp: -450, reason: '매출 인식이 한 분기 밀림' }] }
      ] },
    { id: 'nu-2b', step: 2, requires: ['fail'], targets: ['G01'], signal: { G01: -1 }, clueDir: 1, concept: '악재의 크기를 확인하면 공포가 줄어들 수 있습니다.',
      headline: '누바칸, 마지막 시험장 재시험 일정 공시', facts: '방열 부품을 교체하고 재시험합니다.', expectation: '시장은 재시험도 실패할 수 있다고 걱정합니다.', remaining: '교체한 부품의 성능', clue: '부품 협력사가 교체 모듈의 사내 시험 합격 보고서를 냈습니다.',
      outcomes: [
        { id: 'retest-ok', weight: 65, beat: true, actual: '재시험 통과', gap: '걱정보다 좋은 결과', label: '재시험 통과', impacts: [{ code: 'G01', bp: 800, reason: '걱정이 걷히며 낙폭을 되돌림' }] },
        { id: 'retest-fail', weight: 35, beat: false, actual: '재시험 일부 항목 미달', gap: '걱정이 현실이 됨', label: '재시험 일부 미달', impacts: [{ code: 'G01', bp: -650, reason: '부품 교체 비용까지 부담' }] }
      ] },
    { id: 'nu-3a', step: 3, requires: ['approved', 'retest-ok'], targets: ['G01', 'G03'], signal: { G01: 1 }, clueDir: -1, concept: '좋은 뉴스도 기대보다 작으면 주가는 내릴 수 있습니다. 이를 기대 대비 실망이라고 합니다.',
      headline: '누바칸, 공공 납품 계약 공시 예정', facts: '계약 체결 자체는 확정되었습니다. 규모만 남았습니다.', expectation: '시장 기대치는 1만 대입니다.', remaining: '실제 계약 수량', clue: '부품 협력사의 출하 계획은 6천~7천 대 수준으로 알려졌습니다.',
      outcomes: [
        { id: 'big', weight: 20, beat: true, actual: '계약 1만 2천 대', gap: '기대보다 2천 대 많음', label: '기대를 넘은 계약 규모', impacts: [{ code: 'G01', bp: 1100, reason: '기대 1만 대를 20% 초과' }, { code: 'G03', bp: 100, reason: '모듈 운송 물량 증가' }] },
        { id: 'meet', weight: 25, beat: true, actual: '계약 1만 대', gap: '기대와 같음', label: '기대에 부합한 계약', impacts: [{ code: 'G01', bp: 150, reason: '이미 주가에 반영된 규모' }] },
        { id: 'short', weight: 55, beat: false, actual: '계약 6천 대', gap: '기대 1만 대보다 4천 대 적음', label: '기대에 못 미친 계약 규모', impacts: [{ code: 'G01', bp: -500, reason: '계약을 따냈지만 기대의 60%에 그침' }] }
      ] },
    { id: 'nu-3b', step: 3, requires: ['delayed', 'retest-fail'], targets: ['G01'], signal: { G01: -1 }, clueDir: 1, concept: '기대가 낮아진 뒤에는 작은 계약도 호재가 될 수 있습니다.',
      headline: '누바칸, 축소 납품안 협의 중', facts: '납품이 늦어져 물량을 나눠 계약하는 안이 논의됩니다.', expectation: '시장 기대치는 3천 대까지 낮아졌습니다.', remaining: '1차 계약 수량', clue: '공공기관 예산안에 약 4천 대 몫이 잡혔다는 자료가 공개됐습니다.',
      outcomes: [
        { id: 'small-beat', weight: 65, beat: true, actual: '1차 계약 4천 대', gap: '낮아진 기대보다 1천 대 많음', label: '낮아진 기대를 넘은 계약', impacts: [{ code: 'G01', bp: 700, reason: '기대치가 낮아서 작은 계약에도 안도' }] },
        { id: 'small-miss', weight: 35, beat: false, actual: '1차 계약 2천 대', gap: '기대보다 1천 대 적음', label: '낮아진 기대마저 하회', impacts: [{ code: 'G01', bp: -800, reason: '수요 자체를 의심하기 시작' }] }
      ] }
  ] },
  { id: 'heatwave', title: '폭염과 전기요금 사건', stages: [
    { id: 'heat-1', step: 1, targets: ['G03', 'G01'], signal: { G03: 1 }, clueDir: 1, concept: '같은 날씨도 업종마다 다르게 작용합니다.',
      headline: '폭염 경보 9일째, 냉장 운송 주문 급증', facts: '도르넴의 이번 주 운송 주문이 12% 늘었습니다.', expectation: '시장은 폭염이 일주일 안에 꺾인다고 봅니다.', remaining: '폭염이 이어지는 기간', clue: '기상청 중기 예보에 고기압이 2주 더 머문다는 전망이 실렸습니다.',
      outcomes: [
        { id: 'long', weight: 70, beat: true, actual: '폭염 2주 더 지속', gap: '기대보다 1주 이상 길어짐', label: '폭염 장기화', impacts: [{ code: 'G03', bp: 450, reason: '냉장 운송 수요 증가' }, { code: 'G01', bp: 250, reason: '정전 대비 소형 발전 수요 증가' }, { code: 'G05', bp: -200, reason: '야외 대기 행사 관객 감소' }] },
        { id: 'short', weight: 30, beat: false, actual: '주말에 폭염 해제', gap: '기대보다도 빨리 끝남', label: '폭염 조기 해제', impacts: [{ code: 'G03', bp: -650, reason: '늘려 둔 운송 차량이 놀게 됨' }, { code: 'G01', bp: -150, reason: '비상 전력 수요 감소' }] }
      ] },
    { id: 'heat-2', step: 2, targets: ['G03', 'G01', 'G06'], signal: { G03: 1, G01: 1 }, clueDir: -1, concept: '같은 전기요금 인상이 어떤 기업에는 비용이고 어떤 기업에는 기회입니다.',
      headline: '정부, 여름철 전기요금 조정안 심의', facts: '전력 수요 최고치를 경신해 요금 조정이 안건에 올랐습니다.', expectation: '시장 기대치는 5% 인상입니다.', remaining: '실제 인상 폭', clue: '담당 장관이 “서민 부담을 가장 먼저 고려한다”고 말했습니다.',
      outcomes: [
        { id: 'hike8', weight: 30, beat: true, actual: '전기요금 8% 인상', gap: '기대보다 3%p 높음', label: '기대보다 큰 전기요금 인상', impacts: [{ code: 'G03', bp: -750, reason: '냉동 창고 전력비로 마진 감소' }, { code: 'G01', bp: 900, reason: '자가 발전 모듈 수요 증가' }, { code: 'G06', bp: -150, reason: '정수 설비 운영비 증가' }] },
        { id: 'hike3', weight: 70, beat: false, actual: '전기요금 3% 인상', gap: '기대보다 2%p 낮음', label: '기대보다 작은 전기요금 인상', impacts: [{ code: 'G03', bp: 400, reason: '전력비 부담이 예상보다 적음' }, { code: 'G01', bp: -350, reason: '자가 발전 수요 기대 축소' }, { code: 'G06', bp: 100, reason: '운영비 부담 완화' }] }
      ] },
    { id: 'heat-3a', step: 3, requires: ['hike8'], targets: ['G03'], signal: { G03: -1 }, clueDir: 1, concept: '원가 상승을 가격에 넘길 수 있는 힘을 가격 결정력이라고 합니다.',
      headline: '도르넴, 대형 유통사와 운임 재협상', facts: '전기요금 인상분을 운임에 반영하자고 제안했습니다.', expectation: '시장은 협상이 실패해 마진이 줄 것으로 봅니다.', remaining: '운임 인상 수용 여부', clue: '경쟁 운송사 2곳이 이미 할증료를 받기 시작했습니다.',
      outcomes: [
        { id: 'passed', weight: 65, beat: true, actual: '운임 6% 인상 합의', gap: '기대보다 좋음', label: '전력비 운임 전가 성공', impacts: [{ code: 'G03', bp: 800, reason: '비용을 고객에게 전가함' }] },
        { id: 'blocked', weight: 35, beat: false, actual: '운임 동결', gap: '우려한 대로 마진 감소', label: '운임 인상 실패', impacts: [{ code: 'G03', bp: -500, reason: '비용을 혼자 떠안음' }] }
      ] },
    { id: 'heat-3b', step: 3, requires: ['hike3'], targets: ['G01', 'G03'], signal: { G01: -1, G03: 1 }, clueDir: 1, concept: '주문 잔고는 뉴스보다 늦게 실적으로 나타납니다.',
      headline: '누바칸, 여름철 모듈 주문 잔고 공개 예정', facts: '인상 폭이 작아 수요 둔화 우려가 나옵니다.', expectation: '시장은 주문이 전년과 비슷하다고 봅니다.', remaining: '실제 주문 잔고', clue: '설치 업체 커뮤니티에 “모듈 납기가 6주까지 밀렸다”는 글이 이어집니다.',
      outcomes: [
        { id: 'backlog', weight: 65, beat: true, actual: '주문 잔고 전년 대비 30% 증가', gap: '기대보다 많음', label: '주문 잔고 예상 상회', impacts: [{ code: 'G01', bp: 700, reason: '정전 대비 수요가 요금과 무관하게 강함' }, { code: 'G03', bp: 100, reason: '모듈 운송 수요 소폭 증가' }] },
        { id: 'flat', weight: 35, beat: false, actual: '주문 잔고 전년 수준', gap: '기대와 같거나 약간 낮음', label: '주문 잔고 정체', impacts: [{ code: 'G01', bp: -450, reason: '성장 기대가 약해짐' }] }
      ] }
  ] },
  { id: 'semorium', title: '세모륨 양산 사건', stages: [
    { id: 'semo-1', step: 1, targets: ['G02'], signal: { G02: 1 }, clueDir: -1, concept: '시험실 성능과 양산 수율은 다릅니다.',
      headline: '세모륨, 신형 열전지 시험 생산 시작', facts: '시험 라인 가동에 들어갔습니다.', expectation: '시장 기대 수율은 70%입니다.', remaining: '첫 생산분의 실제 수율', clue: '현장 관계자가 “첫 주에 코팅 불량이 잦았다”고 전했습니다.',
      outcomes: [
        { id: 'y78', weight: 30, beat: true, actual: '수율 78%', gap: '기대보다 8%p 높음', label: '기대를 넘은 수율', impacts: [{ code: 'G02', bp: 1200, reason: '단위 원가가 예상보다 낮아짐' }] },
        { id: 'y58', weight: 70, beat: false, actual: '수율 58%', gap: '기대보다 12%p 낮음', label: '기대에 못 미친 수율', impacts: [{ code: 'G02', bp: -700, reason: '양산 시점이 늦어질 수 있음' }] }
      ] },
    { id: 'semo-2a', step: 2, requires: ['y78'], targets: ['G02', 'G01'], signal: { G02: 1 }, clueDir: 1, concept: '고객 샘플 평가는 실제 수요를 확인하는 단계입니다.',
      headline: '세모륨, 대형 고객사 샘플 평가 돌입', facts: '좋은 수율 덕분에 샘플을 앞당겨 보냈습니다.', expectation: '시장은 평가 통과를 절반 정도로 봅니다.', remaining: '내열 평가 결과', clue: '고객사가 평가 인력을 늘리고 추가 샘플을 요청했습니다.',
      outcomes: [
        { id: 'sample-ok', weight: 70, beat: true, actual: '샘플 평가 통과', gap: '기대보다 좋음', label: '고객사 평가 통과', impacts: [{ code: 'G02', bp: 900, reason: '첫 대형 매출 가능성' }, { code: 'G01', bp: -150, reason: '저장 장치 경쟁 부담' }] },
        { id: 'sample-no', weight: 30, beat: false, actual: '내열 항목 재평가', gap: '기대보다 늦어짐', label: '고객사 재평가', impacts: [{ code: 'G02', bp: -600, reason: '매출 시점이 밀림' }] }
      ] },
    { id: 'semo-2b', step: 2, requires: ['y58'], targets: ['G02'], signal: { G02: -1 }, clueDir: 1, concept: '문제의 원인이 확인되면 불확실성이 줄어듭니다.',
      headline: '세모륨, 불량 원인 조사 결과 발표', facts: '코팅 공정을 조사했습니다.', expectation: '시장은 설계 결함일까 걱정합니다.', remaining: '불량의 원인', clue: '경쟁사 출신 엔지니어가 “건조 온도 문제로 보인다”고 분석했습니다.',
      outcomes: [
        { id: 'fixable', weight: 70, beat: true, actual: '건조 온도 조정으로 해결 가능', gap: '걱정보다 작은 문제', label: '불량 원인 해결 가능', impacts: [{ code: 'G02', bp: 800, reason: '설계 결함 우려 해소' }] },
        { id: 'design', weight: 30, beat: false, actual: '전극 설계 변경 필요', gap: '걱정이 사실로 드러남', label: '설계 변경 필요', impacts: [{ code: 'G02', bp: -1000, reason: '양산이 1년 늦어질 수 있음' }] }
      ] },
    { id: 'semo-3', step: 3, targets: ['G02'], signal: { G02: 1 }, clueDir: -1, concept: '투자 규모가 크면 자금 조달 방식까지 봐야 합니다.',
      headline: '세모륨, 양산 공장 투자 계획 발표', facts: '이사회가 양산 공장 안건을 올렸습니다.', expectation: '시장은 자체 자금 투자로 기대합니다.', remaining: '자금 조달 방식', clue: '주관사 선정 공고가 나와 신주 발행 가능성이 거론됩니다.',
      outcomes: [
        { id: 'cash', weight: 30, beat: true, actual: '보유 현금과 장기 대출로 투자', gap: '기대대로 주식 수 유지', label: '자체 자금 투자', impacts: [{ code: 'G02', bp: 700, reason: '기존 주주 지분이 유지됨' }] },
        { id: 'dilution', weight: 70, beat: false, actual: '대규모 신주 발행', gap: '기대와 달리 주식 수 20% 증가', label: '신주 발행으로 지분 희석', impacts: [{ code: 'G02', bp: -600, reason: '주당 가치가 희석됨' }] }
      ] }
  ] },
  { id: 'avotune', title: '아보튠 품질 사건', stages: [
    { id: 'avo-1', step: 1, targets: ['G04'], signal: { G04: -1 }, clueDir: 1, concept: '조사 착수와 위반 확정은 다릅니다.',
      headline: '아보튠 배양 원료, 품질 검사 대상 선정', facts: '정기 검사 대상 12곳에 포함됐습니다.', expectation: '시장은 위반이 나올까 걱정합니다.', remaining: '검사 결과', clue: '아보튠은 최근 3년 검사에서 지적을 받은 적이 없습니다.',
      outcomes: [
        { id: 'clean', weight: 75, beat: true, actual: '전 항목 적합', gap: '걱정보다 좋음', label: '품질 검사 전 항목 적합', impacts: [{ code: 'G04', bp: 500, reason: '납품 차질 우려 해소' }] },
        { id: 'flag', weight: 25, beat: false, actual: '보관 온도 1건 시정 명령', gap: '걱정이 일부 현실화', label: '보관 온도 시정 명령', impacts: [{ code: 'G04', bp: -900, reason: '일부 출하가 일시 중단됨' }] }
      ] },
    { id: 'avo-2', step: 2, targets: ['G04'], signal: { G04: 1 }, clueDir: -1, concept: '규격 변경은 먼저 맞춘 기업에 유리합니다.',
      headline: '업계 신규 납품 규격 발표 예정', facts: '배양 원료 순도 기준이 강화됩니다.', expectation: '시장은 아보튠이 수혜를 받는다고 봅니다.', remaining: '적용 시기와 유예 기간', clue: '중소 업체 단체가 2년 유예를 요청했고 정부가 “충분히 듣겠다”고 답했습니다.',
      outcomes: [
        { id: 'fast', weight: 30, beat: true, actual: '6개월 뒤 바로 적용', gap: '기대보다 빠름', label: '신규 규격 조기 적용', impacts: [{ code: 'G04', bp: 900, reason: '기준을 맞춘 소수 업체로 주문 집중' }] },
        { id: 'slow', weight: 70, beat: false, actual: '2년 유예', gap: '기대보다 늦음', label: '신규 규격 2년 유예', impacts: [{ code: 'G04', bp: -450, reason: '수혜 시점이 뒤로 밀림' }] }
      ] },
    { id: 'avo-3a', step: 3, requires: ['fast'], targets: ['G04'], signal: { G04: 1 }, clueDir: 1, concept: '공장 가동률은 매출로 이어지는 마지막 관문입니다.',
      headline: '아보튠 신공장, 재가동 시험 진행', facts: '규격 대응 설비를 갖췄습니다.', expectation: '시장은 다음 달 가동을 예상합니다.', remaining: '시험 가동 결과', clue: '공장 인근 물류 업체가 이번 달 원료 입고 계약을 맺었습니다.',
      outcomes: [
        { id: 'run', weight: 70, beat: true, actual: '이번 달 정상 가동', gap: '기대보다 빠름', label: '신공장 조기 가동', impacts: [{ code: 'G04', bp: 800, reason: '신규 물량 조기 납품' }, { code: 'G03', bp: 150, reason: '저온 운송 계약 증가' }] },
        { id: 'stop', weight: 30, beat: false, actual: '오염 경보로 가동 2주 연기', gap: '기대보다 늦음', label: '신공장 가동 연기', impacts: [{ code: 'G04', bp: -700, reason: '납품 약속에 차질' }] }
      ] },
    { id: 'avo-3b', step: 3, requires: ['slow'], targets: ['G04'], signal: { G04: -1 }, clueDir: 1, concept: '단기 악재 뒤에도 장기 계약이 주가를 받칠 수 있습니다.',
      headline: '아보튠, 해외 고객 장기 공급 협상', facts: '국내 규격 유예로 해외 시장을 찾고 있습니다.', expectation: '시장은 기대를 낮췄습니다.', remaining: '협상 타결 여부', clue: '해외 고객사 대표단이 공장을 두 번째로 방문했습니다.',
      outcomes: [
        { id: 'deal', weight: 70, beat: true, actual: '3년 공급 계약 체결', gap: '낮아진 기대를 넘음', label: '해외 장기 계약 체결', impacts: [{ code: 'G04', bp: 800, reason: '국내 지연을 해외 매출로 메움' }] },
        { id: 'nodeal', weight: 30, beat: false, actual: '협상 결렬', gap: '남은 기대마저 사라짐', label: '해외 협상 결렬', impacts: [{ code: 'G04', bp: -600, reason: '하반기 매출 공백' }] }
      ] }
  ] },
  { id: 'pinovec', title: '피노벡 공연 사건', stages: [
    { id: 'pino-1', step: 1, targets: ['G05'], signal: { G05: 1 }, clueDir: 1, concept: '선행 지표인 예약률은 실적을 미리 보여 줍니다.',
      headline: '피노벡 소리극장, 대형 음향 페스티벌 예매 시작', facts: '30분 만에 1회차 좌석이 매진됐습니다.', expectation: '시장 기대 전체 예약률은 70%입니다.', remaining: '전체 회차의 예약률', clue: '2회차 이후 대기 인원이 정원의 두 배를 넘었습니다.',
      outcomes: [
        { id: 'r92', weight: 70, beat: true, actual: '전체 예약률 92%', gap: '기대보다 22%p 높음', label: '기대를 넘은 예약률', impacts: [{ code: 'G05', bp: 800, reason: '티켓 매출 전망 상향' }] },
        { id: 'r60', weight: 30, beat: false, actual: '전체 예약률 60%', gap: '기대보다 10%p 낮음', label: '기대에 못 미친 예약률', impacts: [{ code: 'G05', bp: -700, reason: '1회차만 인기 있었음' }] }
      ] },
    { id: 'pino-2', step: 2, targets: ['G05'], signal: { G05: -1 }, clueDir: -1, concept: '보험과 환불 규정은 악재의 크기를 결정합니다.',
      headline: '페스티벌 기간 태풍 북상 소식', facts: '주말 공연 일정에 태풍 경로가 겹칩니다.', expectation: '시장은 하루 취소를 예상합니다.', remaining: '실제 취소 일수', clue: '기상청이 태풍 속도가 느려졌다고 예보했고, 지역 축제들도 줄줄이 취소를 검토합니다.',
      outcomes: [
        { id: 'one', weight: 30, beat: true, actual: '공연 하루만 연기', gap: '기대와 같거나 조금 좋음', label: '공연 하루 연기', impacts: [{ code: 'G05', bp: 400, reason: '티켓 환불이 거의 없음' }] },
        { id: 'three', weight: 70, beat: false, actual: '공연 3일 취소', gap: '기대보다 이틀 더 취소', label: '기대보다 긴 공연 취소', impacts: [{ code: 'G05', bp: -950, reason: '환불과 대관료가 함께 발생' }] }
      ] },
    { id: 'pino-3', step: 3, targets: ['G05'], signal: { G05: 1 }, clueDir: 1, concept: '이벤트 매출과 반복 매출은 가치 평가가 다릅니다.',
      headline: '피노벡, 상설 체험관 확대 발표', facts: '전국 5곳에 상설 음향 체험관을 낼 계획입니다.', expectation: '시장은 임차 비용 부담을 걱정합니다.', remaining: '시범 지점의 재방문율', clue: '시범 지점 회원권 재구매 비율이 공개 자료에서 40%를 넘었습니다.',
      outcomes: [
        { id: 'repeat', weight: 70, beat: true, actual: '재방문율 45%', gap: '기대를 넘는 반복 수요', label: '높은 재방문율', impacts: [{ code: 'G05', bp: 700, reason: '일회성 매출이 반복 매출로 바뀜' }] },
        { id: 'oneoff', weight: 30, beat: false, actual: '재방문율 15%', gap: '기대에 크게 못 미침', label: '낮은 재방문율', impacts: [{ code: 'G05', bp: -600, reason: '확장 비용을 회수하기 어려움' }] }
      ] }
  ] },
  { id: 'tarmel', title: '타르멜 가뭄 사건', stages: [
    { id: 'tar-1', step: 1, targets: ['G06', 'G04'], signal: { G06: 1 }, clueDir: 1, concept: '방어주는 평소 조용하다가 특정 수요에 반응합니다.',
      headline: '남부 지방 가뭄 경보, 물 재이용 설비 문의 증가', facts: '지자체 3곳이 설비 도입을 검토합니다.', expectation: '시장은 올해 발주를 2곳으로 봅니다.', remaining: '실제 발주 규모', clue: '지자체 추가 경정 예산안에 재이용 설비 항목이 신설됐습니다.',
      outcomes: [
        { id: 'order', weight: 70, beat: true, actual: '5곳 발주 확정', gap: '기대보다 3곳 많음', label: '기대 넘는 가뭄 발주', impacts: [{ code: 'G06', bp: 650, reason: '설비 수주 증가' }, { code: 'G04', bp: -150, reason: '배양 공정 용수비 상승' }] },
        { id: 'rain', weight: 30, beat: false, actual: '비 소식에 발주 보류', gap: '기대보다 적음', label: '가뭄 해소로 발주 보류', impacts: [{ code: 'G06', bp: -400, reason: '발주 시점이 밀림' }, { code: 'G04', bp: 100, reason: '용수 비용 부담 완화' }] }
      ] },
    { id: 'tar-2', step: 2, targets: ['G06'], signal: { G06: 1 }, clueDir: -1, concept: '입찰 경쟁이 치열하면 매출이 늘어도 이익은 줄 수 있습니다.',
      headline: '타르멜, 대형 공단 물 재이용 입찰 참여', facts: '국내 3개사가 경쟁합니다.', expectation: '시장은 타르멜이 높은 마진으로 수주한다고 봅니다.', remaining: '수주 여부와 낙찰가', clue: '경쟁사가 최근 다른 입찰에서 예정가의 70%를 써냈습니다.',
      outcomes: [
        { id: 'win', weight: 30, beat: true, actual: '예정가의 92%로 수주', gap: '기대대로 좋은 마진', label: '좋은 가격에 입찰 성공', impacts: [{ code: 'G06', bp: 700, reason: '수익성이 좋은 장기 계약' }] },
        { id: 'lowball', weight: 70, beat: false, actual: '예정가의 72%로 수주', gap: '수주는 했지만 마진이 기대의 절반', label: '저가 수주로 마진 감소', impacts: [{ code: 'G06', bp: -350, reason: '이겼지만 남는 것이 적음' }] }
      ] },
    { id: 'tar-3', step: 3, targets: ['G06', 'G02'], signal: { G06: -1 }, clueDir: 1, concept: '장기 계약은 경기가 나빠도 이익을 지켜 줍니다.',
      headline: '타르멜, 설비 관리 장기 계약 재협상', facts: '최대 고객 계약이 올해 끝납니다.', expectation: '시장은 해지 위험을 걱정합니다.', remaining: '재계약 조건', clue: '고객사 공시에 “기존 설비 연장 사용” 계획이 담겼습니다.',
      outcomes: [
        { id: 'renew', weight: 70, beat: true, actual: '10년 재계약', gap: '걱정보다 좋음', label: '10년 관리 계약 갱신', impacts: [{ code: 'G06', bp: 600, reason: '안정 매출이 확정됨' }] },
        { id: 'end', weight: 30, beat: false, actual: '계약 종료 통보', gap: '걱정이 현실화', label: '최대 고객 계약 종료', impacts: [{ code: 'G06', bp: -800, reason: '매출의 15%가 사라짐' }, { code: 'G02', bp: 100, reason: '고객사가 열 저장 설비로 전환 검토' }] }
      ] }
  ] },
  { id: 'rate', title: '금리 결정 사건', stages: [
    { id: 'rate-1', step: 1, targets: ['G02', 'G01', 'G06'], signal: { G02: -1 }, clueDir: -1, concept: '금리가 오르면 미래 이익에 기대는 성장주가 먼저 흔들립니다.',
      headline: '중앙은행 금리 결정 회의 시작', facts: '물가 상승률이 3개월째 목표를 넘었습니다.', expectation: '시장 기대치는 0.25%p 인상입니다.', remaining: '실제 인상 폭', clue: '총재가 전날 “필요하면 더 과감히 움직인다”고 말했습니다.',
      outcomes: [
        { id: 'r50', weight: 65, beat: false, actual: '0.5%p 인상', gap: '기대보다 0.25%p 큼', label: '기대보다 큰 금리 인상', impacts: [{ code: 'G02', bp: -700, reason: '먼 미래 이익의 현재 가치 감소' }, { code: 'G01', bp: -300, reason: '설비 할부 수요 감소' }, { code: 'G06', bp: 150, reason: '안정 현금 흐름 선호' }] },
        { id: 'r0', weight: 35, beat: true, actual: '동결', gap: '기대보다 완화적', label: '깜짝 금리 동결', impacts: [{ code: 'G02', bp: 900, reason: '성장주 자금 조달 부담 완화' }, { code: 'G01', bp: 400, reason: '설비 투자 심리 개선' }, { code: 'G06', bp: -100, reason: '방어주 선호 약화' }] }
      ] },
    { id: 'rate-2', step: 2, targets: ['G05', 'G03'], signal: { G05: -1 }, clueDir: 1, concept: '소비 지표는 금리 인상의 영향을 늦게 보여 줍니다.',
      headline: '월간 소비 지표 발표 임박', facts: '카드 사용액 속보치가 공개됩니다.', expectation: '시장은 소비 둔화를 예상합니다.', remaining: '여가 소비 지표', clue: '주요 공연장과 놀이시설의 예약 데이터가 전년보다 8% 높습니다.',
      outcomes: [
        { id: 'strong', weight: 70, beat: true, actual: '여가 소비 6% 증가', gap: '기대보다 좋음', label: '여가 소비 예상 상회', impacts: [{ code: 'G05', bp: 700, reason: '체험 소비가 견조함' }, { code: 'G03', bp: 200, reason: '신선 식품 물동량 증가' }] },
        { id: 'weak', weight: 30, beat: false, actual: '여가 소비 3% 감소', gap: '기대보다도 나쁨', label: '여가 소비 위축', impacts: [{ code: 'G05', bp: -650, reason: '티켓 수요 감소' }, { code: 'G03', bp: -150, reason: '운송 물동량 감소' }] }
      ] },
    { id: 'rate-3', step: 3, targets: ['G04', 'G02'], signal: { G04: 1, G02: 1 }, clueDir: -1, concept: '정책 지원 소식은 실제 예산이 붙어야 효과가 있습니다.',
      headline: '정부, 신산업 지원 예산 발표', facts: '소재와 에너지 분야 지원안이 공개됩니다.', expectation: '시장은 1조 원 규모를 기대합니다.', remaining: '실제 예산 규모', clue: '재정 당국이 “내년 지출을 강하게 조정한다”고 밝혔습니다.',
      outcomes: [
        { id: 'large', weight: 30, beat: true, actual: '1조 5천억 원 편성', gap: '기대보다 5천억 원 많음', label: '기대를 넘은 지원 예산', impacts: [{ code: 'G04', bp: 800, reason: '배양 소재 연구비 증가' }, { code: 'G02', bp: 800, reason: '실증 비용 지원' }] },
        { id: 'small', weight: 70, beat: false, actual: '4천억 원 편성', gap: '기대의 40%', label: '기대에 못 미친 지원 예산', impacts: [{ code: 'G04', bp: -400, reason: '수혜 기대 축소' }, { code: 'G02', bp: -400, reason: '실증 자금 계획 차질' }] }
      ] }
  ] }
];

export const CARDS: ChoiceCard[] = [
  { id: 'leading', title: '단톡방 초대가 왔습니다', body: '“VIP 리딩방, 수익률 300% 보장! 가입비는 오늘까지만 받습니다.”', concept: '유사투자자문 사기', condition: '주문 시간 중 공개', options: [
    { key: 'A', label: '일단 들어가 본다', feedback: '수익을 보장한다는 말 자체가 불법 신호입니다. 금융당국에 등록된 업체인지 먼저 확인해야 합니다.' },
    { key: 'B', label: '차단하고 신고한다', feedback: '좋은 판단입니다. 보장된 수익을 파는 곳은 수익이 아니라 가입비로 돈을 법니다.' } ] },
  { id: 'insider', title: '삼촌에게 전화가 왔습니다', body: '상장사 임원인 삼촌이 “곧 우리 회사에 큰 공시가 나와. 어디인지 알려 줄까?”라고 합니다.', concept: '미공개 중요 정보', condition: '주문 시간 중 공개', options: [
    { key: 'A', label: '알려 달라고 한다', feedback: '공시 전 내부 정보로 거래하면 자본시장법 위반입니다. 전해 들은 사람도 처벌받을 수 있습니다.' },
    { key: 'B', label: '듣지 않겠다고 한다', feedback: '좋은 판단입니다. 모두가 같은 정보를 볼 때 시장이 공정해집니다.' } ] },
  { id: 'loan', title: '증권사에서 문자가 왔습니다', body: '“신용 한도가 열렸습니다. 지금 빌려서 더 사세요!”', concept: '레버리지와 반대매매', condition: '주문 시간 중 공개', options: [
    { key: 'A', label: '빌리고 싶다', feedback: '빌려 투자하면 손실도 커집니다. 담보가 부족해지면 내 뜻과 상관없이 주식이 팔리는 반대매매가 일어납니다.' },
    { key: 'B', label: '내 돈으로만 한다', feedback: '감당할 수 있는 만큼만 투자하면 하락장에서도 버틸 수 있습니다.' } ] },
  { id: 'fomo', title: '단톡방이 난리입니다', body: '“다들 이미 샀대. 너만 없어!” 어떤 종목인지도 잘 모르겠습니다.', concept: '군집 행동', condition: '주문 시간 중 공개', options: [
    { key: 'A', label: '나도 따라 사야겠다', feedback: '남들이 샀다는 이유만으로 사면 이미 오른 가격에 들어가기 쉽습니다.' },
    { key: 'B', label: '내 판단대로 한다', feedback: '근거를 먼저 확인하는 습관이 군집 행동을 줄여 줍니다.' } ] },
  { id: 'panic', title: '내 계좌가 파랗습니다', body: '방금 뉴스에 가슴이 철렁합니다. 일단 전부 팔고 싶습니다.', concept: '손실 회피', condition: '주문 시간 중 공개', options: [
    { key: 'A', label: '우선 다 팔고 싶다', feedback: '사람은 이익의 기쁨보다 손실의 고통을 더 크게 느낍니다. 공포로 판 뒤에 수수료만 낼 수도 있습니다.' },
    { key: 'B', label: '살 때의 이유를 다시 본다', feedback: '근거가 바뀌었는지 보면 감정과 판단을 나눌 수 있습니다.' } ] },
  { id: 'allin', title: '확신이 드는 종목이 생겼습니다', body: '“이번엔 진짜다.” 한 종목에 전부 넣고 싶습니다.', concept: '분산 투자', condition: '주문 시간 중 공개', options: [
    { key: 'A', label: '전부 넣고 싶다', feedback: '확신이 맞으면 크게 벌지만, 사건 하나로 계좌가 크게 흔들립니다.' },
    { key: 'B', label: '나눠서 담겠다', feedback: '서로 다른 사건에 반응하는 종목을 섞으면 위험을 줄일 수 있습니다.' } ] }
];

export const stageById = new Map(ARCS.flatMap(a => a.stages.map(s => [s.id, s] as const)));
export const arcOfStage = new Map(ARCS.flatMap(a => a.stages.map(s => [s.id, a] as const)));
export const cardById = new Map(CARDS.map(c => [c.id, c] as const));
