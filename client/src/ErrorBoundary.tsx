/* 화면 그리는 중에 오류가 나면 흰 화면 대신 안내를 보여 줍니다.
   React는 렌더링 오류를 클래스 컴포넌트의 getDerivedStateFromError로만 잡을 수 있습니다. */
import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State { return { error }; }
  componentDidCatch(error: Error) { console.error('화면 오류', error); }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="home crash" role="alert">
        <section className="sec">
          <h1 className="h">문제가 생겼어요</h1>
          <p className="lede">화면을 그리는 중에 오류가 났습니다. 새로고침하면 대부분 다시 됩니다.</p>
          <p className="hint">하던 게임은 서버에 남아 있어서, 같은 방 주소로 다시 들어가면 이어서 할 수 있어요.</p>
          <div className="home-actions">
            <button className="cta" onClick={() => location.reload()}>새로고침</button>
            <button className="ghost" onClick={() => { location.hash = '#/'; location.reload(); }}>처음 화면으로</button>
          </div>
          <details className="more">
            <summary>오류 내용</summary>
            <p className="hint num">{this.state.error.message}</p>
          </details>
        </section>
      </main>
    );
  }
}
