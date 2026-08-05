import type { Decision, Specialization } from './game/domain/types'
import { assetCashflow } from './game/systems/economy'
import { playerLevel } from './game/systems/progression'
import {
  dealFactLines,
  specializationDescriptions,
  specializationNames,
} from './game/systems/v15'
import { useGameStore } from './store/gameStore'

const money = (value: number) => `${Math.round(value).toLocaleString('ru-RU')} ₽`

export function DealProfilePanel({ decision }: { decision: Extract<Decision, { kind: 'business' | 'opportunity' }> }) {
  const profile = decision.profile
  if (!profile) return null
  const known = new Set(decision.revealedFacts ?? [])
  const facts = dealFactLines(profile)
  const estimatedRevenue = Math.round(profile.declaredRevenue * profile.revenueMultiplier)
  const estimatedCosts = Math.round(profile.declaredCosts * profile.costMultiplier)
  const inspected = (decision.inspection ?? 'none') !== 'none'

  return <section className="v15-deal-profile">
    <div className="v15-section-head">
      <span><small>КОНКРЕТНЫЙ ОБЪЕКТ</small><b>Не шаблонный бизнес</b></span>
      <strong>{inspected ? 'Данные проверки' : 'Данные продавца'}</strong>
    </div>
    <div className="v15-declared-grid">
      <span>Заявленная выручка <b>{money(profile.declaredRevenue)}/мес.</b></span>
      <span>Заявленные расходы <b>{money(profile.declaredCosts)}/мес.</b></span>
      {inspected && <span>Оценка выручки <b>{money(estimatedRevenue)}/мес.</b></span>}
      {inspected && <span>Оценка расходов <b>{money(estimatedCosts)}/мес.</b></span>}
    </div>
    <div className="v15-fact-list">{facts.map((fact, index) => {
      const visible = known.has(fact)
      return <div className={visible ? 'revealed' : 'hidden'} key={fact}>
        <i>{visible ? '✓' : '?'}</i>
        <span>{visible ? fact : index < 2 ? 'Факт откроется после базовой проверки' : 'Требуется полная проверка'}</span>
      </div>
    })}</div>
  </section>
}

export function SellerCounterPanel({ decision }: { decision: Extract<Decision, { kind: 'business' | 'opportunity' }> }) {
  const dispatch = useGameStore((store) => store.dispatch)
  const counter = decision.sellerCounter
  if (!counter) return null

  return <section className="v15-seller-counter">
    <span className="eyebrow">КОНТРОФФЕР ПРОДАВЦА</span>
    <h3>Продавец не принял твою цену, но готов продолжить</h3>
    <div className="v15-counter-price"><span>Новая цена</span><strong>{money(counter.price)}</strong></div>
    <div className="v15-counter-term"><small>АЛЬТЕРНАТИВА СКИДКЕ</small><b>{counter.note}</b></div>
    <div className="v15-counter-actions">
      <button onClick={() => dispatch({ type: 'RESPOND_SELLER_COUNTER', action: 'acceptPrice' })}><b>Принять цену</b><small>{money(counter.price)}</small></button>
      <button onClick={() => dispatch({ type: 'RESPOND_SELLER_COUNTER', action: 'acceptTerm' })}><b>Оставить цену</b><small>Взять условие продавца</small></button>
      <button onClick={() => dispatch({ type: 'RESPOND_SELLER_COUNTER', action: 'keepOriginal' })}><b>Отказаться</b><small>Вернуться к исходной цене</small></button>
    </div>
  </section>
}

export function SpecializationModal() {
  const game = useGameStore((store) => store.game)
  const dispatch = useGameStore((store) => store.dispatch)
  const player = game.players[0]
  if (!player || player.isBot || player.specialization || playerLevel(player) < 3 || game.phase !== 'ready') return null
  const specializations: Specialization[] = ['operator', 'negotiator', 'investor', 'entrepreneur']

  return <div className="sheet-backdrop v15-specialization-backdrop"><section className="decision-sheet v15-specialization-sheet">
    <div className="sheet-handle" />
    <span className="eyebrow">УРОВЕНЬ 3 · НОВЫЙ ЭТАП</span>
    <h2>Выбери стиль этой партии</h2>
    <p>Это решение нельзя изменить. Оно не даёт бесплатную победу — только усиливает один путь и заставляет отказаться от другого.</p>
    <div className="v15-specialization-grid">{specializations.map((specialization) => <button key={specialization} onClick={() => dispatch({ type: 'CHOOSE_SPECIALIZATION', specialization })}>
      <b>{specializationNames[specialization]}</b>
      <small>{specializationDescriptions[specialization]}</small>
      {specialization === 'entrepreneur' && <em>Зарплата станет 0 ₽</em>}
    </button>)}</div>
  </section></div>
}

export function PortfolioSynergyPanel() {
  const player = useGameStore((store) => store.game.players[0])
  if (!player || player.assets.length < 2) return null
  const active = player.assets.filter((asset) => (asset.synergyBonus ?? 0) > 0)
  if (active.length === 0) return null

  return <section className="v15-synergy-panel">
    <div className="v15-section-head"><span><small>СВЯЗКИ ПОРТФЕЛЯ</small><b>Бизнесы усиливают друг друга</b></span></div>
    {active.map((asset) => <div key={asset.id}><span><b>{asset.name}</b><small>{asset.synergyLabel}</small></span><strong>+{Math.round((asset.synergyBonus ?? 0) * 100)}%<small>{money(assetCashflow(asset))}/мес.</small></strong></div>)}
  </section>
}

export function RivalIntentPanel() {
  const game = useGameStore((store) => store.game)
  const bots = game.players.filter((player) => player.isBot && player.status === 'active')
  if (bots.length === 0) return null
  return <section className="content-section v15-rival-intents">
    <div className="section-heading"><span className="eyebrow">НАМЕРЕНИЯ СОПЕРНИКОВ</span><h2>Что они собираются делать</h2></div>
    {bots.map((bot) => <article key={bot.id}><span><b>{bot.name}</b><small>{bot.botStrategy === 'careful' ? 'Осторожная стратегия' : bot.botStrategy === 'aggressive' ? 'Агрессивная стратегия' : 'Сбалансированная стратегия'}</small></span><p>{bot.rivalIntent ?? 'Оценивает рынок и копит на следующий ход'}</p></article>)}
  </section>
}

export function EventChainPanel() {
  const game = useGameStore((store) => store.game)
  if (!game.eventChains?.length) return null
  return <section className="v15-chain-panel">
    <div className="v15-section-head"><span><small>ПОСЛЕДСТВИЯ РЕШЕНИЙ</small><b>Партия помнит прошлые ходы</b></span></div>
    {game.eventChains.map((chain) => <div key={chain.id}><span><b>{chain.title}</b><small>{chain.description}</small></span><strong>Месяц {chain.resolvesMonth}</strong></div>)}
  </section>
}
