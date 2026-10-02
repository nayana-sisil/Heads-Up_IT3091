export type Tier = 'Critical' | 'High' | 'Standard'
export interface OrderRow { id: number; date: string; mode: string; region: string; country: string; city: string; segment: string; type: string; category: string; sales: number; p: number; priority: number; score: number; tier: Tier; flag: boolean; late: number; why: string }
export interface Driver { feature: string; label: string; value: string; shap: number }
export interface OrderDetail extends OrderRow { drivers: Driver[]; base_value: number; rank: number; total: number; qty: number; lines: number }
export interface Meta { config: any; modes: string[]; segments: string[]; types: string[]; regions: string[]; date_min: string; date_max: string }
export interface Summary { orders: number; flagged: number; revenue_at_risk: number; sales_total: number; avg_risk: number; tiers: Record<string, { orders: number; at_risk: number; avg_sales: number }>; by_mode: { mode: string; orders: number; risk: number; at_risk: number }[]; by_region: { region: string; orders: number; risk: number; at_risk: number }[]; by_hour: { hour: number; orders: number; risk: number }[]; date_min: string; date_max: string }
export interface Capacity { orders: number; review_n: number; budget: number; alpha: number; revenue_reached: number; precision: number; late_revenue_total: number; late_revenue_reached: number; oracle_reached: number; wasted_reviews: number; curves: Record<string, number[]> }
export interface WhatIfSide { p: number; priority: number; tier: Tier; sales: number; drivers?: { label: string; shap: number }[] }
export interface WhatIfResult { before: WhatIfSide; after: WhatIfSide }
export interface CheckInput { mode: string; when: string; pay_type: string; segment: string; country: string; category: string; qty: number; sales: number; profit?: number | null; lines?: number | null; distinct?: number | null; region?: string | null }
export interface CheckResult { p: number; sales: number; priority: number; score: number; tier: Tier; flag: boolean; assumed: string[]; notes: string[]; region: string; drivers: { label: string; shap: number }[]; base_value: number; threshold: number }
export interface LookupInfo { countries: string[]; categories: string[]; typical: { Sales: number; 'Order Item Quantity': number }; sales_range: [number, number]; region_of: Record<string, string>; threshold: number }
