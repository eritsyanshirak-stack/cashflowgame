import { describe, expect, it } from 'vitest'
import { businesses } from '../content/content'
import type { Asset, DealProfile } from '../domain/types'
import {
  applyDealProfileToAsset,
  dealProjectedOperatingIncome,
  dealVerifiedCosts,
  dealVerifiedRevenue,
} from '../systems/v15'

const profile: DealProfile = {
  id: 'profile-audit',
  location: 'У метро',
  leaseMonths: 18,
  equipmentCondition: 'fair',
  equipmentLabel: 'Рабочее, но не новое',
  ownerDependency: 'medium',
  ownerDependencyLabel: 'Часть клиентов держится на владельце',
  customerRating: 4.4,
  sellerReason: 'Переезд',
  revenueMultiplier: 0.82,
  costMultiplier: 1.16,
  valueMultiplier: 0.91,
  declaredRevenue: 70_000,
  declaredCosts: 42_000,
}

const asset = (): Asset => ({
  ...businesses[1],
  id: 'asset-audit',
  ownerId: 'human',
  ownership: 1,
  monthlyPayment: 0,
  purchaseMonth: 1,
  developmentLevel: 0,
  developments: [],
  totalDevelopmentCost: 0,
  lastDevelopedMonth: null,
  saleOffer: null,
  offerExpiresMonth: null,
  status: 'active',
})

describe('Balance v1.5 unique deal cashflow audit', () => {
  it('uses seller declarations before full inspection and verified numbers after it', () => {
    expect(dealProjectedOperatingIncome(profile, 'none', 1, 1)).toBe(28_000)
    expect(dealProjectedOperatingIncome(profile, 'basic', 1, 1)).toBe(28_000)
    expect(dealProjectedOperatingIncome(profile, 'full', 1, 1)).toBe(
      dealVerifiedRevenue(profile) - dealVerifiedCosts(profile),
    )
  })

  it('applies the same verified revenue and costs that the full inspection shows', () => {
    const acquired = applyDealProfileToAsset(asset(), profile)
    expect(acquired.revenue).toBe(dealVerifiedRevenue(profile))
    expect(acquired.operatingCosts).toBe(dealVerifiedCosts(profile))
  })
})
