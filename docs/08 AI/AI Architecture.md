# AI Architecture

---

## Philosophy

AI in Airaroots is a **read-amplifier** — it reads data across all domains and surfaces insights that would take a human analyst hours to compute. It never writes data autonomously.

```
ALL DOMAINS → Data Pipeline → AI Analysis → Insight Records → User Reviews → User Applies
                                                                          ↑
                                                              (AI never writes directly)
```

---

## AI Stack

| Component | Technology |
|-----------|-----------|
| LLM | Claude API (`claude-opus-4-6`) |
| SDK | `@anthropic-ai/sdk` |
| Vector DB | Supabase pgvector (Phase 9, for NL queries) |
| Embeddings | Claude embedding API (Phase 9) |
| Caching | Redis or Supabase table (ai_insight_cache) |

---

## AI System Architecture

```
┌─────────────────────────────────────────────────────┐
│                   AI Service Layer                   │
│                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │   Pricing    │  │  Forecasting │  │  Anomaly  │ │
│  │    Agent     │  │    Agent     │  │  Detector │ │
│  └──────┬───────┘  └──────┬───────┘  └─────┬─────┘ │
│         │                 │                 │       │
│         └─────────────────┴─────────────────┘       │
│                           │                         │
│                ┌──────────▼────────────┐            │
│                │   Claude API Client   │            │
│                │ (claude-opus-4-6)     │            │
│                └──────────────────────┘            │
└─────────────────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────┐
│                  Data Pipeline Layer                  │
│                                                     │
│  reads from: reservations, finance, calendar,       │
│              housekeeping, maintenance               │
└──────────────────────────────────────────────────────┘
```

---

## AI Data Pipeline

Before calling Claude, collect context:

```typescript
// src/domains/ai/pipeline/property-context.ts

export async function buildPropertyContext(
  propertyId: string,
  lookahead = 90
): Promise<PropertyContext> {
  const [
    property,
    last12MonthsRevenue,
    occupancyHistory,
    upcomingReservations,
    recentExpenses,
    maintenanceHistory,
  ] = await Promise.all([
    propertyRepo.findById(propertyId),
    financeRepo.getMonthlyRevenue(propertyId, 12),
    reservationRepo.getOccupancyByMonth(propertyId, 12),
    reservationRepo.getUpcoming(propertyId, lookahead),
    expenseRepo.getRecent(propertyId, 90),
    maintenanceRepo.getRecent(propertyId, 90),
  ]);

  return {
    property,
    last12MonthsRevenue,
    occupancyHistory,
    upcomingReservations,
    recentExpenses,
    maintenanceHistory,
    generatedAt: new Date().toISOString(),
  };
}
```

---

## Claude API Client

```typescript
// src/domains/ai/services/claude.service.ts

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are an AI assistant for Airaroots, a hospitality management SaaS platform.
Your role is to analyze property performance data and provide actionable business insights for property managers.

Context:
- Properties are short-term rental villas, apartments, and houses in India
- Revenue is in INR (₹)
- Dates are in YYYY-MM-DD format
- Users are property managers and business owners, not technical users
- Be specific, data-driven, and actionable
- Always include a confidence score (0.0 to 1.0) with recommendations
- Format monetary amounts as ₹X,XX,XXX (Indian numbering system)
- Return structured JSON when asked

You never directly modify data. You present recommendations for users to review and apply.`;

export async function callClaude<T>(
  prompt: string,
  context: object,
  opts?: { maxTokens?: number; outputSchema?: string }
): Promise<T> {
  const message = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: opts?.maxTokens ?? 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Property Context:\n${JSON.stringify(context, null, 2)}\n\nTask: ${prompt}${opts?.outputSchema ? `\n\nReturn JSON matching this schema: ${opts.outputSchema}` : ''}`,
          },
        ],
      },
    ],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';

  if (opts?.outputSchema) {
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`AI returned invalid JSON: ${text.substring(0, 100)}`);
    }
  }

  return text as unknown as T;
}
```

---

## Rate Limiting & Cost Control

Claude API costs money. Guard against runaway costs:

```typescript
// src/domains/ai/services/rate-limiter.ts

const AI_LIMITS = {
  pricing_analysis: { callsPerDay: 1, perProperty: true },
  occupancy_forecast: { callsPerDay: 1, perProperty: true },
  anomaly_detection: { callsPerDay: 4, perOrg: true },
  natural_language: { callsPerHour: 20, perUser: true },
};

async function checkRateLimit(type: keyof typeof AI_LIMITS, entityId: string): Promise<void> {
  const limit = AI_LIMITS[type];
  const usage = await aiUsageRepo.countRecent(type, entityId, limit.callsPerDay ? 'day' : 'hour');

  const maxCalls = limit.callsPerDay ?? limit.callsPerHour ?? 10;
  if (usage >= maxCalls) {
    throw new BusinessRuleError(
      `AI ${type} limit reached. Available again ${limit.callsPerDay ? 'tomorrow' : 'in 1 hour'}.`
    );
  }
}
```

**Estimated API costs at scale:**
- Pricing analysis: ~2,000 tokens × $15/1M = $0.03/property/week
- For 10,000 properties: ~$300/week → $1,200/month
- Include in Pro/Enterprise plan pricing

---

## Caching AI Outputs

AI insights expire — cache them to avoid redundant API calls:

```typescript
// Before calling Claude, check cache
const cached = await aiInsightRepo.findRecent(propertyId, 'pricing', maxAge: 7 * 24 * 60 * 60 * 1000);
if (cached && !cached.is_dismissed) return cached;

// Generate new insight
const newInsight = await generatePricingInsight(propertyId);
await aiInsightRepo.save(newInsight);
return newInsight;
```

Insight TTLs:
- Pricing recommendations: 7 days
- Occupancy forecasts: 7 days
- Expense anomalies: 30 days
- Natural language queries: no cache (real-time)
