from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def update(path: str, replacements: list[tuple[str, str]]) -> None:
    file = ROOT / path
    text = file.read_text()
    for old, new in replacements:
        if old not in text:
            raise RuntimeError(f'Missing cashflow audit anchor in {path}: {old[:100]!r}')
        text = text.replace(old, new, 1)
    file.write_text(text)


update('src/game/systems/v15.ts', [
    (
        "  DealProfile,\n  EventChain,",
        "  DealProfile,\n  DueDiligence,\n  EventChain,",
    ),
    (
        "}\n\nexport const dealFactLines = (profile: DealProfile) => [",
        "}\n\nexport const dealVerifiedRevenue = (profile: DealProfile) =>\n  Math.round(profile.declaredRevenue * profile.revenueMultiplier)\n\nexport const dealVerifiedCosts = (profile: DealProfile) =>\n  Math.round(profile.declaredCosts * profile.costMultiplier)\n\nexport const dealProjectedOperatingIncome = (\n  profile: DealProfile | undefined,\n  diligence: DueDiligence,\n  fallbackRevenue: number,\n  fallbackCosts: number,\n) => {\n  if (!profile) return fallbackRevenue - fallbackCosts\n  if (diligence === 'full') return dealVerifiedRevenue(profile) - dealVerifiedCosts(profile)\n  return profile.declaredRevenue - profile.declaredCosts\n}\n\nexport const dealFactLines = (profile: DealProfile) => [",
    ),
    (
        "  `Подтверждённая выручка: ${Math.round(profile.declaredRevenue * profile.revenueMultiplier).toLocaleString('ru-RU')} ₽/мес.`,\n  `Подтверждённые расходы: ${Math.round(profile.declaredCosts * profile.costMultiplier).toLocaleString('ru-RU')} ₽/мес.`,",
        "  `Подтверждённая выручка: ${dealVerifiedRevenue(profile).toLocaleString('ru-RU')} ₽/мес.`,\n  `Подтверждённые расходы: ${dealVerifiedCosts(profile).toLocaleString('ru-RU')} ₽/мес.`,",
    ),
    (
        "  asset.revenue = Math.round(asset.revenue * profile.revenueMultiplier)\n  asset.operatingCosts = Math.round(asset.operatingCosts * profile.costMultiplier)",
        "  asset.revenue = dealVerifiedRevenue(profile)\n  asset.operatingCosts = dealVerifiedCosts(profile)",
    ),
])

update('src/V15UI.tsx', [
    (
        "  dealFactLines,\n  specializationDescriptions,",
        "  dealFactLines,\n  dealVerifiedCosts,\n  dealVerifiedRevenue,\n  specializationDescriptions,",
    ),
    (
        "  const estimatedRevenue = Math.round(profile.declaredRevenue * profile.revenueMultiplier)\n  const estimatedCosts = Math.round(profile.declaredCosts * profile.costMultiplier)\n  const inspected = (decision.inspection ?? 'none') !== 'none'",
        "  const estimatedRevenue = dealVerifiedRevenue(profile)\n  const estimatedCosts = dealVerifiedCosts(profile)\n  const inspected = (decision.inspection ?? 'none') !== 'none'\n  const fullyInspected = decision.inspection === 'full'",
    ),
    (
        "      {inspected && <span>Оценка выручки <b>{money(estimatedRevenue)}/мес.</b></span>}\n      {inspected && <span>Оценка расходов <b>{money(estimatedCosts)}/мес.</b></span>}",
        "      {fullyInspected && <span>Подтверждённая выручка <b>{money(estimatedRevenue)}/мес.</b></span>}\n      {fullyInspected && <span>Подтверждённые расходы <b>{money(estimatedCosts)}/мес.</b></span>}",
    ),
])

update('src/V14UI.tsx', [
    (
        "import { buyerArchetypeLabel } from './game/systems/v15'",
        "import { buyerArchetypeLabel, dealProjectedOperatingIncome } from './game/systems/v15'",
    ),
    (
        "  const projectedIncome = business.revenue - business.operatingCosts",
        "  const projectedIncome = dealProjectedOperatingIncome(decision.profile, decision.inspection ?? 'none', business.revenue, business.operatingCosts)",
    ),
])

update('src/App.tsx', [
    (
        "import { DealProfilePanel, EventChainPanel, PortfolioSynergyPanel, RivalIntentPanel, SellerCounterPanel, SpecializationModal } from './V15UI'\n",
        "import { DealProfilePanel, EventChainPanel, PortfolioSynergyPanel, RivalIntentPanel, SellerCounterPanel, SpecializationModal } from './V15UI'\nimport { dealProjectedOperatingIncome } from './game/systems/v15'\n",
    ),
    (
        "    const payment = loanPayment(financedLoan, business.loanRate, business.loanTermMonths)\n    const flow = business.revenue - business.operatingCosts - payment",
        "    const payment = loanPayment(financedLoan, business.loanRate, business.loanTermMonths)\n    const operatingIncome = dealProjectedOperatingIncome(decision.profile, decision.inspection ?? 'none', business.revenue, business.operatingCosts)\n    const flow = operatingIncome - payment\n    const flowLabel = decision.profile ? (decision.inspection === 'full' ? 'Проверенный поток' : 'Заявленный поток') : 'Поток после запуска'",
    ),
    (
        "<Metric label=\"Поток после запуска\" value={money(flow) + '/мес'} good={flow >= 0} bad={flow < 0} />",
        "<Metric label={flowLabel} value={money(flow) + '/мес'} good={flow >= 0} bad={flow < 0} />",
    ),
])

update('src/game/engine/engine.ts', [
    (
        "import { applyDealProfileToAsset, createDealProfile, createSellerCounter, negotiationSpecializationBonus, refreshPortfolioSynergies, refreshRivalIntents, resolveEventChains, revealedDealFacts, scheduleDealChain } from '../systems/v15'",
        "import { applyDealProfileToAsset, createDealProfile, createSellerCounter, dealProjectedOperatingIncome, negotiationSpecializationBonus, refreshPortfolioSynergies, refreshRivalIntents, resolveEventChains, revealedDealFacts, scheduleDealChain } from '../systems/v15'",
    ),
    (
        "    const projectedIncome = Math.round((business.revenue - business.operatingCosts) * ownership)",
        "    const projectedIncome = Math.round(dealProjectedOperatingIncome(profile, diligence, business.revenue, business.operatingCosts) * ownership)",
    ),
])

print('v1.5 cashflow consistency fixes applied')
