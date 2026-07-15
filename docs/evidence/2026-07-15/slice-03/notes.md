# Evidence Notes - slice-03: pro-250-quota-full-verification

## Slice Goal

将 Pro 每自然月额度从 400 调整为 250，并让存量 Pro 当前周期立即生效且不清零已用额度。

## Requirement Trace

- PRD: `spec/PRD.md` CR-2026-07-15-change
- SDD: `spec/SDD.md`「Pro 每自然月 250 次」
- TEST_PLAN: `spec/TEST_PLAN.md` CR-2026-07-15-change

## Commands Run

```text
C:\Program Files\nodejs\npm.CMD run verify
```

## Evidence Files

- Test output: test-output.txt
- Desktop screenshot: `frames/pro-250-pricing-desktop.png`
- Mobile screenshot: `frames/pro-250-pricing-mobile.png`
- Frames/recording:
- State snapshot:

## Result

- Done / Not Done: Done
- Automated: Client 372/372；Server 560/560；双端 typecheck/build；两次 audit 均通过。
- Browser: desktop 1440px 与 mobile 390px 均显示 250，不含 400，且无横向溢出。
- Remote: Migration `20260715113350` 已推送；Pro 为 `250 / month / 1`；249/250/251 RPC 边界通过并回滚。

## Remaining Risks

- 未部署应用、未 commit 或 push Git。
