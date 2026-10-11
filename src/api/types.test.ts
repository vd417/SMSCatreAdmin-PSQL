import { describe, it, expect } from 'vitest';
import { CONTRACT_KEYS, type Plan, type Invoice, type Subscription, type OnboardingCard, type TicketMessage } from './types';

// Verifies CONTRACT_KEYS matches the canonical snake_case shape the backend exposes.
// This test fails if the two drift, catching contract regressions.
const EXPECTED: Record<string, string[]> = {
  TENANT_KEYS: ['id','name','slug','country','status','plan_id','plan_name','tier','mrr',
    'students_count','staff_count','storage_gb','limits','created','last_active_days',
    'trial_ends_days','contact','csm','health_score','gateway','usage_series',
    'contact_name','contact_email','contact_phone','address','id_proof_type','id_proof_url'],
  PLAN_KEYS: ['id','name','tier','pricing','price','per_student','min_students','period',
    'features','limits','visibility','audience','band','offer','color','description'],
  TEAM_MEMBER_KEYS: ['id','name','email','phone','role','status','last_login','joined','employee_id','photo_url','documents'],
  INVOICE_KEYS: ['id','tenant_id','tenant_name','plan_name','amount','status','issued','due','paid_on'],
  SUBSCRIPTION_KEYS: ['id','tenant_id','tenant_name','plan_id','plan_name','tier','status',
    'current_period_start','current_period_end','next_charge'],
  SUPPORT_TICKET_KEYS: ['id','subject','tenant_id','tenant_name','status','priority','assignee','created','updated','messages_count'],
  TICKET_MESSAGE_KEYS: ['id','author','role','body','created'],
  ROLE_KEYS: ['key','name','description','color'],
  PERMISSION_KEYS: ['key','label','group','roles'],
  DASHBOARD_OVERVIEW_KEYS: ['counts','mrr','trials_ending','churn_pct','months','mrr_series',
    'signup_series','plan_mix','usage_alerts','system_health','recent_activity'],
  REVENUE_REPORT_KEYS: ['arr','net_growth','gross_churn_pct','arpa','months','revenue_series',
    'revenue_by_plan','plan_performance'],
  AUDIT_LOG_KEYS: ['id','actor_id','actor_name','role','action','target','kind','time'],
  CLIENT_USAGE_KEYS: ['students_count','staff_count','storage_gb','limits','usage_series','usage_pct'],
  ONBOARDING_KEYS: ['id','name','value','owner','age','stage','checklist',
    'contact_name','contact_email','contact_phone','address'],
};

describe('contract keys', () => {
  it('CONTRACT_KEYS matches the canonical snake_case shape', () => {
    expect(CONTRACT_KEYS).toEqual(EXPECTED);
  });
});

describe('Plan interface', () => {
  it('covers exactly the PLAN_KEYS contract', () => {
    // A missing/extra key here fails to compile; the runtime check guards against PLAN_KEYS drift.
    const planKeys: Record<keyof Plan, true> = {
      id: true, name: true, tier: true, pricing: true, price: true, per_student: true,
      min_students: true, period: true, features: true, limits: true, visibility: true,
      audience: true, band: true, offer: true, color: true, description: true,
    };
    expect(Object.keys(planKeys).sort()).toEqual([...CONTRACT_KEYS.PLAN_KEYS].sort());
  });
});

describe('billing DTOs', () => {
  it('Invoice covers INVOICE_KEYS', () => {
    const k: Record<keyof Invoice, true> = {
      id:true, tenant_id:true, tenant_name:true, plan_name:true, amount:true,
      status:true, issued:true, due:true, paid_on:true };
    expect(Object.keys(k).sort()).toEqual([...CONTRACT_KEYS.INVOICE_KEYS].sort());
  });
  it('Subscription covers SUBSCRIPTION_KEYS', () => {
    const k: Record<keyof Subscription, true> = {
      id:true, tenant_id:true, tenant_name:true, plan_id:true, plan_name:true, tier:true,
      status:true, current_period_start:true, current_period_end:true, next_charge:true };
    expect(Object.keys(k).sort()).toEqual([...CONTRACT_KEYS.SUBSCRIPTION_KEYS].sort());
  });
});

describe('OnboardingCard', () => {
  it('covers ONBOARDING_KEYS', () => {
    const k: Record<keyof OnboardingCard, true> = { id:true, name:true, value:true, owner:true, age:true, stage:true, checklist:true,
      contact_name:true, contact_email:true, contact_phone:true, address:true };
    expect(Object.keys(k).sort()).toEqual([...CONTRACT_KEYS.ONBOARDING_KEYS].sort());
  });
});

describe('TicketMessage', () => {
  it('covers TICKET_MESSAGE_KEYS', () => {
    const k: Record<keyof TicketMessage, true> = { id:true, author:true, role:true, body:true, created:true };
    expect(Object.keys(k).sort()).toEqual([...CONTRACT_KEYS.TICKET_MESSAGE_KEYS].sort());
  });
});
