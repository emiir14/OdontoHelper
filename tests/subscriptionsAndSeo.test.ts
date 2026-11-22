import { describe, expect, it } from 'vitest';
import {
  DAY_MS,
  FREE_TRIAL_DAYS,
  buildTransferWhatsappUrl,
  buildWorkspaceTransferCode,
  calculatePlanPricing,
  evaluateSubscriptionStatus,
} from '../src/core/clinic/subscriptionPlans';
import { isPublicMarketingPath, parseAppLocation } from '../src/core/routing/appRoutes';
import { getPublicSeoSpec, URUGUAY_LANDING_FAQS } from '../src/core/seo/seoManager';
import { WorkspaceSubscription } from '../src/core/types';

describe('Subscriptions, 7-Day Trial & All-Tier Expiration Alerts', () => {
  it('calculates $40 USD base pricing with quarterly (-15%) and annual (-25%) discounts', () => {
    const monthly = calculatePlanPricing('base', 'monthly');
    expect(monthly.totalUsd).toBe(40);
    expect(monthly.effectiveMonthlyUsd).toBe(40);
    expect(monthly.savingsUsd).toBe(0);

    const quarterly = calculatePlanPricing('base', 'quarterly');
    expect(quarterly.months).toBe(3);
    expect(quarterly.discountPct).toBe(15);
    expect(quarterly.totalUsd).toBe(102);
    expect(quarterly.effectiveMonthlyUsd).toBe(34);
    expect(quarterly.savingsUsd).toBe(18);

    const annual = calculatePlanPricing('base', 'annual');
    expect(annual.months).toBe(12);
    expect(annual.discountPct).toBe(25);
    expect(annual.totalUsd).toBe(360);
    expect(annual.effectiveMonthlyUsd).toBe(30);
    expect(annual.savingsUsd).toBe(120);

    const extraMonthly = calculatePlanPricing('extra', 'monthly');
    const megaMonthly = calculatePlanPricing('mega', 'monthly');
    expect(extraMonthly.totalUsd).toBe(59);
    expect(megaMonthly.totalUsd).toBe(89);
  });

  it('evaluates expiration warnings across ALL tiers (trial, base, extra, mega)', () => {
    const now = 1_750_000_000_000;

    // 7-day trial fresh -> ok
    const freshTrial: WorkspaceSubscription = {
      workspaceId: 'ws_1',
      planTier: 'trial',
      billingCycle: 'monthly',
      status: 'trialing',
      trialStartsAt: now,
      trialEndsAt: now + FREE_TRIAL_DAYS * DAY_MS,
      lastPaymentMethod: 'bank_transfer',
      createdAt: now,
      updatedAt: now,
    };
    const evalFreshTrial = evaluateSubscriptionStatus(freshTrial, now);
    expect(evalFreshTrial.daysRemaining).toBe(7);
    expect(evalFreshTrial.alertLevel).toBe('ok');

    // Paid plans within <= 5 days trigger warning, <= 1 day trigger critical, <= 0 trigger expired
    for (const tier of ['base', 'extra', 'mega'] as const) {
      const subWarning: WorkspaceSubscription = {
        ...freshTrial,
        planTier: tier,
        status: 'active',
        currentPeriodStart: now - 26 * DAY_MS,
        currentPeriodEnd: now + 4 * DAY_MS,
      };
      expect(evaluateSubscriptionStatus(subWarning, now).alertLevel).toBe('warning');

      const subCritical: WorkspaceSubscription = {
        ...subWarning,
        currentPeriodEnd: now + 12 * 60 * 60 * 1000,
      };
      expect(evaluateSubscriptionStatus(subCritical, now).alertLevel).toBe('critical');

      const subExpired: WorkspaceSubscription = {
        ...subWarning,
        currentPeriodEnd: now - 1000,
      };
      const evalExp = evaluateSubscriptionStatus(subExpired, now);
      expect(evalExp.alertLevel).toBe('expired');
      expect(evalExp.isExpired).toBe(true);
    }
  });

  it('generates workspace transfer code and WhatsApp confirmation message', () => {
    const code = buildWorkspaceTransferCode('ws_abc123xyz');
    expect(code.startsWith('OH-')).toBe(true);

    const url = buildTransferWhatsappUrl({
      workspaceId: 'ws_abc123xyz',
      planTier: 'base',
      billingCycle: 'annual',
      amountUsd: 360,
      payerName: 'Dra. Lucía Rodríguez',
      bankName: 'BROU',
      transferReference: 'TRF-9012',
      email: 'lucia@clinica.uy',
    });
    expect(url).toContain('https://wa.me/');
    expect(decodeURIComponent(url)).toContain('USD 360');
    expect(decodeURIComponent(url)).toContain('TRF-9012');
    expect(decodeURIComponent(url)).toContain(code);
  });
});

describe('Public Marketing Routes & Uruguay SEO Metadata', () => {
  it('recognizes all indexable public marketing routes and parses signup query params', () => {
    expect(isPublicMarketingPath('/')).toBe(true);
    expect(isPublicMarketingPath('/funciones')).toBe(true);
    expect(isPublicMarketingPath('/dictado-por-voz')).toBe(true);
    expect(isPublicMarketingPath('/planes')).toBe(true);
    expect(isPublicMarketingPath('/preguntas-frecuentes')).toBe(true);
    expect(isPublicMarketingPath('/dictar')).toBe(false);
    expect(isPublicMarketingPath('/pacientes/pat_1')).toBe(false);

    expect(parseAppLocation('/').publicRoute).toBe('landing');
    expect(parseAppLocation('/planes').publicRoute).toBe('planes');
    expect(parseAppLocation('/dictado-por-voz').publicRoute).toBe('dictado-por-voz');

    const signup = parseAppLocation('/registro', '?plan=extra&ciclo=anual');
    expect(signup.isLoginRoute).toBe(true);
    expect(signup.isSignupRoute).toBe(true);
    expect(signup.requestedPlan).toBe('extra');
    expect(signup.requestedCycle).toBe('annual');
  });

  it('provides localized Uruguay SEO specifications and FAQs', () => {
    const landingSeo = getPublicSeoSpec('landing');
    expect(landingSeo.title).toContain('Uruguay');
    expect(landingSeo.robots).toContain('index');

    const pricingSeo = getPublicSeoSpec('planes');
    expect(pricingSeo.title).toContain('$40 USD');
    expect(pricingSeo.canonicalPath).toBe('/planes');

    expect(URUGUAY_LANDING_FAQS.length).toBeGreaterThanOrEqual(5);
  });
});
