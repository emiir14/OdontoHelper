import {
  SubscriptionBillingCycle,
  SubscriptionTransferRequest,
  WorkspaceSubscription,
} from '../types';
import { DAY_MS, FREE_TRIAL_DAYS } from './subscriptionPlans';

const SUB_STORAGE_PREFIX = 'odontohelper_local_subscription_';
const TRANSFER_STORAGE_PREFIX = 'odontohelper_local_transfers_';

export function getOrCreateLocalSubscription(
  workspaceId: string,
  preferredCycle: SubscriptionBillingCycle = 'monthly'
): WorkspaceSubscription {
  const key = `${SUB_STORAGE_PREFIX}${workspaceId}`;
  const now = Date.now();
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as WorkspaceSubscription;
        if (parsed && parsed.workspaceId === workspaceId && typeof parsed.trialEndsAt === 'number') {
          return parsed;
        }
      }
      const created: WorkspaceSubscription = {
        workspaceId,
        planTier: 'trial',
        billingCycle: preferredCycle,
        status: 'trialing',
        trialStartsAt: now,
        trialEndsAt: now + FREE_TRIAL_DAYS * DAY_MS,
        lastPaymentMethod: 'bank_transfer',
        createdAt: now,
        updatedAt: now,
      };
      window.localStorage.setItem(key, JSON.stringify(created));
      return created;
    }
  } catch {
    // ignore storage errors
  }

  return {
    workspaceId,
    planTier: 'trial',
    billingCycle: preferredCycle,
    status: 'trialing',
    trialStartsAt: now,
    trialEndsAt: now + FREE_TRIAL_DAYS * DAY_MS,
    lastPaymentMethod: 'bank_transfer',
    createdAt: now,
    updatedAt: now,
  };
}

export function listLocalTransferRequests(workspaceId: string): SubscriptionTransferRequest[] {
  const key = `${TRANSFER_STORAGE_PREFIX}${workspaceId}`;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch {
    // ignore
  }
  return [];
}

export function saveLocalTransferRequest(request: SubscriptionTransferRequest): SubscriptionTransferRequest[] {
  const existing = listLocalTransferRequests(request.workspaceId);
  const next = [request, ...existing];
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(`${TRANSFER_STORAGE_PREFIX}${request.workspaceId}`, JSON.stringify(next));
      const subKey = `${SUB_STORAGE_PREFIX}${request.workspaceId}`;
      const sub = getOrCreateLocalSubscription(request.workspaceId, request.billingCycle);
      window.localStorage.setItem(
        subKey,
        JSON.stringify({
          ...sub,
          pendingTransferId: request.id,
          updatedAt: Date.now(),
        })
      );
    }
  } catch {
    // ignore
  }
  return next;
}
