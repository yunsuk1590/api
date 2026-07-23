# PRD 03 — 사용자 프로필 및 레시피 저장

- 작성일: 2026-07-23
- 상태: Draft
- 관련 단계: 3/3
- 의존성: PRD 02에서 생성된 레시피를 저장 대상으로 사용

## 개요
사용자 계정/프로필을 만들고, PRD 02에서 생성된 레시피를 프로필에 저장·조회·삭제할 수 있게 한다. CLAUDE.md 기준 DB는 Supabase를 사용한다.

## 목표
- 사용자가 로그인하여 자신만의 레시피를 저장/관리할 수 있게 한다
- 프로필의 알레르기/비선호 재료/식단 유형을 PRD 02의 레시피 생성 프롬프트에 자동 반영한다

## 범위
**In scope**
- 사용자 인증 (가입/로그인)
- 프로필 관리 (알레르기, 비선호 재료, 식단 유형 등)
- 레시피 저장/조회/삭제

**Out of scope**
- 소셜 기능(공유, 댓글, 평점)
- 결제
- 하드웨어 센서 연동

## 사용자 흐름
1. 사용자가 가입/로그인 (Supabase Auth)
2. 프로필 설정: 알레르기, 비선호 재료, 채식 여부 등 입력
3. PRD 02에서 생성된 레시피 중 "저장" 클릭 시 DB에 저장 (`user_id` 연결)
4. "내 레시피" 페이지에서 저장된 레시피 목록 조회/삭제
5. 이후 PRD 02 호출 시 프로필의 제약 조건이 프롬프트에 자동 반영됨

## 기능 요구사항
| ID | 내용 |
|---|---|
| FR-1 | Supabase Auth 연동 (email/password, 필요시 OAuth) |
| FR-2 | `profiles` 테이블 관리 API |
| FR-3 | `saved_recipes` 테이블에 레시피 저장/조회/삭제 |
| FR-4 | `POST /api/recipes/save`, `GET /api/recipes/saved`, `DELETE /api/recipes/saved/:id` |
| FR-5 | PRD 02 호출 시 프로필의 `allergies`/`dislikes`/`diet_type`을 프롬프트에 자동 포함 |

## 데이터 모델 (Supabase 마이그레이션 초안)
```sql
create table profiles (
  user_id uuid references auth.users primary key,
  allergies text[] default '{}',
  dislikes text[] default '{}',
  diet_type text,
  created_at timestamptz default now()
);

create table saved_recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  title text not null,
  ingredients jsonb not null,
  steps jsonb not null,
  source_items jsonb, -- PRD 01에서 인식된 재료 스냅샷
  created_at timestamptz default now()
);
```
- CLAUDE.md 컨벤션에 따라 마이그레이션 파일로 스키마 관리 (수동 SQL 실행 금지)
- RLS(Row Level Security) 정책 필요: 본인 데이터만 read/write 가능

## 기술 노트
- 인증 토큰은 프론트엔드 세션에서 관리, 백엔드는 Supabase 세션을 검증
- `source_items`(PRD 01 인식 결과)를 함께 저장해두면, 나중에 "이 레시피는 어떤 재료로 만들었는지" 추적 가능

## 성공 기준 (Acceptance Criteria)
- 로그인한 사용자가 레시피를 저장하면 새로고침 후에도 유지됨
- RLS 검증: 다른 사용자 계정에서는 타인의 저장 레시피가 보이지 않음

## Open Questions
- 이메일/비밀번호만 지원할지, 소셜 로그인을 포함할지
- 알레르기/비선호 재료 입력을 자유 텍스트로 받을지, 사전 정의 목록에서 선택하게 할지
