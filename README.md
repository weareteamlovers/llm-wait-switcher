<div align="center">

# LLM Wait Switcher

**생성형 AI가 답변을 만드는 동안, 지정한 콘텐츠 탭으로 자동 전환하고  
응답이 끝나면 원래 AI 탭으로 자동 복귀하는 Chrome Extension**

<br />

**ChatGPT · Claude · Gemini 최적화 지원**  
대기 시간은 덜 지루하게, 복귀는 더 정확하게.

</div>

---

## Overview

**LLM Wait Switcher**는  
ChatGPT, Claude, Gemini 같은 생성형 AI 서비스에서 답변을 기다리는 동안  
사용자가 미리 지정한 탭으로 자동 이동하고,  
응답이 완료되면 다시 원래 AI 탭으로 돌아오게 해주는 크롬 확장 프로그램입니다.

단순 알림형 확장 프로그램과 다르게,  
이 확장 프로그램은 **탭 전환 → 대기 → 완료 감지 → 원래 탭 복귀**까지  
한 흐름으로 자동화하는 데 초점을 맞추고 있습니다.

---

## Features

### 1. 자동 탭 전환
AI에게 질문을 보내고 응답 생성이 시작되면,  
사용자가 선택한 **콘텐츠 탭**으로 자동 이동합니다.

### 2. 자동 복귀
AI 응답이 끝났다고 판단되면  
기존의 **원래 AI 탭으로 자동 복귀**합니다.

### 3. 정확도 개선된 응답 완료 감지
다음과 같은 여러 신호를 조합해 답변 종료 시점을 판별합니다.

- 네트워크 요청 안정화
- Stop 버튼/생성 중 UI 변화
- 입력창 재활성화 여부
- Copy / 재생성 계열 UI 등장
- DOM 변화 안정화

### 4. 콘텐츠 탭 직접 선택
기존처럼 “현재 탭을 그대로 저장”하는 방식이 아니라,  
팝업에서 **열려 있는 탭 목록 중 원하는 탭을 직접 선택**할 수 있습니다.

### 5. 주요 LLM 서비스 최적화
현재 다음 서비스에 대해 우선적으로 감지 로직을 보정했습니다.

- ChatGPT
- Claude
- Gemini

그 외 서비스는 generic fallback 로직으로 동작합니다.

### 6. 미디어 탭 활용 가능
콘텐츠 탭이 YouTube 같은 미디어 성격의 페이지라면,  
대기 시간 동안 그 탭을 활용하는 흐름으로 사용할 수 있습니다.

---

## Why this extension?

생성형 AI를 자주 쓰다 보면 이런 순간이 반복됩니다.

- 답변 생성이 길어짐
- 그동안 다른 탭으로 이동함
- 언제 끝났는지 몰라 다시 확인해야 함
- 너무 일찍 돌아가거나, 너무 늦게 확인하게 됨

LLM Wait Switcher는 이 불편을 줄이기 위해 만들었습니다.

**“기다리는 시간은 다른 콘텐츠를 보고,  
끝나면 다시 정확하게 돌아오기”**

이 한 가지 경험을 자연스럽게 만드는 것이 목적입니다.

---

## Tech Highlights

이 확장 프로그램은 단순한 클릭 감지 하나에만 의존하지 않습니다.

### Multi-signal start detection
응답 생성 시작을 더 안정적으로 잡기 위해 다음을 함께 고려합니다.

- 전송 버튼 클릭
- Enter / submit 이벤트
- 페이지 상태 변화
- 네트워크 요청 감지

### Multi-signal completion detection
응답 종료 시점을 더 정확하게 포착하기 위해 다음을 조합합니다.

- 생성 관련 네트워크 settle 상태
- Stop 버튼 사라짐
- 입력 가능 상태 복귀
- Copy / 재생성 UI 등장
- DOM quiet window

### Background session control
백그라운드에서 현재 세션 상태를 관리하며,

- 어떤 AI 탭에서 시작했는지
- 어떤 콘텐츠 탭으로 이동할지
- 언제 복귀해야 하는지

를 일관되게 처리합니다.

---

## File Structure

```text
llm-wait-switcher/
├─ manifest.json
├─ background.js
├─ llm-content.js
├─ page-bridge.js
├─ player-content.js
├─ popup.html
├─ popup.css
└─ popup.js
