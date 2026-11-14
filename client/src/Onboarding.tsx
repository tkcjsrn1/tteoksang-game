/* 처음 방문했을 때 보여 주는 게임 방법 카드 5장(뉴스 → 주문 → 비용 → 지킴장치 → 결과).
   한 번 끝내거나 건너뛰면 이 기기에 기록해 다시 띄우지 않고, 홈의 '게임 방법'으로 다시 볼 수 있습니다. */
import { useEffect, useRef, useState } from 'react';
import { store } from './net';

export const ONBOARDED_KEY = 'onboarded';
export const needsOnboarding = () => store.get(ONBOARDED_KEY) !== '1';

const SLIDES = [
  { title: '같은 뉴스를 함께 봐요', text: '모두 같은 뉴스를 받아요. 핵심은 "시장 기대"와 "단서". 결과가 기대보다 좋을지 나쁠지 판단해 보세요.' },
  { title: '장이 열리면 주문할 수 있어요', text: '시세가 1초마다 움직이고 속보도 떠요. 시장가로 바로 사거나 지정가로 걸어 둘 수 있어요.' },
  { title: '살 때마다 비용이 빠져요', text: '수수료 0.10%(살 때·팔 때), 거래세 0.20%(팔 때). 자주 사고팔면 쌓여요. 큰 주문은 비싼 호가까지 사게 돼 평균 체결가가 불리해집니다.' },
  { title: '잃는 폭을 미리 정해 둘 수 있어요', text: '손절·익절을 걸면 그 가격에 닿을 때 자동으로 팔려요. 값이 갑자기 10% 넘게 튀면 그 종목만 15초 멈춥니다(VI).' },
  { title: '장 마감 때 결과가 공개돼요', text: '결과가 기대보다 좋았는지에 따라 주가가 크게 움직여요. 무엇이 얼마나 영향을 줬는지 막대로 보여 주고, 끝나면 매매일지가 남습니다.' }
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
        <div className="onb-art" aria-hidden="true">{ART[i]}</div>
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
/* 슬라이드 순서대로 쓰는 그림. 장과 그림이 어긋나지 않게 배열로 묶어 둡니다 */
const ART = [<ArtNews key="n" />, <ArtOrder key="o" />, <ArtFee key="f" />, <ArtStop key="s" />, <ArtResult key="r" />];
function ArtFee() {
  return (
    <div className="art-card">
      <div className="art-kv"><span>체결 금액</span><b>870,000원</b></div>
      <div className="art-kv"><span>수수료 0.10%</span><span>-870원</span></div>
      <div className="art-kv"><span>거래세 0.20% (팔 때)</span><span>-1,740원</span></div>
      <b className="art-delta down">사고팔면 -2,610원</b>
    </div>
  );
}
function ArtStop() {
  return (
    <div className="art-card">
      <div className="art-kv"><span>내 평균</span><b>8,700원</b></div>
      <div className="art-kv"><span>손절가</span><span>8,200원</span></div>
      <div className="art-kv"><span>익절가</span><span>9,600원</span></div>
      <span className="art-btn">예약 걸어 두기</span>
    </div>
  );
}
function ArtNews() {
  return (
    <div className="art-card">
      <span className="chip">이번 뉴스</span>
      <b>한빛제과, 신제품 출시 발표 예정</b>
      <div className="art-kv"><span>시장 기대</span><b>매출 300억</b></div>
      <div className="art-kv"><span>단서</span><span>원재료 값이 석 달째 하락</span></div>
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
      <div className="art-vs"><span>기대 300억</span><span>→</span><b>실제 330억</b></div>
      <div className="art-bar"><span>사건 결과</span><i style={{ width: '70%' }} /><b>+380bp</b></div>
      <div className="art-bar"><span>시장 전체</span><i style={{ width: '6%' }} /><b>+20bp</b></div>
      <b className="art-delta">+31,400원</b>
    </div>
  );
}
