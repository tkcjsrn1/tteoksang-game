# 무료로 배포하기 (Render + Neon)

돈 안 들이고 친구들과 링크로 플레이할 수 있게 올리는 방법입니다. 30~40분이면 됩니다.
2026-11 기준 무료 조건이며, 각 서비스의 정책은 바뀔 수 있으니 가입할 때 한 번 더 확인하세요.

| 역할 | 서비스 | 무료 조건(2026-11 확인) |
|---|---|---|
| 서버(화면·API·WebSocket) | **Render** 무료 웹 서비스 | 월 750시간, 메모리 512MB, 15분 동안 접속이 없으면 잠들고 다시 깨는 데 약 1분. 진행 중인 WebSocket 메시지가 있으면 잠들지 않음. 월 전송량 5GB |
| 데이터베이스 | **Neon** 무료 PostgreSQL | 1GB 저장, 5분 쉬면 잠듦(다음 요청 때 자동으로 깸), 만료 없음 |

Render에도 무료 DB가 있지만 **30일 뒤 만료**되므로 쓰지 않습니다.

## 알아 둘 점
- 처음 접속하는 사람은 서버가 깨는 동안 **약 1분** 기다릴 수 있습니다. 게임이 진행되는 동안에는 잠들지 않습니다.
- 서버가 잠들거나 다시 켜져도 방 상태는 Neon에 저장돼 있어 이어집니다.
- 학술제처럼 중요한 행사는 행사 직전에 한 번 접속해서 서버를 깨워 두세요. 또는 그날만 유료 인스턴스로 올리는 것도 방법입니다.

## 1. Neon에서 데이터베이스 만들기 (10분)
1. https://neon.com 에서 GitHub 계정으로 가입합니다.
2. **New Project** → 이름 `tteoksang`, 지역은 **AWS Asia Pacific (Singapore)** 또는 가장 가까운 아시아 지역을 고릅니다.
3. 만들어지면 **Connect** 버튼 → 연결 문자열(`postgresql://...?sslmode=require`)을 복사해 둡니다.
   - 이 문자열은 비밀번호가 들어 있으니 저장소·메신저에 올리지 마세요.
4. 테이블은 서버가 처음 켜질 때 자동으로 만듭니다. 따로 할 일은 없습니다.

## 2. 코드 준비 (5분)
- PR #1(`improve/glossary-docs-hardening`)을 `main`에 머지합니다. Render는 `main`을 배포합니다.

## 3. Render에서 서버 만들기 (15분)
1. https://render.com 에서 GitHub 계정으로 가입합니다.
2. **New → Blueprint** → GitHub 연결 → `tkcjsrn1/tteoksang-game` 저장소를 고릅니다.
   - 비공개 저장소라면 Render GitHub 앱에 이 저장소 접근을 허용하라는 화면이 나옵니다.
3. 저장소의 `render.yaml`을 읽어 `tteoksang-game` 서비스가 표시됩니다. **DATABASE_URL** 칸에 1번에서 복사한 Neon 연결 문자열을 붙여 넣습니다.
4. **Apply**를 누르면 Docker 이미지를 빌드하고 배포합니다. 처음에는 5~10분 걸립니다.
5. 끝나면 `https://tteoksang-game-xxxx.onrender.com` 같은 주소가 생깁니다.

## 4. 확인 (5분)
- PC의 게임 폴더에서 `npm run smoke -- https://<주소>` 를 실행합니다. 서버 상태, 화면, 방 만들기, 두 사람 WebSocket 입장, 게임 시작까지 자동으로 확인하고 `결과: 통과`를 보여 줍니다. 서버가 잠들어 있었다면 첫 단계에서 1분 가까이 걸릴 수 있습니다.
- `https://<주소>/api/health` → `{"ok":true,"store":"postgres",...}` 이면 성공입니다. `"store":"memory"`면 DATABASE_URL이 빠진 것입니다.
- 휴대폰 두 대로 친구 방을 만들어 한 판 해 보세요. QR에도 이 주소가 들어갑니다.
- 이후 `main`에 머지할 때마다 자동으로 다시 배포됩니다.

## 5. 앱(Android)에서 쓰려면
```bash
VITE_SERVER_URL=https://<주소> npm run cap:sync
```
자세한 출시 절차는 `docs/DEPLOY.md` 5절을 보세요.

## 문제가 생기면
| 증상 | 확인할 것 |
|---|---|
| `npm run smoke`에서 WebSocket 거절(HTTP 4xx) | 주소가 https인지, Render 서비스가 Docker로 떠 있는지 확인 |
| 처음 접속이 1분 가까이 걸림 | 무료 서버가 깨어나는 중입니다. 정상입니다 |
| `"store":"memory"` | Render 대시보드 → Environment → DATABASE_URL 값 |
| 배포 실패 | Render 대시보드 → Events/Logs에서 빌드 로그 확인 |
| 방 만들기가 429로 막힘 | TRUST_PROXY가 `1`인지 확인(안 켜면 모든 사용자가 같은 주소로 보임) |
| 월 중간에 서버가 멈춤 | 무료 시간(750시간)이나 전송량(5GB)을 다 썼는지 Render 대시보드에서 확인 |

## 출시 전 점검표
- [ ] `npm run smoke -- https://<주소>` 통과
- [ ] 휴대폰 2대(서로 다른 통신망: 와이파이 1, LTE 1)로 친구 방 한 판 끝까지
- [ ] 한 판 도중 한 휴대폰의 화면을 껐다 켜도 이어지는지(재접속)
- [ ] 홈 화면 '오늘의 용어', 차트 연습실 수업 1~6 열림
- [ ] Render 대시보드에서 메모리 사용량이 512MB에 한참 못 미치는지

## 다운 알림(선택)
- 무료 서버 감시 서비스(예: UptimeRobot)에 `https://<주소>/api/health`를 등록하면, 서버가 응답하지 않을 때 메일로 알려 줍니다. 무료 조건은 가입할 때 확인하세요.
- 5분마다 확인하도록 하면 Render 무료 서버가 잠들지 않습니다. 서비스 1개를 한 달 내내 켜 두면 약 744시간이라 무료 750시간 안에 들어갑니다(다른 무료 서비스를 같이 쓰면 넘을 수 있음).
- `/api/health`는 방 수, 접속 수, 가동 시간(`uptimeSec`), 메모리(`memoryMB`), 서버 오류 수(`errors`), 배포 버전(`version`)을 보여 줍니다. `errors`가 늘면 Render 대시보드의 Logs에서 "오류"를 찾아보세요.
