# 냉장고 재료 인식 &amp; 레시피 추천

냉장고 내부 사진을 업로드하면 AI가 식재료를 인식하고, 인식된 재료로 만들 수 있는 레시피를 추천해주는 웹 앱입니다. [OpenRouter](https://openrouter.ai/)의 무료 비전 모델(`nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free`)을 사용합니다.

## 주요 기능

- 냉장고 사진 업로드 → 식재료 목록 자동 인식 (이름 / 수량 추정 / 신뢰도)
- 인식된 재료 직접 추가·수정·삭제
- 보유 재료 기반 레시피 추천 (제목, 재료, 조리법, 예상 시간, 난이도)

## 기술 스택

- Backend: Node.js, Express, Multer
- Frontend: Vanilla HTML/CSS/JavaScript
- AI: OpenRouter Chat Completions API

## 시작하기

```bash
npm install
cp .env.example .env   # OPENROUTER_API_KEY 입력
npm run dev
```

서버가 시작되면 `http://localhost:3000`에서 확인할 수 있습니다.

## 프로젝트 구조

```
server/     Express 서버 및 OpenRouter 연동
public/     프론트엔드 (HTML/CSS/JS)
docs/       PRD 문서
config.js   환경 변수 검증
```

## 문서

- [PRD 01 - 이미지 인식](docs/prd_01.md)
- [PRD 02 - 레시피 생성](docs/prd_02.md)
- [PRD 03 - 사용자 프로필 및 레시피 저장](docs/prd_03.md)
