/* 처음 방문했을 때 보여 주는 게임 방법 카드 3장(뉴스 → 주문 → 결과).
   한 번 끝내거나 건너뛰면 이 기기에 기록해 다시 띄우지 않고, 홈의 '게임 방법'으로 다시 볼 수 있습니다. */
import { useEffect, useRef, useState } from 'react';
import { store } from './net';

export const ONBOARDED_KEY = 'onboarded';
export const needsOnboarding = () => store.get(ONBOARDED_KEY) !== '1';

const SLIDES = [
  { title: '같은 뉴스를 함께 봐요', text: '모두가 같은 가상 뉴스를 받습니다. 핵심은 "시장 기대"와 "단서"예요. 결과가 기대보다 좋을지 나쁠지 판단해 보세요.' },
  { title: '90초 안에 주문을 예약해요', text: '살 종목과 수량을 고르면 예약됩니다. 마감 때 지금 가격으로 한꺼번에 체결되니, 손이 빠를 필요는 없어요.' },
  { title: '왜 올랐는지 바로 알려 줘요', text: '결말이 공개되면 주가가 기대와의 차이만큼 움직입니다. 무엇이 얼마나 영향을 줬는지 막대로 보여 줘요.' }
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
          <span className="onb-dots" aria-label={`${i + 1}/${SLIDES.length}`}>{SLIDES.map((_, k) => <i key={k} className={k === i ? 'on' : ''} />)}</span>
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
      <span className="art-btn">100주 매수 예약</span>
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
