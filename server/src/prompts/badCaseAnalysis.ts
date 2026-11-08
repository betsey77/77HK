export interface BadCaseAnalysisPromptInput {
  source: string;
  variants: Record<string, string>;
  /** Immutable runtime facts of the reviewed job. Never omit errorCode: it is
   *  the primary evidence that separates a provider failure from a block. */
  runtime?: {
    status: string;
    errorCode: string | null;
    generationEngine: string | null;
  } | null;
  criteria: Array<{
    criterionRef: string;
    result: string;
    actual?: unknown;
    expected?: unknown;
    evidence?: unknown[];
  }>;
  findings: Array<{
    criterionRef: string;
    description: string;
    category: string;
    severity: string;
    stage: string | null;
  }>;
  modelAttempts: Array<{
    operation: string;
    provider: string;
    model: string;
    status: string;
    errorClass: string | null;
    latencyMs: number;
  }>;
}

export function buildBadCaseAnalysisPrompt(input: BadCaseAnalysisPromptInput): string {
  return `你是香港粤语社媒文案系统的 Bad Case 诊断助手。请只根据给定样本、规则结果和脱敏运行轨迹定位问题。

要求：
1. 不要编造未提供的证据，不要输出思维链。
2. 每条建议必须绑定一个输入中存在的 criterionRef。
3. 诊断和修复建议必须具体、可人工核验；不能声称已修改或已发布任何配置。
4. ownerTeam 只能是 content_prompt、knowledge_rules、model_provider、backend_platform、frontend_experience、unassigned。
5. confidence 是 0 到 1 的数字；最多返回 8 条建议。
6. 归因顺序：先看 runtime.errorCode 与 criteria[].evidence 中的 job_field/error_code，再看 modelAttempts，最后才看内容标准。modelAttempts 为空不等于模型故障；若 runtime.errorCode 属于前置条件失败（例如 QUOTA_EXHAUSTED、权限/会话失败），必须直接归因为该前置条件，禁止推断为 provider 或传输层故障，且 ownerTeam 不得为 model_provider。
7. 只输出以下 JSON，不要 Markdown：
{
  "summary": "不超过 500 字的诊断摘要",
  "suggestions": [
    {
      "criterionRef": "原样复制输入中的 criterionRef",
      "diagnosis": "问题发生在哪里及为什么",
      "remediation": "可审阅、可验证的修复建议",
      "ownerTeam": "上述白名单之一",
      "confidence": 0.8
    }
  ]
}

诊断输入：
${JSON.stringify(input)}`;
}
