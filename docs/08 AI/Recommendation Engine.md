# Recommendation Engine

---

## Overview

The Recommendation Engine surfaces AI insights in the dashboard. It aggregates outputs from all AI agents and presents them in a prioritized, actionable list.

---

## Insight Priority Ranking

```typescript
function calculateInsightPriority(insight: AIInsight): number {
  let score = 0;

  // Revenue impact
  if (insight.data.potential_revenue_gain > 50000) score += 30;
  else if (insight.data.potential_revenue_gain > 20000) score += 20;
  else if (insight.data.potential_revenue_gain > 5000) score += 10;

  // Urgency (how soon the insight becomes irrelevant)
  const daysUntilExpiry = differenceInDays(new Date(insight.expires_at!), new Date());
  if (daysUntilExpiry < 3) score += 25;
  else if (daysUntilExpiry < 7) score += 15;
  else if (daysUntilExpiry < 14) score += 5;

  // Confidence
  score += Math.round(insight.confidence * 20);

  // Type priority
  const typePriority = {
    expense_anomaly: 25,    // Most urgent — money leaving
    pricing: 20,            // Revenue opportunity
    occupancy: 15,
    cash_flow: 20,
    health_score: 5,
  };
  score += typePriority[insight.insight_type] ?? 0;

  return score;
}
```

---

## Dashboard Insight Panel

Shows top 5 insights sorted by priority:

```tsx
// components/ai/InsightPanel.tsx

function InsightCard({ insight }: { insight: AIInsight }) {
  const [applying, setApplying] = useState(false);

  return (
    <div className="border rounded-lg p-4 bg-white">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <InsightTypeIcon type={insight.insight_type} />
          <div>
            <h3 className="text-sm font-semibold">{insight.title}</h3>
            <p className="text-sm text-gray-600 mt-1">{insight.summary}</p>
          </div>
        </div>
        <ConfidenceBadge confidence={insight.confidence} />
      </div>

      <div className="flex gap-2 mt-3">
        {insight.data.can_apply && (
          <button
            onClick={() => applyInsight(insight.id)}
            disabled={applying}
            className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            {applying ? 'Applying...' : 'Apply'}
          </button>
        )}
        <button
          onClick={() => dismissInsight(insight.id)}
          className="text-xs px-3 py-1.5 border rounded-md text-gray-600"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
```

---

## Insight Types and Apply Actions

| Insight Type | Apply Action | What Happens |
|-------------|-------------|--------------|
| `pricing` | Apply selected rates | Push rate changes to connected channels |
| `occupancy` | N/A (informational) | No apply — just shows forecast |
| `expense_anomaly` | Mark as reviewed | Logs review, stops showing in feed |
| `cash_flow` | N/A | Shows projection, links to detailed view |
| `health_score` | View recommendations | Opens health score breakdown |

---

## Health Score Calculation (Phase 9)

Composite score 0–100 for each property:

```typescript
function calculateHealthScore(data: PropertyHealthData): number {
  const weights = {
    occupancy:    0.30,  // 30% — are people booking?
    revenue_trend: 0.25,  // 25% — is revenue growing?
    maintenance:   0.20,  // 20% — is property well-maintained?
    guest_reviews: 0.15,  // 15% — are guests happy?
    pricing_competitiveness: 0.10,  // 10% — are rates optimal?
  };

  const scores = {
    occupancy: Math.min(100, data.occupancyRate * 1.1),  // 90%+ occupancy = 100 score
    revenue_trend: mapTrend(data.revenueGrowthMoM),
    maintenance: data.openMaintenanceCount === 0 ? 100 : Math.max(0, 100 - data.openMaintenanceCount * 15),
    guest_reviews: data.averageRating ? (data.averageRating / 5) * 100 : 75,  // Default 75 if no reviews
    pricing_competitiveness: data.priceGapToMarket !== undefined ? Math.max(0, 100 - Math.abs(data.priceGapToMarket)) : 75,
  };

  return Math.round(
    Object.entries(weights).reduce((total, [key, weight]) => {
      return total + (scores[key as keyof typeof scores] ?? 0) * weight;
    }, 0)
  );
}
```
