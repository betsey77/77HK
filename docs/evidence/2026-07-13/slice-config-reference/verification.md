# 2026-07-13 配置管理保存参考案例验证

## 根因

`selectedReferenceCaseIds` 只存在于工作台 `AppSettings`，没有进入 `SavedConfig`、云同步序列化或云端恢复映射，因此配置重新载入后会丢失参考案例。

## 修复

- `SavedConfig` 增加 `selectedReferenceCaseIds`。
- ConfigManager 保存、未储存判断、加载和提示均覆盖该字段。
- Supabase `saved_configs.config` JSON 上行/下行保留该字段。
- 旧配置缺失字段时回退为空数组。
- 无数据库 Migration，用户 RLS 不变。

## 验证

- 配置保存 → 清空选择 → 载入配置恢复参考案例：1/1 passed。
- 云同步转换测试：41/41 passed。
- Client full suite: 14 files, 256 tests passed。
- Client TypeScript + Vite production build passed。
- Vite 保留既有大 chunk 提示（主 JS 约 724 kB），不阻断本修复。
