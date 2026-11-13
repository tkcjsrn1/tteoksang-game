/* 처음 방문했을 때 보여 주는 게임 방법 카드 5장(뉴스 → 주문 → 비용 → 지킴장치 → 결과).
   한 번 끝내거나 건너뛰면 이 기기에 기록해 다시 띄우지 않고, 홈의 '게임 방법'으로 다시 볼 수 있습니다. */
import { useEffect, useRef, useState } from 'react';
import { store } from './net';

export const ONBOARDED_KEY = 'onboarded';
export const needsOnboarding = () => store.get(ONBOARDED_KEY) !== '1';

const SLIDES = [
  { title: '같은 뉴스를 함께 봐요', text: '모두가 같은 가상 뉴스를 받습니다. 핵심은 "시장 기대"와 "단서"예요. 결과가 기대보다 좋을지 나쁠지 판단해 보세요.' },
  { title: '장이 열리면 주문할 수 있어요', text: '시세가 1초마다 움직이고 중간에 속보가 뜨기도 해요. 시장가로 바로 사거나, 원하는 가격을 지정가로 걸어 둘 수 있어요.' },
  { title: '살 때마다 비용이 빠져요', text: '수수료는 사고팔 때 0.10%, 팔 때는 증권거래세 0.20%가 더 붙어요. 한 번은 작아 보여도 자주 사고팔면 쌓입니다. 큰 주문은 호가가 비싼 쪽까지 사게 돼 평균 체결가가 불리해져요.' },
  { title: '잃는 폭을 미리 정해 둘 수 있어요', text: '손절·익절을 걸어 두면 그 가격에 닿을 때 자동으로 팔려요. 가격이 갑자기 10% 넘게 튀면 그 종목만 15초 거래가 멈춥니다(변동성 완화장치).' },
  { title: '장 마감 때 결과가 공개돼요', text: '뉴스의 실제 결과가 기대보다 좋았는지 나빴는지에 따라 주가가 크게 움직입니다. 무엇이 얼마나 영향을 줬는지 막대로 보여 주고, 판이 끝나면 매매일지에 내 거래를 모아 줘요.' }
] as const;

export function Onboarding({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { titleRef.current?.focus(); }, [i]);
  const finish = () => { store.set(ONBOARDED_KEY, '1'); onDone(); };
  const last = i === SLIDES.length - 1;
  return (
    <div className="onb-wrap" role="dialog" aria-modal="true" aria-label="게임 방법">
      <div className="onb">
        <div className="onb-top">
          <span className="onb-dots" role="img" aria-label={`${i + 1}번째 슬라이드, 전체 ${SLIDES.length}장`}>{SLIDES.map((_, k) => <i key={k} className={k === i ? 'on' : ''} />)}</span>
          <button className="link" onClick={finish}>건너뛰기</button>
        </div>
        <div className="onb-art" aria-hidden="true">{i === 0 ? <ArtNews /> : i === 1 ? <ArtOrder /> : <ArtResult />}</div>
        <h2 className="onb-title" tabIndex={-1} ref={titleRef}>{SLIDES[i].title}</h2>
        <p className="onb-text">{SLIDES[i].text}</p>
        <div className="onb-actions">
          {i > 0 && <button className="ghost" onClick={() => setI(i - 1)}>이전</button>}
          <button className="cta" onClick={() => last ? finish() : setI(i + 1)}>{last ? '시작하기' : '다음'}</button>
        </div>
      </div>
    </div>
  );
}

/* 카드 그림: 실제 화면을 단순하게 줄인 모형 */
function ArtNews() {
  return (
    <div className="art-card">
      <span className="chip">이번 뉴스</span>
      <b>도르넴, 분기 실적 발표 하루 앞</b>
      <div className="art-kv"><span>시장 기대</span><b>영업이익 120억</b></div>
      <div className="art-kv"><span>단서</span><span>경쟁사 2곳 운임 인상</span></div>
    </div>
  );
}
function ArtOrder() {
  return (
    <div className="art-card">
      <div className="art-seg"><span className="on">매수</span><span>매도</span></div>
      <b className="art-qty">100주</b>
      <div className="art-kv"><span>총 빠져나갈 돈</span><b>871,740원</b></div>
      <span className="art-btn">100주 매수</span>
    </div>
  );
}
function ArtResult() {
  return (
    <div className="art-card">
      <div className="art-vs"><span>기대 120억</span><span>→</span><b>실제 140억</b></div>
      <div className="art-bar"><span>사건 결과</span><i style={{ width: '70%' }} /><b>+450bp</b></div>
      <div className="art-bar"><span>시장 전체</span><i style={{ width: '6%' }} /><b>+20bp</b></div>
      <b className="art-delta">+36,260원</b>
    </div>
  );
}
