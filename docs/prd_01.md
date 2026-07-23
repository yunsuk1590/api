# PRD 01 — 이미지 인식 (냉장고 사진 → 재료 목록 추출)

- 작성일: 2026-07-23
- 상태: Draft
- 관련 단계: 1/3

## 개요
사용자가 냉장고 내부 사진을 업로드하면, `NVIDIA: Nemotron 3 Nano Omni (free)` 모델을 이용해 사진 속 식재료를 인식하고 구조화된 재료 목록을 반환한다. 이 결과는 2단계(레시피 생성)의 입력으로 그대로 사용된다.

## 목표
- 사용자가 냉장고 사진을 올리면 짧은 시간 안에 식재료 목록을 받는다
- 2단계에서 바로 활용 가능한 구조화된(JSON) 출력 형식을 확보한다

## 범위
**In scope**
- 이미지 업로드 UI
- 업로드 이미지를 처리하는 백엔드 API
- OpenRouter를 통한 모델 호출 및 결과 파싱
- 인식된 재료 목록 표시 및 사용자 수동 보정(추가/삭제/수정)

**Out of scope**
- 레시피 생성 (→ PRD 02)
- 사용자 인증/프로필/저장 (→ PRD 03)
- 유통기한 추적, 하드웨어 센서 연동

## 사용자 흐름
1. 사용자가 웹 UI에서 냉장고 사진을 업로드(또는 촬영)
2. 프론트엔드가 이미지를 백엔드로 전송
3. 백엔드가 이미지를 base64로 인코딩하여 OpenRouter Chat Completions API 호출
4. 모델이 인식한 재료 목록(JSON)을 반환
5. 프론트엔드가 재료 목록을 사용자에게 표시 — 이 화면에서 사용자가 목록을 수정할 수 있음

## 기능 요구사항
| ID | 내용 |
|---|---|
| FR-1 | 이미지 업로드 (jpg/png, 최대 크기 예: 10MB) |
| FR-2 | 백엔드 엔드포인트 `POST /api/inventory/recognize` |
| FR-3 | OpenRouter 호출 — model: `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free` |
| FR-4 | 프롬프트는 구조화된 JSON 출력을 명시적으로 요구 |
| FR-5 | 인식 결과를 사용자가 수동으로 추가/삭제/수정 가능 |
| FR-6 | 인식 실패(502/429 등) 시 지수 백오프 재시도 (최대 N회) |

## 데이터 모델 (2단계로 넘길 인터페이스)
```json
{
  "items": [
    { "name": "계란", "quantity_estimate": "6개", "confidence": "high" },
    { "name": "우유", "quantity_estimate": "1L", "confidence": "medium" }
  ]
}
```

## 기술 노트
- 엔드포인트: `POST https://openrouter.ai/api/v1/chat/completions`
- 인증: `Authorization: Bearer ${OPENROUTER_API_KEY}` — `config.js`의 `validateEnv()`로 존재 여부만 검증하고, 키 값은 어디에도 로그로 남기지 않음
- **이미지 전달 방식**: 외부 이미지 URL 대신 **base64 data URI**로 전달 권장. 실제 테스트에서 Wikimedia 등 일부 호스트가 NVIDIA 서버의 핫링크 요청을 403으로 차단하는 것을 확인함
- **무료 티어 제약**: 동시 요청 제한(`ResourceExhausted: Worker local total request limit reached (16/16)`)으로 인한 간헐적 502 오류가 실제로 발생함 확인 → 재시도 로직이 필수
- 응답을 안정적으로 파싱하기 위해 프롬프트에 "JSON만 출력" 지시 필요

## 비기능 요구사항
- 응답 지연: 평균 5초 이내 목표 (과부하 시 재시도 포함 최대 30초)
- 업로드된 이미지와 API 키는 로그에 남기지 않음

## 성공 기준 (Acceptance Criteria)
- 실제 냉장고 사진 업로드 시 주요 식재료 3개 이상 인식
- API 실패 시 사용자에게 명확한 에러 메시지와 재시도 옵션 제공

## Open Questions
- 재료 수량/신선도까지 인식할지, 이름만 인식할지 범위 확정 필요
- 업로드된 이미지를 저장(재인식/이력용)할지 여부
