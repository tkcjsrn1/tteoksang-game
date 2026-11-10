/* 혼자 연습 첫 판의 따라 하기 안내. 화면 상태만 보고 지금 몇 단계인지 정합니다.
   React를 쓰지 않는 순수 함수라 tests/coach.test.ts에서 바로 검사합니다. */
import type { RoomView, StockCode } from '../../shared/types';

export interface CoachStep { no: number; total: number; title: string; text: string; target: StockCode | null }

export const COACH_TOTAL = 5;

/** 받침이 있으면 '을', 없으면 '를'. 한글로 끝나지 않으면 '을(를)'을 씁니다. */
export function eulReul(word: string): string {
  const c = word.charCodeAt(word.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return `${word}을(를)`;
  return `${word}${(c - 0xac00) % 28 ? '을' : '를'}`;
}

/** 첫 라운드 뉴스가 가리키는 종목. 따라 하기에서 강조합니다. */
export function coachTarget(view: RoomView): StockCode | null {
  const cards = view.news.find(r => r.round === 1)?.cards ?? [];
  return cards[0]?.card.targets[0] ?? null;
}

/** 지금 보여 줄 단계. 안내가 끝났거나 해당 없으면 null */
export function coachStep(view: RoomView, openStock: StockCode | null, watching = false): CoachStep | null {
  if (view.mode !== 'solo' || view.status !== 'playing' || view.round !== 1 || view.you.role !== 'player') return null;
  const target = coachTarget(view);
  const name = view.stocks.find(s => s.code === target)?.name ?? '뉴스에 나온 종목';
  const hasOrder = (view.portfolio?.orders.length ?? 0) > 0 || !!view.portfolio?.fillLog.some(f => f.round === view.round);
  const step = (no: number, title: string, text: string): CoachStep => ({ no, total: COACH_TOTAL, title, text, target });
  if (view.phase === 'news') return step(1, '시장 기대와 단서를 읽어요',
    '“시장 기대”가 기준점입니다. 실제 결과가 이보다 좋으면 오르고, 나쁘면 내립니다. “단서”는 결과가 어느 쪽일지 알려 주는 힌트예요. 밑줄 친 낱말을 누르면 뜻이 나옵니다.');
  if (view.phase === 'trade' && hasOrder) return step(4, '주문 완료! 시세를 지켜봐요',
    '가격은 1초마다 움직이고, 마감 때 뉴스의 실제 결과가 공개되면 크게 움직입니다. 그 전까지 더 사거나 팔 수 있어요. 원하는 가격을 정해 걸어 두는 “지정가” 주문도 있어요.');
  if (view.phase === 'trade' && !openStock && watching) return step(4, '시세를 지켜봐요',
    '장 마감 뒤 시장 기대와 실제 결과를 비교해 보세요. 마감 전에는 언제든 종목을 다시 열어 주문할 수 있어요.');
  if (view.phase === 'trade' && openStock) return step(3, '매수할지 지켜볼지 골라요',
    '시장 기대와 단서를 바탕으로 결정해 보세요. 매수하려면 수량과 비용을 확인하세요. 주문 없이 결과를 기다려도 됩니다.');
  if (view.phase === 'trade') return step(2, `${eulReul(name)} 눌러 보세요`,
    '뉴스 아래 버튼을 누르면 관련 종목의 가격과 주문 창이 열려요.');
  if (view.phase === 'settling' || view.phase === 'recap') return step(5, '기대와 결과를 비교해요',
    '실제 결과가 기대치보다 좋았는지 확인하세요. 종목을 누르고 그래프의 점을 누르면 가격이 왜 움직였는지 bp 단위로 나옵니다. 다음 라운드부터는 혼자 해 보세요!');
  return null;
}
