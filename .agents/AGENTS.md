# 실적집계 대시보드 프로젝트 에이전트 규칙 (Workspace Rules)

## 견고한 프론트엔드 데이터 핸들링 4대 원칙

백엔드 API 데이터를 연동할 때 런타임 에러, 데이터 누락, 중복 연산 등을 원천 차단하기 위해 다음의 4대 원칙을 **항상 준수**해야 합니다:

1. **방어적 파싱 (Defensive Parsing)과 기본값 할당**
   - API 응답 파싱 시 ?.(Optional Chaining) 및 ||, ??(Null 병합 연산자)를 적극 활용하여 에러를 방어하세요.
   - 숫자형 데이터는 Number(val || 0) 등의 형태로 엄격하게 캐스팅하여 NaN을 방어하세요.
   - 배열 순회 시에는 반드시 Array.isArray()로 먼저 체킹하세요.

2. **SSOT (단일 진실 공급원) 패턴: 요약본 우선주의**
   - 프론트엔드에서 데이터를 루프(Loop)로 직접 연산하여 총합을 구하는 방식을 지양하세요. 
   - 백엔드에서 미리 집계한 Summary 객체(예: oomSummary.totalRoomRevenue)가 있다면 해당 값을 **최우선(SSOT)**으로 UI에 바인딩해야 합니다.

3. **엄격한 사전(Enum) 기반의 맵핑**
   - .includes() 같은 부분 문자열 검색이나 하드코딩된 예외처리를 지양하세요.
   - 가변적인 문자열이 들어올 경우 컴포넌트 내부나 외부 유틸에 1:1 매핑 사전(CHANNEL_ENUM 등)을 구축하고 정규화(Normalization) 파이프라인을 거치도록 하세요.

4. **다형성 데이터의 정규화 레이어 구축**
   - 구조가 수시로 바뀌는 API 응답 데이터(V3, V4, V5 등)를 컴포넌트(Chart, Table) State에 직접 주입하지 마세요.
   - 중간에 정규화 레이어(Data Transformer) 함수를 두어, UI가 기대하는 단일 구조로 재조립 후 컴포넌트에 넘겨야 합니다.
   - **V5 API 기간 조회(Date Range) 대응**: V5 백엔드는 기간 조회 시 단일 객체가 아닌 **배열(Array)**을 반환합니다. 프론트엔드는 반드시 API 모듈이나 `dataNormaliser`에서 이를 단일 객체로 Aggregation(일일 실적 합산, 누적 실적 덮어쓰기)한 뒤 UI에 주입해야 합니다.

## 보안 및 접근 통제 구역 (Strict Boundaries)

1. **오직 프론트엔드 작업에만 전념할 것**
   - 이 대화방(세션)에서는 **절대로 백엔드(belleforet-data 등) 레포지토리나 코드에 접근해서는 안 됩니다.**
   - 오로지 프론트엔드 깃허브 레포지토리(`https://github.com/tjkim448532/sales-aggregation-app`)만 접근하고 관리하세요.
   - 백엔드 수정이 필요한 경우, 코드를 직접 고치지 말고 사용자에게 "백엔드 대화창에서 수정해달라"고 명확히 요청하세요.

2. **CORS 회피 및 Vercel 배포 규정**
   - Vercel 등 정적 웹 호스팅 환경에서 백엔드(`https://belleforet-data.vercel.app`)를 브라우저에서 직접 호출(Direct Fetch)하면 **CORS 에러**가 발생합니다.
   - 따라서 프로덕션(Production) 빌드 시에도 반드시 `next.config.ts`의 `rewrites` 기능을 활용해야 하며, `api.ts`의 `getApiBase()`는 항상 상대경로(`""`)를 반환하여 Next.js 서버리스 프록시를 타도록 구성해야 합니다.
