/* 혼자 연습 첫 판의 따라 하기 안내. 화면 상태만 보고 지금 몇 단계인지 정합니다.
   React를 쓰지 않는 순수 함수라 tests/coach.test.ts에서 바로 검사합니다. */
import type { RoomView, StockCode } from '../../shared/types';

export interface CoachStep { no: number; total: number; title: string; text: string; target: StockCode | null }

export const COACH_TOTAL = 5;

/** 첫 라운드 뉴스가 가리키는 종목. 따라 하기에서 강조합니다. */
export function coachTarget(view: RoomView): StockCode | null {
  const cards = view.news.find(r => r.round === 1)?.cards ?? [];
  return cards[0]?.card.targets[0] ?? null;
}

/** 지금 보여 줄 단계. 안내가 끝났거나 해당 없으면 null */
export function coachStep(view: RoomView, openStock: StockCode | null): CoachStep | null {
  if (view.mode !== 'solo' || view.status !== 'playing' || view.round !== 1 || view.you.role !== 'player') return null;
  const target = coachTarget(view);
  const name = view.stocks.find(s => s.code === target)?.name ?? '뉴스에 나온 종목';
  const hasOrder = (view.portfolio?.orders.length ?? 0) > 0;
  const step = (no: number, title: string, text: string): CoachStep => ({ no, total: COACH_TOTAL, title, text, target });
  if (view.phase === 'news') return step(1, '뉴스를 네 칸으로 읽어요',
    '“시장의 기대치”가 기준점입니다. 실제 결과가 이보다 좋으면 오르고, 나쁘면 내립니다. “주문 전 단서”는 결과가 어느 쪽일지 알려 주는 힌트예요. 밑줄 친 낱말을 누르면 뜻이 나옵니다.');
  if (view.phase === 'trade' && hasOrder) return step(4, '예약 완료! 마감을 기다려요',
    '주문은 마감 때 지금 가격(기준가)으로 한꺼번에 체결됩니다. 마감 전까지는 바꾸거나 취소할 수 있어요.');
  if (view.phase === 'trade' && openStock) return step(3, '수량을 넣고 매수 예약',
    '처음이니 10주만 사 볼까요? 수량 칸에 10을 넣고 “매수 예약”을 누르세요. 단서가 나쁜 쪽을 가리킨다면 사지 않는 것도 판단입니다.');
  if (view.phase === 'trade') return step(2, `${name}을(를) 눌러 보세요`,
    '아래 시장 목록에서 빛나는 종목이 이번 뉴스의 주인공입니다. 눌러서 가격과 주문 창을 여세요.');
  if (view.phase === 'settling' || view.phase === 'recap') return step(5, '기대와 결과를 비교해요',
    '실제 결과가 기대치보다 좋았는지 확인하세요. 종목을 누르고 그래프의 점을 누르면 가격이 왜 움직였는지 bp 단위로 나옵니다. 다음 라운드부터는 혼자 해 보세요!');
  return null;
}
