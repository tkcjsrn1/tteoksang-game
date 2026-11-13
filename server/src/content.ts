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
        { id: 'pass', weight: 65, beat: true, actual: '3곳 모두 목표 출력 달성', gap: '기대 충족, 납품 일정이 앞당겨질 가능성', label: '실증 전 구간 통과', impacts: [{ code: 'G01', bp: 500, reason: '납품 불확실성이 줄었지만, 통과 기대가 이미 주가에 반영돼 오름 폭은 제한' }] },
        { id: 'fail', weight: 35, beat: false, actual: '마지막 시험장 출력 미달', gap: '기대한 3곳 통과에 1곳 부족', label: '마지막 시험장 미달', impacts: [{ code: 'G01', bp: -850, reason: '재시험으로 납품이 늦어질 우려' }] }
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
        { id: 'long', weight: 70, beat: true, actual: '폭염 2주 더 지속', gap: '기대보다 1주 이상 길어짐', label: '폭염 장기화', impacts: [{ code: 'G03', bp: 350, reason: '냉장 운송 수요 증가. 주문 급증 소식에 이미 일부 반영됨' }, { code: 'G01', bp: 250, reason: '정전 대비 소형 발전 수요 증가' }, { code: 'G05', bp: -200, reason: '야외 대기 행사 관객 감소' }] },
        { id: 'short', weight: 30, beat: false, actual: '주말에 폭염 해제', gap: '기대보다도 빨리 끝남', label: '폭염 조기 해제', impacts: [{ code: 'G03', bp: -750, reason: '늘려 둔 운송 차량이 놀게 됨' }, { code: 'G01', bp: -150, reason: '비상 전력 수요 감소' }] }
      ] },
    { id: 'heat-2', step: 2, targets: ['G03', 'G01', 'G06'], signal: { G03: -1, G01: 1 }, clueDir: 1, concept: '같은 전기요금 인상이 어떤 기업에는 비용이고 어떤 기업에는 기회입니다.',
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
        { id: 'sample-ok', weight: 70, beat: true, actual: '샘플 평가 통과', gap: '기대보다 좋음', label: '고객사 평가 통과', impacts: [{ code: 'G02', bp: 600, reason: '첫 대형 매출 가능성. 좋은 수율 뒤라 기대가 이미 높았음' }, { code: 'G01', bp: -150, reason: '저장 장치 경쟁 부담' }] },
        { id: 'sample-no', weight: 30, beat: false, actual: '내열 항목 재평가', gap: '기대보다 늦어짐', label: '고객사 재평가', impacts: [{ code: 'G02', bp: -800, reason: '높아진 기대만큼 실망도 큼' }] }
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
        { id: 'run', weight: 70, beat: true, actual: '이번 달 정상 가동', gap: '기대보다 빠름', label: '신공장 조기 가동', impacts: [{ code: 'G04', bp: 550, reason: '신규 물량 조기 납품. 정상 가동은 시장이 이미 예상한 일' }, { code: 'G03', bp: 150, reason: '저온 운송 계약 증가' }] },
        { id: 'stop', weight: 30, beat: false, actual: '오염 경보로 가동 2주 연기', gap: '기대보다 늦음', label: '신공장 가동 연기', impacts: [{ code: 'G04', bp: -900, reason: '납품 약속에 차질' }] }
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
        { id: 'r92', weight: 70, beat: true, actual: '전체 예약률 92%', gap: '기대보다 22%p 높음', label: '기대를 넘은 예약률', impacts: [{ code: 'G05', bp: 550, reason: '티켓 매출 전망 상향. 1회차 매진으로 기대가 먼저 올라 있었음' }] },
        { id: 'r60', weight: 30, beat: false, actual: '전체 예약률 60%', gap: '기대보다 10%p 낮음', label: '기대에 못 미친 예약률', impacts: [{ code: 'G05', bp: -900, reason: '1회차만 인기 있었음' }] }
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
        { id: 'repeat', weight: 70, beat: true, actual: '재방문율 45%', gap: '기대를 넘는 반복 수요', label: '높은 재방문율', impacts: [{ code: 'G05', bp: 500, reason: '일회성 매출이 반복 매출로 바뀜' }] },
        { id: 'oneoff', weight: 30, beat: false, actual: '재방문율 15%', gap: '기대에 크게 못 미침', label: '낮은 재방문율', impacts: [{ code: 'G05', bp: -850, reason: '확장 비용을 회수하기 어려움' }] }
      ] }
  ] },
  { id: 'tarmel', title: '타르멜 가뭄 사건', stages: [
    { id: 'tar-1', step: 1, targets: ['G06', 'G04'], signal: { G06: 1 }, clueDir: 1, concept: '방어주는 평소 조용하다가 특정 수요에 반응합니다.',
      headline: '남부 지방 가뭄 경보, 물 재이용 설비 문의 증가', facts: '지자체 3곳이 설비 도입을 검토합니다.', expectation: '시장은 올해 발주를 2곳으로 봅니다.', remaining: '실제 발주 규모', clue: '지자체 추가 경정 예산안에 재이용 설비 항목이 신설됐습니다.',
      outcomes: [
        { id: 'order', weight: 70, beat: true, actual: '5곳 발주 확정', gap: '기대보다 3곳 많음', label: '기대 넘는 가뭄 발주', impacts: [{ code: 'G06', bp: 450, reason: '설비 수주 증가. 문의 급증 소식에 기대가 먼저 반영됨' }, { code: 'G04', bp: -150, reason: '배양 공정 용수비 상승' }] },
        { id: 'rain', weight: 30, beat: false, actual: '비 소식에 발주 보류', gap: '기대보다 적음', label: '가뭄 해소로 발주 보류', impacts: [{ code: 'G06', bp: -650, reason: '기대했던 발주가 통째로 밀림' }, { code: 'G04', bp: 100, reason: '용수 비용 부담 완화' }] }
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
  ] },
  { id: 'rumor', title: '누바칸 인수설 사건', stages: [
    { id: 'rumor-1', step: 1, targets: ['G01'], signal: { G01: 1 }, clueDir: -1, concept: '공시로 확인되기 전까지 소문은 소문입니다. 풍문이 돌면 거래소가 조회공시로 회사에 사실 여부를 묻습니다.',
      headline: '“누바칸, 대기업에 팔린다더라” 커뮤니티 글 확산', facts: '출처 없는 글이 투자 커뮤니티에 퍼졌고, 거래소가 누바칸에 조회공시를 요구했습니다.', expectation: '시장 일부는 인수 프리미엄을 기대합니다.', remaining: '회사의 공식 답변', clue: '누바칸 대표가 지난주 인터뷰에서 “매각보다 독자 성장에 집중한다”고 말했습니다.',
      outcomes: [
        { id: 'deny', weight: 65, beat: false, actual: '회사 “사실무근” 답변 공시', gap: '기대한 인수설이 공식 부인됨', label: '인수설 공식 부인', impacts: [{ code: 'G01', bp: -700, reason: '소문으로 기대한 몫이 빠짐' }] },
        { id: 'review', weight: 35, beat: true, actual: '“매각을 검토 중이나 확정된 바 없다” 답변 공시', gap: '소문 일부가 사실로 확인됨', label: '매각 검토 사실 확인', impacts: [{ code: 'G01', bp: 600, reason: '인수 프리미엄 기대' }] }
      ] },
    { id: 'rumor-2a', step: 2, requires: ['deny'], targets: ['G01'], signal: { G01: -1 }, clueDir: 1, concept: '소문으로 출렁인 주가는 결국 실적으로 돌아옵니다.',
      headline: '누바칸, 허위 글 게시자 금융당국에 신고', facts: '회사가 근거 없는 인수설을 퍼뜨린 계정을 신고했습니다.', expectation: '시장은 실망 매물이 더 나올까 걱정합니다.', remaining: '분기 실적에서 본업이 탄탄한지', clue: '부품 협력사가 이번 분기 누바칸 납품 물량을 20% 늘렸다고 밝혔습니다.',
      outcomes: [
        { id: 'solid', weight: 65, beat: true, actual: '분기 매출 15% 증가', gap: '걱정보다 좋은 본업', label: '본업 실적 호조', impacts: [{ code: 'G01', bp: 600, reason: '소문이 걷히고 본업이 주목받음' }] },
        { id: 'weak', weight: 35, beat: false, actual: '분기 매출 정체', gap: '기댈 재료가 사라짐', label: '본업 실적 정체', impacts: [{ code: 'G01', bp: -450, reason: '소문도 실적도 없는 상황' }] }
      ] },
    { id: 'rumor-2b', step: 2, requires: ['review'], targets: ['G01'], signal: { G01: 1 }, clueDir: -1, concept: '인수·합병(M&A) 기대는 가격이 정해지기 전까지 기대일 뿐입니다.',
      headline: '누바칸 인수 후보로 대형 에너지 기업 거론', facts: '회사가 매각을 검토 중이라고 밝힌 뒤 인수 후보가 거론됩니다.', expectation: '시장은 주당 1만 6천 원 수준의 인수가를 기대합니다.', remaining: '실제 인수 제안 가격', clue: '유력 후보 회사가 “가격이 맞지 않으면 빠지겠다”고 말했습니다.',
      outcomes: [
        { id: 'premium', weight: 30, beat: true, actual: '주당 1만 7천 원 인수 제안', gap: '기대보다 1천 원 높은 인수가', label: '기대 넘는 인수 제안', impacts: [{ code: 'G01', bp: 900, reason: '인수 프리미엄 확정에 가까워짐' }] },
        { id: 'walkaway', weight: 70, beat: false, actual: '인수 후보가 협상 중단', gap: '기대한 인수가가 사라짐', label: '인수 협상 중단', impacts: [{ code: 'G01', bp: -800, reason: '인수 프리미엄 기대가 사라짐' }] }
      ] },
    { id: 'rumor-3', step: 3, targets: ['G01'], signal: { G01: 1 }, clueDir: 1, concept: '기대가 낮아진 뒤 나온 새 재료는 작아도 주가를 움직입니다.',
      headline: '누바칸, 소동 이후 첫 기업설명회(IR) 개최', facts: '경영진이 사업 계획을 직접 설명합니다.', expectation: '시장은 새로운 내용이 없을 것으로 봅니다.', remaining: '새 계약 발표 여부', clue: '설명회 자료 목차에 “해외 공급 계약” 항목이 새로 들어갔습니다.',
      outcomes: [
        { id: 'newdeal', weight: 65, beat: true, actual: '해외 공급 계약 첫 공개', gap: '기대가 낮던 상황에서 새 재료', label: 'IR에서 해외 계약 공개', impacts: [{ code: 'G01', bp: 500, reason: '낮아진 기대를 넘는 새 계약' }] },
        { id: 'nothing', weight: 35, beat: false, actual: '기존 계획만 반복', gap: '기대대로 새 내용 없음', label: 'IR 내용 기대 이하', impacts: [{ code: 'G01', bp: -300, reason: '설명회 기대감만 빠짐' }] }
      ] }
  ] },
  { id: 'dividend', title: '타르멜 배당 사건', stages: [
    { id: 'div-1', step: 1, targets: ['G06'], signal: { G06: 1 }, clueDir: 1, concept: '배당과 자사주 매입처럼 주주에게 돌려주는 돈이 늘면 방어주가 주목받습니다.',
      headline: '타르멜 이사회, 배당 안건 논의', facts: '회사 현금이 3년째 쌓이고 있습니다.', expectation: '시장은 주당 배당을 작년과 같은 300원으로 봅니다.', remaining: '실제 배당금과 자사주 매입 여부', clue: '최대주주가 “주주 환원을 늘려 달라”는 서한을 이사회에 보냈습니다.',
      outcomes: [
        { id: 'raise', weight: 65, beat: true, actual: '배당 450원과 자사주 매입 발표', gap: '기대보다 큰 주주 환원', label: '배당 확대·자사주 매입', impacts: [{ code: 'G06', bp: 450, reason: '주주 환원이 기대보다 큼' }] },
        { id: 'same', weight: 35, beat: false, actual: '배당 300원 유지', gap: '기대한 환원 확대가 없음', label: '배당 동결', impacts: [{ code: 'G06', bp: -300, reason: '쌓인 현금을 돌려주지 않음' }] }
      ] },
    { id: 'div-2', step: 2, targets: ['G06'], signal: { G06: 1 }, clueDir: -1, concept: '배당을 보고 사는 방어주는 배당 정책이 바뀌면 크게 흔들립니다.',
      headline: '타르멜, 해외 정수 설비 공장 투자 검토', facts: '해외 공장 건설안이 이사회에 올라왔습니다.', expectation: '시장은 배당을 유지하면서 투자할 수 있다고 봅니다.', remaining: '투자 재원 마련 방법', clue: '회사가 “올해 회사채를 발행할 계획이 없다”고 공시했습니다.',
      outcomes: [
        { id: 'cut', weight: 60, beat: false, actual: '배당을 줄여 투자 재원 마련', gap: '기대와 달리 배당 축소', label: '투자 위해 배당 축소', impacts: [{ code: 'G06', bp: -550, reason: '배당을 보고 산 투자자가 실망' }] },
        { id: 'both', weight: 40, beat: true, actual: '배당 유지, 장기 대출로 투자', gap: '기대대로 성장과 배당을 함께 잡음', label: '배당 유지하며 투자', impacts: [{ code: 'G06', bp: 350, reason: '성장 재료가 더해짐' }] }
      ] },
    { id: 'div-3', step: 3, targets: ['G06'], signal: { G06: 1 }, clueDir: -1, concept: '배당받을 권리가 사라지는 날 그만큼 주가가 내려가는데, 이를 배당락이라고 합니다.',
      headline: '타르멜 배당 받을 수 있는 마지막 매수일 임박', facts: '이번 주 안에 사야 이번 배당을 받을 수 있습니다.', expectation: '시장은 배당을 받으려는 매수가 이어진다고 봅니다.', remaining: '배당받을 권리가 사라진 뒤의 주가', clue: '지난 3년 모두 배당락일에 주가가 배당금 정도 내려갔습니다.',
      outcomes: [
        { id: 'exdiv', weight: 75, beat: false, actual: '배당락일에 주가 하락', gap: '배당 기대 매수가 끝나며 하락', label: '배당락으로 하락', impacts: [{ code: 'G06', bp: -350, reason: '배당받을 권리가 사라진 만큼 주가가 내림' }] },
        { id: 'hold', weight: 25, beat: true, actual: '배당락에도 주가 유지', gap: '기대보다 강함', label: '배당락 이겨 냄', impacts: [{ code: 'G06', bp: 200, reason: '설비 수주 기대가 받쳐 줌' }] }
      ] }
  ] },
  { id: 'earnings', title: '도르넴 실적 시즌 사건', stages: [
    { id: 'earn-1', step: 1, targets: ['G03'], signal: { G03: 1 }, clueDir: 1, concept: '매출보다 영업이익이, 그리고 시장 기대와의 차이가 주가를 움직입니다.',
      headline: '도르넴, 분기 실적 발표 하루 앞', facts: '업계 통계로는 냉장 물동량이 전년보다 10% 늘었습니다.', expectation: '시장은 영업이익 120억 원을 기대합니다.', remaining: '실제 영업이익', clue: '경쟁 운송사 2곳이 이번 분기 운임을 올렸다고 발표했습니다.',
      outcomes: [
        { id: 'beat', weight: 70, beat: true, actual: '영업이익 140억 원', gap: '기대보다 20억 원 많음', label: '영업이익 기대 상회', impacts: [{ code: 'G03', bp: 450, reason: '어닝 서프라이즈' }] },
        { id: 'miss', weight: 30, beat: false, actual: '영업이익 95억 원', gap: '매출은 늘었지만 이익은 기대보다 25억 원 적음', label: '영업이익 기대 하회', impacts: [{ code: 'G03', bp: -650, reason: '인건비가 매출보다 더 늘어 이익 감소' }] }
      ] },
    { id: 'earn-2', step: 2, targets: ['G03'], signal: { G03: 1 }, clueDir: -1, concept: '주가는 지난 실적보다 회사가 내놓는 앞으로의 전망(가이던스)에 더 민감합니다.',
      headline: '도르넴, 다음 분기 실적 전망(가이던스) 발표', facts: '회사가 다음 분기 예상 매출을 공개합니다.', expectation: '시장은 이번 분기와 비슷한 수준을 기대합니다.', remaining: '가이던스 숫자', clue: '최대 고객사가 물류센터 2곳을 직접 운영하겠다고 밝혔습니다.',
      outcomes: [
        { id: 'up', weight: 30, beat: true, actual: '다음 분기 매출 10% 증가 전망', gap: '기대보다 좋음', label: '가이던스 상향', impacts: [{ code: 'G03', bp: 500, reason: '앞으로의 이익 기대가 커짐' }] },
        { id: 'down', weight: 70, beat: false, actual: '다음 분기 매출 8% 감소 전망', gap: '기대보다 나쁨', label: '가이던스 하향', impacts: [{ code: 'G03', bp: -600, reason: '지난 실적보다 앞으로의 전망에 더 크게 반응' }] }
      ] },
    { id: 'earn-3', step: 3, targets: ['G03'], signal: { G03: -1 }, clueDir: 1, concept: '창고·공장처럼 고정비가 큰 사업은 가동률이 이익을 좌우합니다.',
      headline: '도르넴 신규 냉동 창고, 가동률 공개 예정', facts: '새 창고가 문을 연 지 석 달 됐습니다.', expectation: '시장은 가동률이 50%에 그칠까 걱정합니다.', remaining: '실제 가동률', clue: '창고 근처 도로에 냉동 화물차 대기 줄이 생겼다는 지역 기사가 나왔습니다.',
      outcomes: [
        { id: 'high', weight: 65, beat: true, actual: '가동률 80%', gap: '걱정보다 30%p 높음', label: '신규 창고 가동률 호조', impacts: [{ code: 'G03', bp: 550, reason: '고정비를 빨리 회수' }] },
        { id: 'low', weight: 35, beat: false, actual: '가동률 45%', gap: '걱정보다도 낮음', label: '신규 창고 가동률 부진', impacts: [{ code: 'G03', bp: -450, reason: '빈 창고의 고정비 부담' }] }
      ] }
  ] },
  { id: 'patent', title: '세모륨 특허 분쟁 사건', stages: [
    { id: 'pat-1', step: 1, targets: ['G02'], signal: { G02: -1 }, clueDir: 1, concept: '불확실성이 걷히는 것만으로도 주가가 오를 수 있습니다.',
      headline: '해외 경쟁사, 세모륨에 특허 침해 소송', facts: '열전지 코팅 기술 특허를 침해했다며 판매 금지 가처분도 신청했습니다.', expectation: '시장은 판매 금지까지 갈 수 있다고 걱정합니다.', remaining: '법원의 가처분 판단', clue: '같은 특허가 다른 나라 특허청에서 무효 판정을 받은 적이 있습니다.',
      outcomes: [
        { id: 'reject', weight: 70, beat: true, actual: '판매 금지 가처분 기각', gap: '걱정한 최악은 피함', label: '판매 금지 가처분 기각', impacts: [{ code: 'G02', bp: 700, reason: '최악의 시나리오가 사라짐' }] },
        { id: 'grant', weight: 30, beat: false, actual: '일부 제품 판매 금지', gap: '걱정이 현실화', label: '일부 제품 판매 금지', impacts: [{ code: 'G02', bp: -1000, reason: '매출 일부가 막힘' }] }
      ] },
    { id: 'pat-2a', step: 2, requires: ['reject'], targets: ['G02'], signal: { G02: 1 }, clueDir: -1, concept: '한 번 내는 비용과 계속 내는 비용은 주가에 다르게 반영됩니다.',
      headline: '세모륨, 경쟁사와 특허 합의 협상', facts: '본안 소송을 끝내려는 협상이 시작됐습니다.', expectation: '시장은 적은 합의금으로 끝난다고 봅니다.', remaining: '합의 조건', clue: '경쟁사가 최근 다른 회사에서 매출의 5%를 로열티로 받아 냈습니다.',
      outcomes: [
        { id: 'lump', weight: 30, beat: true, actual: '일회성 합의금 30억 원', gap: '기대대로 작게 끝남', label: '일회성 합의로 종결', impacts: [{ code: 'G02', bp: 400, reason: '소송 비용 부담이 사라짐' }] },
        { id: 'royalty', weight: 70, beat: false, actual: '매출의 4%를 로열티로 계속 지급', gap: '기대와 달리 비용이 계속 나감', label: '매출 4% 로열티 합의', impacts: [{ code: 'G02', bp: -500, reason: '앞으로 이익률이 계속 깎임' }] }
      ] },
    { id: 'pat-2b', step: 2, requires: ['grant'], targets: ['G02'], signal: { G02: 1 }, clueDir: -1, concept: '기술로 문제를 풀어도 고객 인증 같은 절차가 매출 시점을 정합니다.',
      headline: '세모륨, 특허 피한 새 설계 제품 출시 계획', facts: '특허를 피한 새 코팅 방식을 개발했습니다.', expectation: '시장은 석 달 안에 판매가 재개된다고 봅니다.', remaining: '고객사 인증 기간', clue: '업계 자료에 따르면 새 설계 제품의 고객 인증에는 보통 1년이 걸립니다.',
      outcomes: [
        { id: 'fast', weight: 40, beat: true, actual: '석 달 만에 인증 통과', gap: '기대대로 빠른 재개', label: '새 설계 빠른 인증', impacts: [{ code: 'G02', bp: 800, reason: '판매 공백이 짧게 끝남' }] },
        { id: 'slow', weight: 60, beat: false, actual: '인증에 1년 소요', gap: '기대보다 9개월 늦음', label: '새 설계 인증 지연', impacts: [{ code: 'G02', bp: -550, reason: '판매 공백이 길어짐' }] }
      ] },
    { id: 'pat-3', step: 3, targets: ['G02'], signal: { G02: -1 }, clueDir: 1, concept: '일회성 비용이 끝나면 다음 해 이익 전망이 좋아질 수 있습니다.',
      headline: '세모륨, 소송 비용 반영한 연간 실적 전망 발표', facts: '분기마다 소송 비용이 들어갔습니다.', expectation: '시장은 올해 영업적자를 예상합니다.', remaining: '연간 영업이익 전망', clue: '회사가 “소송 관련 비용은 이번 분기로 끝났다”고 설명했습니다.',
      outcomes: [
        { id: 'profit', weight: 65, beat: true, actual: '연간 소폭 흑자 전망', gap: '적자 걱정보다 좋음', label: '연간 흑자 전망', impacts: [{ code: 'G02', bp: 600, reason: '적자 걱정이 걷힘' }] },
        { id: 'loss', weight: 35, beat: false, actual: '연간 적자 전망', gap: '걱정대로', label: '연간 적자 전망', impacts: [{ code: 'G02', bp: -450, reason: '추가 비용 우려' }] }
      ] }
  ] },
  { id: 'rawcost', title: '배양 원료값 급등 사건', stages: [
    { id: 'raw-1', step: 1, targets: ['G04', 'G03'], signal: { G04: -1 }, clueDir: 1, concept: '원가가 올라도 미리 맺은 고정가 계약이 있으면 충격이 늦게 옵니다. 이런 내용은 사업보고서에서 확인할 수 있습니다.',
      headline: '배양 원료 국제 가격, 한 달 새 25% 급등', facts: '주요 산지의 작황이 나빠졌습니다.', expectation: '시장은 아보튠의 이익률이 크게 줄 것으로 봅니다.', remaining: '아보튠의 원료 계약 구조', clue: '아보튠 사업보고서에 “주요 원료 6개월분 고정가 계약”이 적혀 있습니다.',
      outcomes: [
        { id: 'hedged', weight: 70, beat: true, actual: '6개월분 원료를 예전 가격에 확보', gap: '걱정보다 영향이 작음', label: '고정가 계약으로 원가 방어', impacts: [{ code: 'G04', bp: 500, reason: '원가 상승 영향이 반년 늦게 옴' }, { code: 'G03', bp: 100, reason: '원료 수입 운송 증가' }] },
        { id: 'exposed', weight: 30, beat: false, actual: '고정가 계약 물량이 적어 원가 급등', gap: '걱정이 현실화', label: '원가 급등 직격', impacts: [{ code: 'G04', bp: -800, reason: '마진이 크게 줄어듦' }] }
      ] },
    { id: 'raw-2', step: 2, targets: ['G04'], signal: { G04: 1 }, clueDir: -1, concept: '경쟁자가 가격을 올리지 않으면 혼자 올리기 어렵습니다. 가격 결정력은 경쟁 구도에서 나옵니다.',
      headline: '아보튠, 제품 가격 인상 발표 예정', facts: '원료값 상승분을 납품가에 반영하려 합니다.', expectation: '시장은 10% 인상이 받아들여진다고 봅니다.', remaining: '고객사의 수용 여부', clue: '경쟁사 2곳이 가격을 동결하겠다고 밝혔습니다.',
      outcomes: [
        { id: 'accepted', weight: 30, beat: true, actual: '10% 인상 합의', gap: '기대대로 가격 전가 성공', label: '가격 인상 합의', impacts: [{ code: 'G04', bp: 600, reason: '가격 결정력 확인' }] },
        { id: 'rejected', weight: 70, beat: false, actual: '인상 철회, 일부 고객 이탈', gap: '기대와 달리 가격도 고객도 잃음', label: '가격 인상 실패', impacts: [{ code: 'G04', bp: -650, reason: '가격을 지킨 경쟁사로 고객이 옮겨 감' }] }
      ] },
    { id: 'raw-3', step: 3, targets: ['G04', 'G03'], signal: { G04: 1 }, clueDir: 1, concept: '원가 걱정은 원료값이 내려가기 시작하면 빠르게 되돌아갑니다.',
      headline: '배양 원료 산지 수확 시작', facts: '주요 산지에서 올해 수확이 시작됐습니다.', expectation: '시장은 원료값이 연말까지 높게 유지된다고 봅니다.', remaining: '다음 달 원료 가격', clue: '산지 수출 물량이 전월보다 40% 늘었다는 통계가 나왔습니다.',
      outcomes: [
        { id: 'fall', weight: 70, beat: true, actual: '원료값 15% 하락', gap: '기대보다 빨리 내림', label: '원료값 하락', impacts: [{ code: 'G04', bp: 450, reason: '원가 부담 완화' }, { code: 'G03', bp: -100, reason: '긴급 수입 운송 감소' }] },
        { id: 'stay', weight: 30, beat: false, actual: '원료값 고공 행진', gap: '기대대로 높음', label: '원료값 고공 행진', impacts: [{ code: 'G04', bp: -400, reason: '원가 부담 지속' }] }
      ] }
  ] },
  { id: 'fx', title: '환율 급변 사건', stages: [
    { id: 'fx-1', step: 1, targets: ['G04', 'G03'], signal: { G04: -1 }, clueDir: 1, concept: '환율이 오르면(원화 가치 하락) 원료를 수입하는 회사는 원가가 오르고, 수출하는 회사는 유리해집니다.',
      headline: '원화 가치 급락, 환율 한 주 새 6% 상승', facts: '아보튠은 배양 원료 대부분을 수입합니다.', expectation: '시장은 아보튠의 원가가 크게 오른다고 봅니다.', remaining: '아보튠이 환율 변동에 대비해 두었는지', clue: '아보튠 사업보고서에 “수입 대금 1년분 환율 고정 계약”이 적혀 있습니다.',
      outcomes: [
        { id: 'hedged', weight: 65, beat: true, actual: '1년분 수입 대금을 예전 환율로 고정', gap: '걱정보다 원가 영향이 작음', label: '환율 고정 계약으로 방어', impacts: [{ code: 'G04', bp: 550, reason: '환율이 올라도 올해 원가는 그대로' }, { code: 'G03', bp: -100, reason: '비싸진 수입품 운송 감소 우려' }] },
        { id: 'exposed', weight: 35, beat: false, actual: '고정 계약 물량이 적어 원가 급등', gap: '걱정이 현실이 됨', label: '환율 상승 직격', impacts: [{ code: 'G04', bp: -800, reason: '수입 원가가 6% 가까이 오름' }, { code: 'G03', bp: -100, reason: '비싸진 수입품 운송 감소 우려' }] }
      ] },
    { id: 'fx-2', step: 2, targets: ['G03'], signal: { G03: 1 }, clueDir: -1, concept: '환율은 수입품 가격을 바꿔 운송처럼 연결된 업종에도 영향을 줍니다.',
      headline: '도르넴, 수입 냉동식품 운송 계약 확대 협상', facts: '수입 냉동식품 운송이 도르넴 매출의 30%입니다.', expectation: '시장은 계약 물량이 20% 늘 것으로 봅니다.', remaining: '수입 업체들의 다음 분기 주문량', clue: '환율이 오르자 수입 업체 두 곳이 다음 분기 주문을 줄이겠다고 밝혔습니다.',
      outcomes: [
        { id: 'expand', weight: 30, beat: true, actual: '운송 물량 20% 확대 계약', gap: '기대대로 확대', label: '수입 운송 계약 확대', impacts: [{ code: 'G03', bp: 500, reason: '환율 부담에도 물량을 지킴' }] },
        { id: 'shrink', weight: 70, beat: false, actual: '운송 물량 10% 축소', gap: '기대한 확대 대신 축소', label: '수입 운송 물량 축소', impacts: [{ code: 'G03', bp: -450, reason: '비싸진 수입품 주문이 줄어듦' }] }
      ] },
    { id: 'fx-3', step: 3, targets: ['G04', 'G05'], signal: { G04: 1 }, clueDir: 1, concept: '환율이 제자리로 돌아오면 환율 때문에 내렸던 주가도 되돌아가는 경우가 많습니다.',
      headline: '외환 당국, 환율 안정 조치 예고', facts: '급격한 환율 변동을 막겠다고 밝혔습니다.', expectation: '시장은 효과가 작을 것으로 봅니다.', remaining: '환율이 실제로 내려갈지', clue: '분기 말을 앞두고 수출 대금을 원화로 바꾸려는 수요가 크게 늘었다는 집계가 나왔습니다.',
      outcomes: [
        { id: 'calm', weight: 65, beat: true, actual: '환율 3% 하락', gap: '기대보다 효과가 큼', label: '환율 안정', impacts: [{ code: 'G04', bp: 400, reason: '수입 원가 부담 완화' }, { code: 'G05', bp: 150, reason: '해외 장비 대여료 부담 감소' }] },
        { id: 'still', weight: 35, beat: false, actual: '환율 높은 수준 유지', gap: '기대대로 효과 미미', label: '환율 고공 지속', impacts: [{ code: 'G04', bp: -350, reason: '원가 부담 계속' }] }
      ] }
  ] },
  { id: 'recall', title: '도르넴 냉장 차량 리콜 사건', stages: [
    { id: 'rc-1', step: 1, targets: ['G03'], signal: { G03: -1 }, clueDir: 1, concept: '리콜은 범위가 비용을 정합니다. 원인이 좁을수록 걱정이 빨리 걷힙니다.',
      headline: '도르넴 냉장 차량, 운행 중 냉각 장치 고장 잇따라', facts: '운행 중 짐칸 온도가 올라간 사례가 7건 보고됐습니다.', expectation: '시장은 전 차량 리콜과 큰 비용을 걱정합니다.', remaining: '고장 원인과 리콜 범위', clue: '고장 7건 모두 같은 달에 생산된 냉각 부품을 쓴 차량이었습니다.',
      outcomes: [
        { id: 'narrow', weight: 65, beat: true, actual: '특정 달 생산 부품을 쓴 차량 40대만 리콜', gap: '걱정보다 범위가 좁음', label: '리콜 범위 일부로 한정', impacts: [{ code: 'G03', bp: 500, reason: '비용 걱정이 크게 줄어듦' }] },
        { id: 'wide', weight: 35, beat: false, actual: '전 차량 점검과 리콜', gap: '걱정이 현실이 됨', label: '전 차량 리콜', impacts: [{ code: 'G03', bp: -800, reason: '수리 비용과 운행 중단 손실' }] }
      ] },
    { id: 'rc-2', step: 2, targets: ['G03'], signal: { G03: 1 }, clueDir: -1, concept: '“비용은 상대가 낸다”는 발표도 상대가 동의해야 확정됩니다.',
      headline: '도르넴 “리콜 비용은 부품사가 부담”', facts: '부품 공급 계약에 결함 보상 조항이 있습니다.', expectation: '시장은 비용 전액을 부품사가 낸다고 봅니다.', remaining: '부품사의 실제 지급 여부', clue: '부품사가 “고장 책임은 차량 관리에도 있다”며 이의를 제기했습니다.',
      outcomes: [
        { id: 'paid', weight: 30, beat: true, actual: '부품사가 비용 전액 지급 합의', gap: '기대대로', label: '리콜 비용 전액 보상', impacts: [{ code: 'G03', bp: 450, reason: '리콜 비용 부담이 사라짐' }] },
        { id: 'dispute', weight: 70, beat: false, actual: '비용을 절반씩 나누기로 합의', gap: '기대보다 도르넴 부담이 큼', label: '리콜 비용 절반 부담', impacts: [{ code: 'G03', bp: -400, reason: '예상하지 못한 비용을 떠안음' }] }
      ] },
    { id: 'rc-3', step: 3, targets: ['G03'], signal: { G03: -1 }, clueDir: 1, concept: '고객이 떠날지 걱정될 때는 고객에게 다른 선택지가 있는지 보세요.',
      headline: '대형 유통사, 도르넴과의 운송 계약 재검토', facts: '리콜 기간에 배송 지연이 있었습니다.', expectation: '시장은 대형 유통사가 계약을 끊을 것으로 봅니다.', remaining: '계약 갱신 여부', clue: '업계 자료에 따르면 다른 운송사들은 냉장 차량 여유가 거의 없습니다.',
      outcomes: [
        { id: 'renew', weight: 65, beat: true, actual: '계약 2년 갱신', gap: '걱정과 달리 고객 유지', label: '대형 고객 계약 갱신', impacts: [{ code: 'G03', bp: 600, reason: '최대 고객 이탈 걱정 해소' }] },
        { id: 'lost', weight: 35, beat: false, actual: '계약 물량 절반을 다른 운송사로', gap: '걱정이 일부 현실이 됨', label: '대형 고객 물량 이탈', impacts: [{ code: 'G03', bp: -700, reason: '매출의 큰 부분이 줄어듦' }] }
      ] }
  ] },
  { id: 'overhang', title: '세모륨 물량 부담 사건', stages: [
    { id: 'oh-1', step: 1, targets: ['G02'], signal: { G02: -1 }, clueDir: 1, concept: '팔 수 있게 된 대량 주식은 실제로 팔리지 않아도 주가를 누릅니다. 이를 오버행(물량 부담)이라고 합니다.',
      headline: '세모륨 초기 투자자 지분 15%, 다음 주 매도 제한 풀려', facts: '상장 때 일정 기간 팔지 않기로 약속한 지분의 의무보유 기간이 끝납니다.', expectation: '시장은 대량 매도로 주가가 눌릴 것으로 봅니다.', remaining: '초기 투자자가 실제로 팔지', clue: '가장 큰 초기 투자자가 “보유 기간을 스스로 1년 더 늘린다”고 공시했습니다.',
      outcomes: [
        { id: 'hold', weight: 65, beat: true, actual: '풀린 물량 대부분이 팔리지 않음', gap: '걱정보다 매도가 적음', label: '물량 부담 해소', impacts: [{ code: 'G02', bp: 500, reason: '걱정한 매도 물량이 나오지 않음' }] },
        { id: 'dump', weight: 35, beat: false, actual: '풀린 물량의 절반이 시장에 나옴', gap: '걱정이 현실이 됨', label: '초기 투자자 대량 매도', impacts: [{ code: 'G02', bp: -750, reason: '사려는 사람보다 팔려는 물량이 많아짐' }] }
      ] },
    { id: 'oh-2', step: 2, targets: ['G02'], signal: { G02: 1 }, clueDir: -1, concept: '블록딜은 보통 현재가보다 싸게 넘기기 때문에, 그 거래 가격이 주가의 새 기준이 되기 쉽습니다.',
      headline: '세모륨 지분, 대형 연기금에 블록딜 추진', facts: '초기 투자자 지분 일부를 장이 끝난 뒤 한꺼번에 넘기는 거래입니다.', expectation: '시장은 큰손이 들어오니 호재라고 봅니다.', remaining: '거래 가격', clue: '거래를 맡은 증권사가 “현재가보다 8~10% 낮은 가격을 제시했다”고 전해졌습니다.',
      outcomes: [
        { id: 'small-disc', weight: 30, beat: true, actual: '현재가보다 2% 낮은 가격에 거래', gap: '기대대로 좋은 조건', label: '낮은 할인율 블록딜', impacts: [{ code: 'G02', bp: 400, reason: '장기 투자자를 큰 할인 없이 맞이함' }] },
        { id: 'big-disc', weight: 70, beat: false, actual: '현재가보다 9% 낮은 가격에 거래', gap: '기대와 달리 큰 할인', label: '큰 할인 블록딜', impacts: [{ code: 'G02', bp: -350, reason: '할인된 거래 가격 쪽으로 주가가 끌려감' }] }
      ] },
    { id: 'oh-3', step: 3, targets: ['G02'], signal: { G02: 1 }, clueDir: 1, concept: '물량 부담이 걷힌 뒤에는 다시 실적이 주가를 정합니다.',
      headline: '세모륨, 물량 부담 해소 후 첫 분기 실적 발표', facts: '아직 영업손실을 내고 있습니다.', expectation: '시장은 영업손실이 조금 줄어든다고 봅니다.', remaining: '손실이 줄어든 폭', clue: '양산 라인 가동률이 지난 분기보다 20%p 올랐다는 공장 자료가 나왔습니다.',
      outcomes: [
        { id: 'better', weight: 65, beat: true, actual: '영업손실 절반으로 축소', gap: '기대보다 크게 개선', label: '적자 폭 크게 축소', impacts: [{ code: 'G02', bp: 450, reason: '흑자 전환 시점이 당겨짐' }] },
        { id: 'worse', weight: 35, beat: false, actual: '영업손실 오히려 증가', gap: '기대와 반대', label: '적자 폭 확대', impacts: [{ code: 'G02', bp: -700, reason: '양산 비용이 예상보다 큼' }] }
      ] }
  ] },
  { id: 'proxy', title: '피노벡 경영권 분쟁 사건', stages: [
    { id: 'px-1', step: 1, targets: ['G05'], signal: { G05: 1 }, clueDir: -1, concept: '경영권 분쟁 중에는 양쪽이 지분을 사들일 거라는 기대로 주가가 오르기도 합니다. 그 기대가 꺾이면 빠르게 되돌아갑니다.',
      headline: '피노벡 2대 주주, 지분 늘리며 경영권 도전 선언', facts: '2대 주주가 지분을 18%까지 늘렸습니다. 최대주주 지분은 22%입니다.', expectation: '시장은 지분 사들이기 경쟁이 붙는다고 봅니다.', remaining: '최대주주가 맞서 지분을 살지', clue: '최대주주가 “추가로 사지 않고 주주총회 표 대결로 가겠다”고 밝혔습니다.',
      outcomes: [
        { id: 'race', weight: 30, beat: true, actual: '양쪽 모두 지분 추가 매입', gap: '기대대로 지분 경쟁', label: '지분 매입 경쟁', impacts: [{ code: 'G05', bp: 700, reason: '사려는 쪽이 둘이 되며 수요가 늘어남' }] },
        { id: 'vote', weight: 70, beat: false, actual: '추가 매입 없이 표 대결 예고', gap: '기대한 지분 경쟁이 없음', label: '지분 경쟁 기대 무산', impacts: [{ code: 'G05', bp: -350, reason: '지분 경쟁 기대로 오른 몫이 빠짐' }] }
      ] },
    { id: 'px-2', step: 2, targets: ['G05'], signal: { G05: -1 }, clueDir: 1, concept: '불확실성이 걷히는 것만으로도 주가가 오를 수 있습니다.',
      headline: '피노벡 주주총회, 이사 선임 표 대결 임박', facts: '2대 주주가 이사 3명을 새로 뽑자는 안건을 냈습니다.', expectation: '시장은 분쟁이 길어져 경영이 흔들릴까 걱정합니다.', remaining: '표 대결 결과와 승복 여부', clue: '주주에게 투표 방향을 조언하는 의결권 자문사 2곳이 모두 같은 쪽 손을 들어 줬습니다.',
      outcomes: [
        { id: 'settled', weight: 65, beat: true, actual: '큰 표 차이로 결론, 양측 승복', gap: '걱정보다 빨리 정리', label: '경영권 분쟁 조기 정리', impacts: [{ code: 'G05', bp: 450, reason: '불확실성이 사라짐' }] },
        { id: 'lawsuit', weight: 35, beat: false, actual: '근소한 차이로 결론, 소송 제기', gap: '걱정대로 분쟁 장기화', label: '분쟁이 소송으로 번짐', impacts: [{ code: 'G05', bp: -600, reason: '경영 공백 우려' }] }
      ] },
    { id: 'px-3', step: 3, targets: ['G05'], signal: { G05: 1 }, clueDir: -1, concept: '확장 계획은 좋은 소식이지만, 돈을 주주에게서 마련하면 지분 희석이 따라옵니다.',
      headline: '피노벡 새 경영진, 공연장 2곳 확장 계획 발표', facts: '분쟁이 끝난 뒤 첫 사업 계획입니다.', expectation: '시장은 확장으로 매출이 크게 는다고 봅니다.', remaining: '확장 자금을 어떻게 마련할지', clue: '새 경영진이 “필요하면 주주들에게 자금을 요청하겠다”고 말했습니다.',
      outcomes: [
        { id: 'loan', weight: 30, beat: true, actual: '장기 대출로 자금 마련', gap: '기대대로 지분 희석 없음', label: '대출로 확장 자금 마련', impacts: [{ code: 'G05', bp: 500, reason: '희석 없이 성장 계획 확정' }] },
        { id: 'rights', weight: 70, beat: false, actual: '유상증자로 자금 마련', gap: '기대와 달리 새 주식 발행', label: '확장 위해 유상증자', impacts: [{ code: 'G05', bp: -500, reason: '주식 수가 늘어 1주의 몫이 줄어듦' }] }
      ] }
  ] },
  { id: 'credit', title: '타르멜 신용등급 사건', stages: [
    { id: 'cr-1', step: 1, targets: ['G06'], signal: { G06: -1 }, clueDir: 1, concept: '신용등급이 내려가면 회사가 돈을 빌릴 때 이자를 더 내야 합니다.',
      headline: '신용평가사, 타르멜 신용등급 하향 검토', facts: '해외 설비 투자로 빚이 크게 늘었습니다.', expectation: '시장은 등급 하락과 이자 부담 증가를 예상합니다.', remaining: '등급 결정', clue: '타르멜이 지난달 해외 설비 지분 일부를 팔아 빚의 30%를 갚았다고 공시했습니다.',
      outcomes: [
        { id: 'keep', weight: 65, beat: true, actual: '신용등급 유지', gap: '걱정보다 좋은 결과', label: '신용등급 유지', impacts: [{ code: 'G06', bp: 400, reason: '이자 부담 걱정이 사라짐' }] },
        { id: 'down', weight: 35, beat: false, actual: '신용등급 한 단계 하락', gap: '걱정이 현실이 됨', label: '신용등급 하락', impacts: [{ code: 'G06', bp: -550, reason: '앞으로 빌리는 돈의 이자가 오름' }] }
      ] },
    { id: 'cr-2', step: 2, targets: ['G06'], signal: { G06: 1 }, clueDir: -1, concept: '회사채 금리는 회사가 빚을 낼 때 치르는 값입니다. 시장 분위기에 따라 같은 회사도 금리가 달라집니다.',
      headline: '타르멜, 설비 교체 자금 위해 회사채 발행 추진', facts: '오래된 정수 설비를 교체할 자금입니다.', expectation: '시장은 연 3%대 낮은 금리로 발행된다고 봅니다.', remaining: '실제 발행 금리', clue: '같은 등급 회사들이 이번 달 사려는 사람이 부족해 금리를 올려 발행했습니다.',
      outcomes: [
        { id: 'cheap', weight: 30, beat: true, actual: '연 3.2%로 발행', gap: '기대대로 낮은 금리', label: '낮은 금리로 회사채 발행', impacts: [{ code: 'G06', bp: 350, reason: '이자 비용이 적어 배당 여력 유지' }] },
        { id: 'costly', weight: 70, beat: false, actual: '연 4.6%로 발행', gap: '기대보다 1%p 넘게 높은 금리', label: '높은 금리로 회사채 발행', impacts: [{ code: 'G06', bp: -300, reason: '이자 비용이 늘어 배당 여력 감소' }] }
      ] },
    { id: 'cr-3', step: 3, targets: ['G06'], signal: { G06: 1 }, clueDir: 1, concept: '장기 관리 계약은 매출이 오래 이어져 방어주의 힘이 됩니다.',
      headline: '지자체, 물 재이용 설비 장기 관리 입찰 결과 발표', facts: '3개 지역의 10년 관리 계약입니다.', expectation: '시장은 타르멜이 3곳 중 1곳을 딸 것으로 봅니다.', remaining: '낙찰받은 지역 수', clue: '경쟁사 한 곳이 입찰 서류 미비로 탈락했다는 지자체 공고가 나왔습니다.',
      outcomes: [
        { id: 'two', weight: 65, beat: true, actual: '3곳 중 2곳 낙찰', gap: '기대보다 1곳 많음', label: '장기 관리 계약 2곳 수주', impacts: [{ code: 'G06', bp: 500, reason: '10년 매출이 늘어남' }] },
        { id: 'none', weight: 35, beat: false, actual: '한 곳도 낙찰받지 못함', gap: '기대보다 1곳 적음', label: '장기 관리 입찰 전패', impacts: [{ code: 'G06', bp: -600, reason: '기대한 장기 매출이 사라짐' }] }
      ] }
  ] },
  { id: 'correction', title: '누바칸 정정 공시 사건', stages: [
    { id: 'co-1', step: 1, targets: ['G01'], signal: { G01: 1 }, clueDir: -1, concept: '공시는 본문뿐 아니라 첨부된 조건까지 읽어야 합니다. 내용이 바뀌면 정정 공시가 나옵니다.',
      headline: '누바칸, 해외 공급 계약 공시 “계약 금액 500억 원”', facts: '회사 연 매출의 40%에 해당하는 규모입니다.', expectation: '시장은 500억 원이 확정된 금액이라고 봅니다.', remaining: '계약서의 세부 조건', clue: '공시 첨부 서류에 “최종 금액은 시험 납품 뒤 확정”이라는 문구가 있습니다.',
      outcomes: [
        { id: 'firm', weight: 30, beat: true, actual: '500억 원 전액 확정 계약', gap: '기대대로', label: '공급 계약 전액 확정', impacts: [{ code: 'G01', bp: 600, reason: '큰 매출이 확정됨' }] },
        { id: 'revise', weight: 70, beat: false, actual: '정정 공시: 확정 200억 원, 나머지 300억 원은 고객 선택(옵션)', gap: '확정 금액이 기대의 40%', label: '정정 공시로 계약 금액 축소', impacts: [{ code: 'G01', bp: -400, reason: '확정 매출이 생각보다 작음' }] }
      ] },
    { id: 'co-2', step: 2, targets: ['G01'], signal: { G01: -1 }, clueDir: 1, concept: '실망 뒤에는 계약이 실제로 이행되는지가 다음 재료가 됩니다.',
      headline: '누바칸, 해외 시험 납품 일정 공개', facts: '해외 고객사에 첫 물량을 보냅니다.', expectation: '시장은 정정 공시 뒤로 계약 자체를 의심합니다.', remaining: '시험 납품 통과 여부', clue: '고객사 현지 공장이 누바칸 모듈 설치 공사를 이미 시작했습니다.',
      outcomes: [
        { id: 'pass', weight: 65, beat: true, actual: '시험 납품 통과', gap: '의심보다 좋은 결과', label: '해외 시험 납품 통과', impacts: [{ code: 'G01', bp: 550, reason: '계약 이행에 대한 의심이 걷힘' }] },
        { id: 'fail', weight: 35, beat: false, actual: '현지 기준 미달로 재시험', gap: '의심이 커짐', label: '해외 시험 납품 재시험', impacts: [{ code: 'G01', bp: -650, reason: '확정 금액마저 늦어질 우려' }] }
      ] },
    { id: 'co-3', step: 3, targets: ['G01'], signal: { G01: 1 }, clueDir: 1, concept: '선택(옵션) 물량은 고객 사정에 달려 있습니다. 고객의 계획을 보면 힌트가 있습니다.',
      headline: '누바칸 해외 고객사, 옵션 물량 행사 여부 발표 예정', facts: '남은 300억 원어치는 고객사가 선택합니다.', expectation: '시장은 절반인 150억 원만 행사된다고 봅니다.', remaining: '옵션 행사 규모', clue: '고객사가 내년 설치 지역을 두 배로 늘린다고 발표했습니다.',
      outcomes: [
        { id: 'full', weight: 65, beat: true, actual: '옵션 300억 원 전부 행사', gap: '기대의 두 배', label: '옵션 물량 전부 행사', impacts: [{ code: 'G01', bp: 600, reason: '처음 공시한 500억 원이 결국 채워짐' }] },
        { id: 'none', weight: 35, beat: false, actual: '옵션 행사 보류', gap: '기대한 150억 원도 없음', label: '옵션 행사 보류', impacts: [{ code: 'G01', bp: -700, reason: '추가 매출 기대가 사라짐' }] }
      ] }
  ] },
  { id: 'theme', title: '가상 공연 테마주 사건', stages: [
    { id: 'th-1', step: 1, targets: ['G05'], signal: { G05: 1 }, clueDir: -1, concept: '테마주는 실적보다 이야기로 움직입니다. 회사의 실제 사업과 맞는지 확인해야 합니다.',
      headline: '“가상 공연이 뜬다” 피노벡, 가상 공연 테마주로 묶여 급등', facts: '사흘 동안 주가가 크게 올랐습니다. 회사는 가상 공연 사업을 발표한 적이 없습니다.', expectation: '시장 일부는 가상 공연 사업 진출 발표를 기대합니다.', remaining: '회사의 공식 입장', clue: '피노벡 사업보고서에 따르면 매출의 95%가 오프라인 공연장 대관과 티켓입니다.',
      outcomes: [
        { id: 'noplan', weight: 65, beat: false, actual: '회사 “가상 공연 사업 계획 없음”', gap: '테마 기대에 실체가 없음', label: '테마 기대 공식 부인', impacts: [{ code: 'G05', bp: -700, reason: '이야기로 오른 몫이 빠짐' }] },
        { id: 'pilot', weight: 35, beat: true, actual: '가상 공연 시범 사업 발표', gap: '기대 일부가 사실로', label: '가상 공연 시범 사업 발표', impacts: [{ code: 'G05', bp: 600, reason: '테마에 실제 사업이 붙음' }] }
      ] },
    { id: 'th-2', step: 2, targets: ['G05'], signal: { G05: -1 }, clueDir: 1, concept: '테마가 식은 뒤에는 본업 실적이 주가를 받쳐 주는지가 중요합니다.',
      headline: '테마 열기 식으며 피노벡 거래량 급감', facts: '거래량이 최고치의 5분의 1로 줄었습니다.', expectation: '시장은 주가가 테마 이전보다 더 내려간다고 봅니다.', remaining: '본업 실적이 받쳐 줄지', clue: '다음 달 공연 예매율이 지난해보다 15% 높습니다.',
      outcomes: [
        { id: 'support', weight: 65, beat: true, actual: '공연 예매 호조로 매출 전망 상향', gap: '걱정보다 탄탄한 본업', label: '본업이 주가를 받침', impacts: [{ code: 'G05', bp: 450, reason: '본업 실적으로 관심이 옮겨 감' }] },
        { id: 'slide', weight: 35, beat: false, actual: '예매 취소가 늘어 매출 전망 유지', gap: '받쳐 줄 재료가 없음', label: '테마 이후 계속 하락', impacts: [{ code: 'G05', bp: -500, reason: '사려는 사람이 사라짐' }] }
      ] },
    { id: 'th-3', step: 3, targets: ['G05'], signal: { G05: 1 }, clueDir: -1, concept: '새 테마가 생겨도 회사와 실제로 연결되는지 다시 확인해야 합니다.',
      headline: '새 테마 “공연 관광” 등장, 피노벡 다시 거론', facts: '외국인 관광객이 늘며 공연 관광 관련주가 주목받습니다.', expectation: '시장은 피노벡이 다시 급등한다고 봅니다.', remaining: '실제 외국인 관객 비중', clue: '피노벡 공연장은 한국어 공연만 하고 외국어 자막 설비가 없습니다.',
      outcomes: [
        { id: 'fade', weight: 70, beat: false, actual: '외국인 관객 비중 2%', gap: '테마와 실제가 다름', label: '공연 관광 테마 무관', impacts: [{ code: 'G05', bp: -400, reason: '새 테마 기대가 금방 꺼짐' }] },
        { id: 'real', weight: 30, beat: true, actual: '외국어 자막 설비 도입 발표', gap: '테마에 맞춘 준비 시작', label: '공연 관광 준비 발표', impacts: [{ code: 'G05', bp: 450, reason: '새 고객층 기대' }] }
      ] }
  ] },
  { id: 'turnaround', title: '도르넴 흑자 전환 사건', stages: [
    { id: 'ta-1', step: 1, targets: ['G03'], signal: { G03: 1 }, clueDir: 1, concept: '적자를 내던 회사가 이익을 내기 시작하는 것을 흑자 전환이라고 합니다. 기대가 이미 크면 오름 폭은 작습니다.',
      headline: '도르넴, 3분기 연속 적자 끝내고 흑자 전환 기대', facts: '운임 인상과 적자 노선 정리를 마쳤습니다.', expectation: '시장은 영업이익 20억 원으로 흑자 전환을 기대합니다.', remaining: '실제 영업이익', clue: '경쟁사 2곳의 같은 분기 운임 수입이 15% 늘었습니다.',
      outcomes: [
        { id: 'beat', weight: 65, beat: true, actual: '영업이익 30억 원으로 흑자 전환', gap: '기대보다 10억 원 많음', label: '기대 넘는 흑자 전환', impacts: [{ code: 'G03', bp: 450, reason: '흑자 전환 확인. 기대가 이미 반영돼 오름 폭은 제한' }] },
        { id: 'miss', weight: 35, beat: false, actual: '영업손실 5억 원으로 적자 지속', gap: '기대한 흑자 전환 실패', label: '흑자 전환 실패', impacts: [{ code: 'G03', bp: -800, reason: '흑자 전환 기대가 무너짐' }] }
      ] },
    { id: 'ta-2', step: 2, targets: ['G03'], signal: { G03: 1 }, clueDir: -1, concept: '회사가 내놓는 실적 전망(가이던스)이 기대보다 낮으면, 좋은 실적 뒤에도 주가가 내릴 수 있습니다.',
      headline: '도르넴, 내년 실적 전망 발표 예정', facts: '흑자 전환 뒤 처음 내는 전망입니다.', expectation: '시장은 내년 영업이익이 두 배로 는다고 봅니다.', remaining: '회사가 내놓을 전망치', clue: '도르넴 재무 담당 임원이 “내년은 차량 교체 비용이 크다”고 말했습니다.',
      outcomes: [
        { id: 'high', weight: 35, beat: true, actual: '내년 영업이익 두 배 이상 전망', gap: '기대대로', label: '자신감 있는 실적 전망', impacts: [{ code: 'G03', bp: 600, reason: '성장이 이어진다는 확인' }] },
        { id: 'low', weight: 65, beat: false, actual: '내년 영업이익 20% 증가 전망', gap: '기대한 두 배에 크게 못 미침', label: '보수적인 실적 전망', impacts: [{ code: 'G03', bp: -550, reason: '기대한 성장 속도가 꺾임' }] }
      ] },
    { id: 'ta-3', step: 3, targets: ['G03'], signal: { G03: -1 }, clueDir: 1, concept: '같은 비용도 한꺼번에 내는지 나눠 내는지에 따라 이익에 주는 충격이 다릅니다.',
      headline: '도르넴, 냉장 차량 교체 계획 확정 공시 예정', facts: '낡은 냉장 차량 200대를 바꿔야 합니다.', expectation: '시장은 교체 비용이 내년 이익을 대부분 잡아먹는다고 걱정합니다.', remaining: '교체 방식', clue: '도르넴이 차량을 사지 않고 빌려 쓰는(리스) 계약을 협의 중이라는 보도가 나왔습니다.',
      outcomes: [
        { id: 'lease', weight: 65, beat: true, actual: '차량을 빌려 쓰는 리스 계약 체결', gap: '걱정보다 한 번에 드는 비용이 작음', label: '리스로 교체 비용 분산', impacts: [{ code: 'G03', bp: 500, reason: '비용을 여러 해로 나눠 냄' }] },
        { id: 'buy', weight: 35, beat: false, actual: '차량 200대 일시 구매', gap: '걱정대로 큰 비용', label: '차량 일시 구매', impacts: [{ code: 'G03', bp: -500, reason: '내년 이익이 크게 줄어듦' }] }
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
    { key: 'B', label: '나눠서 담겠다', feedback: '서로 다른 사건에 반응하는 종목을 섞으면 위험을 줄일 수 있습니다. 같은 업종끼리는 함께 움직이니 업종도 나눠 보세요.' } ] },
  { id: 'stoploss', title: '산 종목이 10% 빠졌습니다', body: '산 이유는 그대로인데 가격만 내려갔습니다. 언제 팔지 기준은 정해 두지 않았습니다.', concept: '손절', condition: '주문 시간 중 공개', options: [
    { key: 'A', label: '더 떨어지기 전에 판다', feedback: '손실을 끊는 손절은 위험 관리입니다. 다만 기준 없이 가격만 보고 팔면 가장 낮은 곳에서 팔기 쉽습니다. 사기 전에 “어떤 일이 생기면 판다”를 정해 두세요.' },
    { key: 'B', label: '산 이유가 아직 맞는지 확인한다', feedback: '이유가 깨졌다면 팔고, 그대로라면 들고 가는 것이 판단 기준입니다. 손실 종목을 막연히 오래 들고 가는 처분 효과도 조심하세요.' } ] },
  { id: 'averaging', title: '평균 단가를 낮추고 싶습니다', body: '손실 중인 종목을 더 사면 평균 단가가 내려갑니다. 남은 현금의 절반을 더 넣을까 고민됩니다.', concept: '물타기', condition: '주문 시간 중 공개', options: [
    { key: 'A', label: '더 사서 평균 단가를 낮춘다', feedback: '평균 단가가 낮아져도 이미 난 손실 금액은 그대로이고, 한 종목 비중만 커집니다. 근거 없는 물타기는 손실을 키울 수 있습니다.' },
    { key: 'B', label: '처음 본다고 생각하고 판단한다', feedback: '“지금 처음 봤다면 이 가격에 살까?”라고 물으면 이미 낸 돈에 끌려가지 않습니다.' } ] },
  { id: 'divchase', title: '오늘이 배당 마지막 매수일입니다', body: '“오늘 사면 배당 받는다!” 회사는 잘 모르지만 배당만 보고 사려고 합니다.', concept: '배당락', condition: '주문 시간 중 공개', options: [
    { key: 'A', label: '배당 받으려고 산다', feedback: '배당받을 권리가 사라지는 배당락일에는 주가가 배당금 정도 내려가는 일이 흔합니다. 수수료까지 내면 오히려 손해일 수 있습니다.' },
    { key: 'B', label: '회사를 먼저 살펴본다', feedback: '배당은 이익의 일부를 나눠 받는 것입니다. 배당 한 번보다 회사가 꾸준히 벌 수 있는지가 중요합니다.' } ] },
  { id: 'themesms', title: '“테마주 정보” 문자가 왔습니다', body: '“가상 공연 대장주! 내일 상한가 확실. 지금 매수하세요.” 모르는 번호입니다.', concept: '테마주', condition: '주문 시간 중 공개', options: [
    { key: 'A', label: '이름이라도 검색해서 산다', feedback: '이런 문자는 먼저 사 둔 사람이 비싸게 팔 상대를 찾는 수단일 수 있습니다. “확실”이라는 말이 붙으면 더 의심하세요.' },
    { key: 'B', label: '무시하고 사업 내용을 확인한다', feedback: '테마와 실제 매출이 연결되는지 사업보고서에서 확인하는 습관이 테마주 급락을 피하게 해 줍니다.' } ] },
  { id: 'ipo', title: '공모주 청약 안내가 떴습니다', body: '“상장 첫날 두 배 간다더라.” 회사가 무엇을 파는지는 아직 못 봤습니다.', concept: '공모주 청약', condition: '주문 시간 중 공개', options: [
    { key: 'A', label: '일단 청약부터 넣는다', feedback: '공모주는 상장 첫날 공모가보다 크게 오르기도 하고 밑으로 내려가기도 합니다. 첫날 가격만 보고 넣으면 내려갈 때 버틸 근거가 없습니다.' },
    { key: 'B', label: '무엇을 파는 회사인지 먼저 본다', feedback: '공모가가 어떻게 정해졌는지, 무엇으로 돈을 버는지 확인하면 상장 첫날 가격에 덜 흔들립니다.' } ] },
  { id: 'rights', title: '가진 종목이 유상증자를 공시했습니다', body: '회사가 새 주식을 발행해 돈을 모으겠다고 합니다. 규모가 꽤 큽니다.', concept: '지분 희석', condition: '주문 시간 중 공개', options: [
    { key: 'A', label: '돈이 들어오니 좋은 소식이다', feedback: '돈은 들어오지만 주식 수가 늘어 1주의 몫이 줄어듭니다. 이것이 지분 희석입니다. 그래서 대규모 유상증자 발표에 주가가 내리는 일이 많습니다.' },
    { key: 'B', label: '모은 돈을 어디에 쓰는지 본다', feedback: '좋은 판단입니다. 빚을 갚는 데 쓰는지 공장을 짓는 데 쓰는지에 따라 평가가 달라집니다. 공시의 자금 사용 목적을 보세요.' } ] },
  { id: 'bonus', title: '“주식이 두 배가 됩니다” 소식입니다', body: '가진 종목이 무상증자를 한다고 합니다. 수량이 두 배로 늘어난다고 적혀 있습니다.', concept: '무상증자', condition: '주문 시간 중 공개', options: [
    { key: 'A', label: '공짜로 두 배니 더 산다', feedback: '수량이 두 배가 되면 기준가가 절반으로 내려갑니다. 내 주식 전체의 값은 그대로이고 회사에 새 돈이 들어오지도 않습니다.' },
    { key: 'B', label: '내 자산이 늘어나는지 계산해 본다', feedback: '좋은 판단입니다. 피자를 더 잘게 자른 것과 같습니다. 발표 자체가 호재로 읽혀 주가가 움직일 수는 있지만, 회사 가치가 커진 것은 아닙니다.' } ] },
  { id: 'split', title: '주가가 갑자기 5분의 1이 됐습니다', body: '놀라서 봤더니 액면분할이 있었습니다. 수량은 5배로 늘어 있습니다.', concept: '액면분할', condition: '주문 시간 중 공개', options: [
    { key: 'A', label: '싸졌으니 지금 더 산다', feedback: '주가가 낮아진 만큼 수량이 늘어 시가총액은 그대로입니다. 싸진 것이 아니라 잘게 쪼개진 것입니다.' },
    { key: 'B', label: '시가총액이 그대로인지 확인한다', feedback: '좋은 판단입니다. 숫자가 작아 보여 사기 쉬워지는 효과는 있지만, 회사의 값은 바뀌지 않았습니다.' } ] },
  { id: 'short', title: '“공매도로 쉽게 번다”는 글을 봤습니다', body: '주식을 빌려서 먼저 팔고 내려가면 싸게 사서 갚는다고 합니다.', concept: '공매도', condition: '주문 시간 중 공개', options: [
    { key: 'A', label: '나도 해 보고 싶다', feedback: '예상이 틀려 주가가 오르면 비싸게 사서 갚아야 합니다. 주가가 오르는 데는 한계가 없어 손실이 원금보다 커질 수 있습니다.' },
    { key: 'B', label: '손실이 어디까지 커지는지 먼저 본다', feedback: '좋은 판단입니다. 사서 가진 주식은 최악이 0원이지만, 빌려서 판 쪽은 손실 한도가 없습니다.' } ] },
  { id: 'limitup', title: '상한가에 올라간 종목이 보입니다', body: '오늘 30% 올라 더 오르지 못하고 멈춰 있습니다. 매수 주문만 쌓여 있습니다.', concept: '상한가·하한가', condition: '주문 시간 중 공개', options: [
    { key: 'A', label: '내일도 오를 것 같아 지금 걸어 둔다', feedback: '상한가에 쌓인 주문은 내일 가격을 보장하지 않습니다. 다음 날 하한가로 돌아서면 팔 상대가 없어 빠져나오기 어렵습니다.' },
    { key: 'B', label: '왜 올랐는지 공시를 찾아본다', feedback: '좋은 판단입니다. 실적이나 공시로 설명되는 상승과 소문만으로 오른 상승은 다음 날이 다릅니다.' } ] },
  { id: 'settle', title: '팔았는데 돈이 안 보입니다', body: '오늘 주식을 팔았는데 출금 가능 금액이 그대로입니다.', concept: '결제일(T+2)', condition: '주문 시간 중 공개', options: [
    { key: 'A', label: '사고가 난 것 같아 다시 팔아 본다', feedback: '팔린 것은 맞습니다. 주식 거래는 체결 뒤 결제까지 영업일이 더 필요해 대금이 바로 출금되지 않습니다. 다시 팔면 없는 수량을 팔게 됩니다.' },
    { key: 'B', label: '결제일을 확인한다', feedback: '좋은 판단입니다. 체결일과 결제일은 다릅니다. 돈이 필요한 날이 정해져 있다면 결제일을 거꾸로 세어 팔아야 합니다.' } ] },
  { id: 'halt', title: '단톡방에 거래정지 소문이 돌았습니다', body: '“내가 가진 종목이 내일 거래정지된다더라.” 출처는 캡처 한 장입니다.', concept: '거래정지', condition: '주문 시간 중 공개', options: [
    { key: 'A', label: '무서워서 지금 다 판다', feedback: '거래정지는 거래소가 공시로 알립니다. 캡처 한 장에 팔면 소문이 사실이 아닐 때 수수료만 내고 끝납니다.' },
    { key: 'B', label: '공시로 사실인지 확인한다', feedback: '좋은 판단입니다. 공식 공시를 먼저 보면 찌라시와 사실을 나눌 수 있습니다. 사실이라면 정지 사유와 기간이 함께 적혀 있습니다.' } ] },
  { id: 'audit', title: '감사의견 이야기가 나왔습니다', body: '가진 종목의 회계 감사에서 “의견거절”이 나올 수 있다는 기사가 떴습니다.', concept: '감사의견', condition: '주문 시간 중 공개', options: [
    { key: 'A', label: '회계는 내 일이 아니니 넘긴다', feedback: '의견거절은 숫자를 믿기 어렵다는 뜻이고, 거래정지나 상장폐지 심사로 이어질 수 있습니다. 가장 무거운 신호입니다.' },
    { key: 'B', label: '어떤 의견이 나왔는지 확인한다', feedback: '좋은 판단입니다. 적정과 한정, 의견거절은 무게가 전혀 다릅니다. 사업보고서에서 확인할 수 있습니다.' } ] },
  { id: 'vote', title: '주주총회 안내문이 왔습니다', body: '가진 종목에서 의결권을 행사하라는 안내가 왔습니다. 안건은 임원 선임과 배당입니다.', concept: '의결권', condition: '주문 시간 중 공개', options: [
    { key: 'A', label: '한 주뿐이라 버린다', feedback: '보통주는 1주에 1표이고, 주주는 회사의 주인입니다. 표를 쓰지 않아도 손해는 없지만, 안건을 읽어 보는 것만으로 회사를 알게 됩니다.' },
    { key: 'B', label: '안건을 읽고 의사를 밝힌다', feedback: '좋은 판단입니다. 배당을 얼마로 정하는지, 누구를 임원으로 뽑는지가 안건에 적혀 있습니다.' } ] },
  { id: 'divtax', title: '배당금이 생각보다 적게 들어왔습니다', body: '공시된 주당 배당금으로 계산한 금액보다 적습니다.', concept: '배당소득세', condition: '주문 시간 중 공개', options: [
    { key: 'A', label: '회사가 덜 줬다고 항의한다', feedback: '배당금은 배당소득세를 뗀 뒤 계좌에 들어옵니다. 회사가 덜 준 것이 아닙니다.' },
    { key: 'B', label: '세금을 뗀 금액인지 확인한다', feedback: '좋은 판단입니다. 받을 돈을 계산할 때는 세금을 뺀 뒤를 봐야 합니다. 세율과 기준은 바뀔 수 있어 그때 확인해야 합니다.' } ] },
  { id: 'guarantee', title: '“원금 보장 투자” 광고를 봤습니다', body: '“예금보다 안전하고 수익률은 높습니다. 원금을 보장합니다.”', concept: '예금자보호', condition: '주문 시간 중 공개', options: [
    { key: 'A', label: '안전하다니 넣어 본다', feedback: '예금은 한도까지 보호되지만 주식과 펀드는 예금자보호 대상이 아닙니다. 투자에서 원금을 보장한다는 말은 지킬 수 없는 약속입니다.' },
    { key: 'B', label: '보장이 가능한지 의심한다', feedback: '좋은 판단입니다. 등록된 금융회사인지, 무엇에 투자하는지 확인해야 합니다. 보장과 고수익을 함께 말하는 곳은 특히 위험합니다.' } ] },
  { id: 'rate', title: '기준금리 인상 뉴스가 나왔습니다', body: '“금리가 더 오를 수 있다”는 기사입니다. 내가 가진 종목은 적자이고 미래 성장을 기대받는 회사입니다.', concept: '기준금리', condition: '주문 시간 중 공개', options: [
    { key: 'A', label: '금리는 주식과 상관없다', feedback: '금리가 오르면 빌린 돈의 이자 부담이 커지고, 먼 미래의 이익을 더 많이 깎아 평가합니다. 성장주가 더 흔들리는 이유입니다.' },
    { key: 'B', label: '내 종목에 어떻게 닿는지 본다', feedback: '좋은 판단입니다. 같은 금리 뉴스가 빚이 많은 회사에는 비용이고, 이자로 돈을 버는 회사에는 기회일 수 있습니다.' } ] },
  { id: 'churn', title: '수수료 무료 이벤트가 왔습니다', body: '“이번 달 수수료 무료! 마음껏 거래하세요.”', concept: '증권거래세', condition: '주문 시간 중 공개', options: [
    { key: 'A', label: '공짜니까 많이 사고팔아 본다', feedback: '수수료가 없어도 팔 때는 증권거래세가 붙고, 자주 사고팔면 슬리피지까지 쌓입니다. 비용이 0이 되는 것은 아닙니다.' },
    { key: 'B', label: '거래 횟수를 늘릴 이유는 아니라고 본다', feedback: '좋은 판단입니다. 거래가 잦아지면 판단할 시간이 줄고 비용만 늘어나기 쉽습니다.' } ] },
  { id: 'check', title: '오늘 계좌를 쉰 번 열었습니다', body: '시세가 조금 움직일 때마다 확인하다가 일에 집중하지 못했습니다.', concept: '과잉 반응', condition: '주문 시간 중 공개', options: [
    { key: 'A', label: '자주 봐야 빨리 대응한다', feedback: '짧은 움직임은 대부분 잡음입니다. 자주 볼수록 작은 등락에 과잉 반응해 필요 없는 거래를 하게 됩니다.' },
    { key: 'B', label: '확인하는 시간을 정해 둔다', feedback: '좋은 판단입니다. 언제 확인하고 어떤 일이 생기면 움직일지 미리 정해 두면 감정에 끌려가지 않습니다.' } ] }
];

export const stageById = new Map(ARCS.flatMap(a => a.stages.map(s => [s.id, s] as const)));
export const arcOfStage = new Map(ARCS.flatMap(a => a.stages.map(s => [s.id, a] as const)));
export const cardById = new Map(CARDS.map(c => [c.id, c] as const));
