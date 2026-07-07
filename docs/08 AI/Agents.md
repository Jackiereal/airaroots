# AI Agents

---

## Agent 1: Pricing Agent

**Purpose:** Recommend optimal nightly rates per property per date
**Phase:** 6
**Run frequency:** Weekly (Sunday midnight) per property

### Input

```typescript
type PricingAgentInput = {
  property: {
    id: string;
    name: string;
    type: string;
    bedrooms: number;
    maxGuests: number;
    baseRate: number;
  };
  historicalPerformance: {
    month: string;
    occupancyRate: number;
    adr: number;
    grossRevenue: number;
    reservationCount: number;
  }[];
  currentRates: {
    date: string;
    rate: number;
    isBooked: boolean;
  }[];
  upcomingBookings: {
    checkIn: string;
    checkOut: string;
    channel: string;
  }[];
  targetDates: string[];  // Next 90 days, unbooked only
};
```

### Prompt

```
Analyze the property performance data and recommend optimal nightly rates for the target dates.

Consider:
1. Historical occupancy patterns for the same period in previous years
2. Current booking pace vs historical pace
3. How full the calendar is for adjacent dates
4. Day of week (weekends typically command 20-40% premium)
5. Indian holidays and festivals (adjust for upcoming ones)
6. Minimum floor: never recommend below 70% of base rate
7. Maximum ceiling: never recommend above 300% of base rate

For each target date, provide:
- recommended_rate: number
- min_rate: number (floor - 80% of base)
- max_rate: number (ceiling - 250% of base)
- confidence: 0.0-1.0
- reason: string (1-2 sentences explaining the recommendation)

Return as JSON array of PricingRecommendation objects.
```

### Output

```typescript
type PricingRecommendation = {
  date: string;           // YYYY-MM-DD
  recommended_rate: number;
  min_rate: number;
  max_rate: number;
  confidence: number;
  reason: string;
};
```

---

## Agent 2: Occupancy Forecasting Agent

**Purpose:** Predict occupancy rate for next 30/60/90 days
**Phase:** 6
**Run frequency:** Weekly per property

### Prompt

```
Based on the historical occupancy data and current booking pace, forecast the occupancy rate
for each of the next 90 days.

Historical patterns to consider:
1. Same period in previous 2-3 years
2. Day-of-week patterns (weekends vs weekdays)
3. Indian holiday calendar
4. Current bookings already confirmed
5. Days with existing blocks (mark as 100% occupied)
6. Booking lead time patterns (most bookings come 7-30 days in advance)

Return a JSON object with:
- forecast_by_month: { month, forecasted_occupancy, confidence }[]
- forecast_by_date: { date, is_booked, forecast_probability, confidence }[]  (for unbooked dates)
- summary: string (2-3 sentence overall forecast)
- key_insights: string[] (top 3 observations)
```

---

## Agent 3: Expense Anomaly Detector

**Purpose:** Flag expenses that are unusually high
**Phase:** 6
**Run frequency:** Daily

### Logic

```typescript
// Statistical approach before calling Claude (save API costs):

async function detectAnomalies(propertyId: string): Promise<PotentialAnomaly[]> {
  const last6Months = await expenseRepo.getByCategory(propertyId, 6);

  const anomalies: PotentialAnomaly[] = [];

  for (const [category, history] of Object.entries(last6Months)) {
    const amounts = history.map(e => e.amount);
    const mean = sum(amounts) / amounts.length;
    const stdDev = standardDeviation(amounts);

    const latestExpense = history[history.length - 1];
    if (!latestExpense) continue;

    const zScore = (latestExpense.amount - mean) / stdDev;

    if (zScore > 2.0) {  // More than 2 standard deviations above mean
      anomalies.push({
        category,
        currentAmount: latestExpense.amount,
        historicalMean: mean,
        deviation: ((latestExpense.amount - mean) / mean * 100).toFixed(0) + '%',
        zScore,
      });
    }
  }

  // Only call Claude if anomalies found
  if (anomalies.length > 0) {
    return callClaude('Analyze these expense anomalies and provide context', anomalies);
  }

  return [];
}
```

---

## Agent 4: Natural Language Query Agent (Phase 9)

**Purpose:** Answer business questions in plain English
**Phase:** 9

### Examples

```
User: "What was my best performing property last quarter?"
System: "Sea Breeze Villa was your top performer in Q3 2026 with ₹8.4L in net revenue and 84% occupancy. This was 23% above your portfolio average."

User: "Which months should I raise prices at Sunset Cottage?"
System: "Based on 2 years of data, Sunset Cottage sees peak demand in October, November, and March-April. Consider raising rates 30-40% in these months. Your current rates for October are 15% below last year's rates despite higher demand signals."

User: "Am I making money after expenses?"
System: "Yes — your portfolio net profit for October was ₹4.2L. Sea Breeze Villa contributed ₹2.1L (50%), Palm Grove ₹1.4L (33%), and Sunset Cottage ₹0.7L (17%). This is 12% higher than October last year."
```

### Implementation

```typescript
// Phase 9: Build a context window from all relevant data
// Use tool use to let Claude query specific tables

const tools = [
  {
    name: 'get_revenue_summary',
    description: 'Get revenue summary for a property and time period',
    input_schema: {
      type: 'object',
      properties: {
        property_id: { type: 'string' },
        from_date: { type: 'string' },
        to_date: { type: 'string' },
      },
    },
  },
  // ... more tools
];

// Agentic loop: Claude calls tools, we execute them, return results
```

---

## Agent Orchestration

```typescript
// src/domains/ai/services/agent-orchestrator.ts

export class AIAgentOrchestrator {
  async runWeeklyAnalysis(orgId: string): Promise<void> {
    const properties = await propertyRepo.findByOrganization(orgId);

    await Promise.allSettled(
      properties.map(async (property) => {
        try {
          await this.runPricingAgent(property.id);
          await this.runForecastingAgent(property.id);
        } catch (error) {
          logger.error('AI agent failed', { propertyId: property.id, error });
        }
      })
    );
  }

  async runDailyAnomalyDetection(orgId: string): Promise<void> {
    const properties = await propertyRepo.findByOrganization(orgId);

    for (const property of properties) {
      await this.anomalyDetector.run(property.id);
    }
  }
}
```
