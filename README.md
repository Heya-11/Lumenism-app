# Lumenism (웹 · Android 버전)

이 폴더를 GitHub에 올리면 휴대폰(Android Chrome)에서 앱처럼 설치해 쓸 수 있어요.
갤럭시 폴드의 커버 화면 · 내부 화면 · 플렉스 모드에 맞춘 화면 구성이 들어 있어요. 사용법은 `MANUAL.md` 17장을 보세요.

---

## 1. GitHub에 올리기 (GitHub Pages)

1. https://github.com 에 로그인하고 오른쪽 위 **+ → New repository**를 눌러요.
   - Repository name: 원하는 이름 (예: `lumen-app`). 주소에 그대로 들어가요.
   - **Public**을 골라요. (무료 계정의 GitHub Pages는 공개 저장소에서만 돼요. 아래 '공개 범위' 참고)
   - **Create repository**.
2. 만든 저장소 화면에서 **uploading an existing file** 링크(또는 **Add file → Upload files**)를 눌러요.
3. 이 폴더(`Lumenism-web`) **안의 파일과 폴더를 전부** 끌어다 놓아요. `index.html`이 저장소 맨 위에 있어야 해요.
   - 숨김 파일 `.nojekyll`도 함께 올려야 해요. 탐색기에서 안 보이면 '숨긴 항목 표시'를 켜세요. 빠뜨리면 `nojekyll.txt`라는 이름으로 빈 파일을 만들어 올린 뒤 GitHub에서 이름을 `.nojekyll`로 바꿔도 돼요.
4. 아래 **Commit changes**를 눌러요.
5. 저장소의 **Settings → Pages**로 가서
   - Source: **Deploy from a branch**
   - Branch: **main**, 폴더 **/(root)** → **Save**
6. 1~2분 뒤 같은 화면 위쪽에 주소가 나와요. 예: `https://내아이디.github.io/lumen-app/`

## 2. 휴대폰에 설치하기

1. 폴드에서 **Chrome**으로 위 주소를 열어요.
2. 오른쪽 위 **⋮ → 홈 화면에 추가 → 설치**(또는 '앱 설치')를 눌러요.
3. 홈 화면의 **Lumenism** 아이콘으로 열어요. 주소창 없이 앱처럼 열려요.
4. 처음 열면 아래에 **첫 실행 준비** 창이 뜨고 AI 엔진·모델·글꼴(약 420MB)을 휴대폰에 저장해요. **Wi-Fi에서** 받으세요. 다 받으면 인터넷 없이도 모든 기능을 쓸 수 있어요.

## 3. 업데이트하기

새 버전 파일을 받으면 GitHub 저장소에 같은 방식으로 다시 올려요(같은 이름의 파일은 덮어써져요).
앱은 실행할 때 새 파일을 확인해서, **다음에 열 때** 새 버전으로 바뀌어요. `sw.js`가 바뀐 업데이트는 앱 위쪽에 '새 버전이 있어요 · 새로고침'이 떠요.
받아 둔 AI 모델은 업데이트해도 다시 받지 않아요.

---

## 공개 범위 (꼭 읽어 주세요)

- GitHub Pages 주소는 **주소를 아는 사람은 누구나** 열 수 있어요. 그래서 검색엔진에 나오지 않도록 `robots.txt`와 `noindex` 표시를 넣어 두었어요. 주소를 공유하지 않으면 사실상 찾기 어렵지만, 잠금은 아니에요.
- 공개 저장소라서 GitHub에서 코드도 보이고, 누구나 받아 갈 수 있어요.
- 다른 사람이 앱을 열어도 **여러분의 사진이나 보정 내용은 볼 수 없어요.** 사진은 각자 휴대폰 안에서만 처리돼요.

### 나만 쓰도록 잠그고 싶다면 (무료)
1. 저장소를 **Private**으로 바꿔요(Settings → General 맨 아래 → Change visibility). 이러면 GitHub Pages는 꺼져요.
2. https://dash.cloudflare.com 에서 **Workers & Pages → Create → Pages → Connect to Git**으로 이 비공개 저장소를 연결해요. 빌드 설정은 비워 두고(Framework: None, Build command 없음, Output directory `/`) 배포해요. 주소는 `https://이름.pages.dev`가 돼요.
3. Cloudflare의 **Zero Trust → Access → Applications**에서 위 주소를 추가하고, 정책을 **Emails: 내 이메일**로 정해요.
4. 이제 그 주소는 내 이메일로 온 인증 코드를 넣어야만 열려요. 인증 전에는 파일 하나도 내려가지 않아서 코드도 볼 수 없어요.

Cloudflare 무료 요금 조건은 바뀔 수 있으니 가입할 때 확인하세요.

---

## 폴더 구성
```
index.html              앱 본체
sw.js                   오프라인 저장(서비스 워커)
manifest.webmanifest    앱 설치 정보(이름·아이콘)
robots.txt, .nojekyll   검색 차단 · GitHub Pages 설정
css/  js/  assets/      스타일 · 코드 · 아이콘
MANUAL.md               기능 설명서 (17장: 모바일)
```
PC에서도 같은 주소를 열면 PC 화면 구성으로 그대로 쓸 수 있어요.
