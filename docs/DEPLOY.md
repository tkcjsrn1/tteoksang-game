# 배포·출시 가이드

서버 하나가 화면(정적 파일), API, WebSocket을 모두 제공합니다. 운영에는 **HTTPS 주소 하나와 PostgreSQL 하나**가 필요합니다.

## 1. 서버 이미지

```bash
docker build -t tteoksang .
docker run -d --name tteoksang -p 8787:8787 \
  -e DATABASE_URL=postgres://사용자:비밀번호@DB주소:5432/game \
  -e TRUST_PROXY=1 \
  tteoksang
curl http://localhost:8787/api/health   # {"ok":true,"store":"postgres",...}
```

- `DATABASE_URL`이 없으면 메모리에 저장합니다. 서버를 다시 켜면 진행 중인 방이 사라지므로 운영에서는 꼭 넣으세요.
- 테이블은 처음 켤 때 자동으로 만듭니다(`server/src/store.ts`).
- 이미지에는 건강 검사(`/api/health`)가 들어 있습니다.
- `TIME_DIVISOR`, `ALLOW_TEST_HOOKS`는 운영에서 절대 켜지 마세요. 결말을 지정할 수 있게 됩니다.

## 2. HTTPS

Android 앱은 HTTPS(`wss://`)로만 붙습니다. 서버 앞에 리버스 프록시를 두고 `TRUST_PROXY=1`을 켭니다. 켜지 않으면 모든 사용자가 같은 주소로 보여, 방 만들기 제한(주소당 1분에 20개)에 함께 걸립니다.

Caddy를 쓰는 예시입니다. 인증서는 Caddy가 자동으로 받습니다.

```
game.example.com {
  reverse_proxy localhost:8787
}
```

WebSocket 경로는 `/ws`입니다. 다른 프록시를 쓰면 WebSocket 업그레이드를 허용해야 합니다.

## 3. 배포 전 점검

- [ ] `npm test`, `npm run build`, `npm run load` 통과 (CI가 PR마다 자동으로 돌림)
- [ ] `npm run test:pg`를 운영과 같은 PostgreSQL 버전으로 통과
- [ ] `https://주소/api/health`가 `"store":"postgres"`로 응답
- [ ] 휴대폰 두 대로 친구 방을 만들어 한 판 끝까지 진행
- [ ] 한 대의 와이파이를 끊었다 다시 켜도 같은 자리로 돌아오는지 확인

## 4. 학술제 리허설

부하 검증(`npm run load`)은 같은 컴퓨터 안에서 60명을 흉내 낸 것입니다. 실제 행사 전에는 다음을 확인하세요.

- [ ] 행사장 와이파이에서 휴대폰 10대 이상으로 10라운드 한 판
- [ ] 대형 화면 기기는 절전·화면 꺼짐 끄기
- [ ] 운영자 권한은 방을 만든 기기에만 있으므로 그 기기를 바꾸지 않기
- [ ] 행사장 와이파이가 기기끼리의 연결이나 WebSocket을 막지 않는지 확인
- [ ] 서버 로그에 `정산 저장 실패`가 없는지 확인

## 5. Android 앱

```bash
VITE_SERVER_URL=https://game.example.com npm run cap:sync
cd android
./gradlew bundleRelease
```

- 결과물: `android/app/build/outputs/bundle/release/*.aab`
- 서명 키(`*.keystore`)는 저장소에 올리지 않습니다(`.gitignore`에 있음). 잃어버리면 같은 앱으로 업데이트할 수 없으니 따로 백업하세요.
- Google Play에 올리기 전에 **그 시점의 공식 요건**(대상 API 수준, 개인정보처리방침, 데이터 보안 양식, 콘텐츠 등급, 테스트 트랙 요건 등)을 Play Console에서 직접 확인하세요. 요건은 자주 바뀌어 이 문서에 숫자를 적지 않습니다.
- 이 앱은 이름·연락처를 받지 않고, 재접속 토큰과 개인 기록·열어 본 용어만 기기에 저장합니다. 개인정보처리방침에 그대로 적으면 됩니다.
- 실제 돈, 유료 화폐, 보상이 없다는 점을 스토어 설명에 분명히 적으세요. 금융·투자 앱으로 분류되지 않도록 "교육용 시뮬레이션 게임"이라고 소개하는 것이 안전합니다.
