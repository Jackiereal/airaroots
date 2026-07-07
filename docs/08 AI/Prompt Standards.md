# Prompt Standards

---

## General Rules

1. **System prompt is constant** — domain context, role definition, output format requirements
2. **User message includes data** — property context, task description, output schema
3. **Always request structured output** — JSON with defined schema, not prose
4. **Include constraints** — floor/ceiling values, data range limits, confidence requirements
5. **Version prompts** — when changing a prompt, increment version and document the change
6. **Test prompts with edge cases** — empty data, outliers, short history

---

## Prompt Template

```typescript
const PROMPT_TEMPLATE = {
  system: `[Role definition]
[Domain context]
[Tone and style requirements]
[Output format requirements]
[Constraints]`,

  user: (context: object, task: string, schema: string) => `
## Property Context
${JSON.stringify(context, null, 2)}

## Task
${task}

## Required Output Format
Return JSON matching this exact TypeScript type:
${schema}

Important constraints:
- [list specific constraints]
- confidence must be between 0.0 and 1.0
- all monetary values in INR (numbers, not strings)
`,
};
```

---

## Pricing Prompt (v1.0)

```typescript
const PRICING_PROMPT_V1 = `
Analyze the property data and recommend optimal nightly rates for each unbooked target date.

Rules:
1. Weekends (Fri/Sat nights) may be priced 15-40% higher than weekdays
2. Long weekends and Indian holidays may command 50-150% premium
3. Recommended rate must be between min_rate and max_rate
4. If historical data is insufficient (< 3 months), set confidence ≤ 0.4
5. If a date is already booked for >70% of adjacent dates, set rate toward max_rate
6. Do not recommend raising rates if occupancy for the month is already > 85%

Return a JSON array with one object per target date.
Each object must have: date, recommended_rate, min_rate, max_rate, confidence, reason
`;
```

---

## Anomaly Detection Prompt (v1.0)

```typescript
const ANOMALY_PROMPT_V1 = `
You are reviewing expense anomalies for a short-term rental property.
Statistical analysis has already identified the following anomalies (expenses > 2 std deviations above historical mean).

For each anomaly, provide:
1. A brief explanation of why this might have happened (normal operational reason)
2. Whether this warrants investigation (true/false)
3. A suggested action for the property manager

Return JSON array with: category, explanation, requires_investigation, suggested_action, confidence
`;
```

---

## Prompt Versioning

All prompts are stored in code with version numbers:

```typescript
// src/domains/ai/prompts/pricing.prompt.ts

export const PRICING_PROMPTS = {
  v1: {
    version: '1.0.0',
    createdAt: '2026-07-07',
    systemAddendum: '...',
    userTemplate: '...',
  },
  // When changing prompts: add v2, keep v1 for backward compat
};

// Current version
export const CURRENT_PRICING_PROMPT = PRICING_PROMPTS.v1;
```

---

## Output Validation

Always validate AI output before storing:

```typescript
const PricingRecommendationSchema = z.array(z.object({
  date: z.string().date(),
  recommended_rate: z.number().positive(),
  min_rate: z.number().positive(),
  max_rate: z.number().positive(),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1).max(500),
})).refine(
  items => items.every(i => i.min_rate <= i.recommended_rate && i.recommended_rate <= i.max_rate),
  { message: 'recommended_rate must be between min_rate and max_rate' }
);

const validatedOutput = PricingRecommendationSchema.parse(rawAIOutput);
```

---

## Handling AI Errors

```typescript
async function callClaudeWithRetry<T>(prompt: string, context: object, retries = 2): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await callClaude<T>(prompt, context);
      return result;
    } catch (error) {
      if (attempt === retries) throw error;
      if (error.status === 529) {  // Overloaded
        await sleep(5000 * (attempt + 1));
      } else if (error.status === 400) {  // Bad request
        throw error;  // Don't retry bad requests
      }
    }
  }
  throw new Error('Max retries exceeded');
}
```
