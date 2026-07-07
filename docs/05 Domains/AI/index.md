# AI Domain

> Phase: 6 (core), Phase 9 (copilot)
> Status: Not built
> Depends on: Finance domain, Reservation domain, Analytics

---

## Overview

The AI domain provides intelligent insights and recommendations to help property managers make better decisions. AI never modifies data without explicit user approval. All AI outputs are suggestions with confidence scores.

---

## AI Principles

1. **Never write data directly** — AI presents recommendations, users approve
2. **Confidence scores on everything** — always show how confident the AI is
3. **Explain the why** — every recommendation includes reasoning
4. **Graceful degradation** — not enough data → show "insufficient data" rather than garbage insight
5. **Audit trail** — every applied recommendation logged with before/after state

---

## AI Capabilities by Phase

### Phase 6

| Capability | Description |
|-----------|-------------|
| Pricing Recommendations | Suggest optimal nightly rates per property per date, based on occupancy forecast, seasonality, and historical data |
| Occupancy Forecasting | Predict occupancy for next 30/60/90 days based on historical patterns |
| Expense Anomaly Detection | Flag expenses that are unusually high compared to historical averages |
| Cash Flow Insights | "At current pace, you'll have a cash shortfall in 45 days" |

### Phase 9

| Capability | Description |
|-----------|-------------|
| Property Health Score | Composite 0–100 score based on occupancy, reviews, maintenance frequency, revenue trend |
| Natural Language Queries | "What was my best performing property last quarter?" answered in plain text |
| Predictive Maintenance | "Based on age and report history, AC unit at Sea Breeze Villa is likely to fail within 60 days" |
| AI Copilot | Conversational interface for business questions |

---

## Pricing Recommendation Engine

```typescript
// src/domains/ai/agents/pricing.agent.ts

interface PricingSignals {
  historicalOccupancy: MonthlyOccupancy[];  // Last 12 months
  currentRateForDate: number;
  competitorRates?: number[];  // From market data API (future)
  localEvents?: Event[];        // Holidays, festivals, events
  dayOfWeek: 'weekday' | 'weekend';
  daysToDate: number;           // How far in future
  currentOccupancyForecast: number;  // 0-100
}

interface PricingRecommendation {
  date: string;
  currentRate: number;
  recommendedRate: number;
  minRate: number;
  maxRate: number;
  confidence: number;  // 0-1
  reason: string;
  signals: PricingSignals;
}

async function generatePricingRecommendations(
  propertyId: string,
  daysAhead = 90
): Promise<PricingRecommendation[]> {
  // 1. Gather signals
  const property = await propertyRepo.findById(propertyId);
  const historicalData = await financeRepo.getMonthlyRevenue(propertyId, 12);
  const currentRates = await channelService.getCurrentRates(propertyId);
  const occupancyForecast = await forecastingAgent.predict(propertyId, daysAhead);

  // 2. Call Claude API for recommendations
  const recommendations = await callClaudeForPricing({
    property,
    historicalData,
    currentRates,
    occupancyForecast,
    daysAhead,
  });

  // 3. Store recommendations
  await aiRepo.savePricingRecommendations(propertyId, recommendations);

  return recommendations;
}
```

---

## Claude API Integration

```typescript
// src/domains/ai/services/claude.service.ts

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function callClaudeForInsight(prompt: string, context: object): Promise<string> {
  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1024,
    system: `You are an AI assistant for Airaroots, a hospitality management platform.
You analyze property performance data and provide actionable recommendations for property managers.
Always be specific, data-driven, and concise.
Format monetary amounts in INR with the ₹ symbol.
Output must be valid JSON when structured output is requested.`,
    messages: [
      {
        role: 'user',
        content: `Context: ${JSON.stringify(context)}\n\nTask: ${prompt}`,
      },
    ],
  });

  return message.content[0].type === 'text' ? message.content[0].text : '';
}
```

---

## Occupancy Forecast

```typescript
// Simple statistical model for Phase 6
// Replace with ML model in Phase 9

async function forecastOccupancy(propertyId: string, targetDate: Date): Promise<number> {
  // 1. Get same month in previous years
  const historicalMonths = await getHistoricalOccupancy(propertyId, targetDate.getMonth(), 3);

  // 2. Weight recent years more
  const weights = [0.5, 0.35, 0.15];
  const weightedOccupancy = historicalMonths.reduce((sum, occ, i) => sum + occ * (weights[i] ?? 0), 0);

  // 3. Adjust for current bookings pace
  const daysToDate = differenceInDays(targetDate, new Date());
  const currentPace = await getCurrentBookingPace(propertyId, targetDate);
  const paceAdjustment = (currentPace - weightedOccupancy) * (1 - daysToDate / 90);

  return Math.min(100, Math.max(0, weightedOccupancy + paceAdjustment));
}
```

---

## Entities

### AIInsight

| Field | Type | Description |
|-------|------|-------------|
| id | uuid | |
| organization_id | uuid | |
| property_id | uuid? | |
| insight_type | text | pricing, occupancy, expense_anomaly, health_score, cash_flow |
| title | text | Short headline |
| summary | text | Plain language description |
| data | jsonb | Structured data backing the insight |
| confidence | decimal | 0.000 to 1.000 |
| is_dismissed | boolean | User dismissed this |
| is_applied | boolean | User applied this recommendation |
| expires_at | timestamptz? | When insight becomes stale |

### AIPricingRecommendation

| Field | Type | Description |
|-------|------|-------------|
| property_id | uuid | |
| target_date | date | The date this rate applies to |
| current_rate | decimal? | |
| recommended_rate | decimal | |
| confidence | decimal | |
| reason | text | |
| signals | jsonb | Raw signals that drove the recommendation |
| is_applied | boolean | |

---

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/ai/insights | Get active insights for org |
| POST | /api/ai/insights/:id/dismiss | Dismiss insight |
| POST | /api/ai/insights/:id/apply | Apply recommendation |
| GET | /api/ai/pricing/:propertyId | Get pricing recommendations |
| POST | /api/ai/pricing/:propertyId/apply | Apply pricing to channel |
| GET | /api/ai/forecast/:propertyId | Get occupancy forecast |
| POST | /api/ai/query | Natural language query (Phase 9) |
