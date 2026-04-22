# LLM Wait Switcher

LLM이 답변을 생성하는 동안 사용자가 지정한 콘텐츠 탭으로 자동 전환하고, 응답이 끝나면 원래 AI 탭으로 자동 복귀하는 크롬 확장 프로그램입니다.

## 주요 기능

- 프롬프트 전송 시 자동으로 지정 탭으로 전환
- 응답 완료 시 원래 탭으로 자동 복귀
- 대상 탭이 미디어 플랫폼이면 자동 재생 시도
- 복귀 시 자동 일시중지 시도
- 여러 생성형 AI 웹 서비스 감지 지원

## 지원 AI 웹 서비스

- ChatGPT
- Claude
- Claude Code (web)
- Gemini
- Google AI Studio
- Cursor Web
- Midjourney
- Microsoft Copilot
- Grok
- Perplexity
- Poe
- DeepSeek
- Le Chat (Mistral)
- Qwen
- Kimi

## 지원 미디어 플랫폼

- YouTube
- Netflix
- Disney+
- Prime Video
- Twitch
- Vimeo

## 파일 구조

```text
llm-wait-switcher/
├─ manifest.json
├─ background.js
├─ llm-content.js
├─ player-content.js
├─ popup.html
├─ popup.css
└─ popup.js