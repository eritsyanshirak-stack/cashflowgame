import { businesses } from './game/content/content'
import type { Asset, Decision, Player } from './game/domain/types'
import { assetCashflow } from './game/systems/economy'
import { calculateAssetSaleSummary, calculatePartnershipTerms } from './game/systems/v16'
import { useGameStore } from './store/gameStore'

const money = (value: number) => `${Math.round(value).toLocaleString('ru-RU')} ₽`
const percent = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`

export function PartnershipDecision({ decision, commonSkip }: {
  decision: Extract<Decision, { kind: 'partnership' }>
  commonSkip: React.ReactNode
}) {
  const game = useGameStore((store) => store.game)
  const dispatch = useGameStore((store) => store.dispatch)
  const player = game.players[0]
  const business = businesses.find((item) => item.id === decision.businessId)
  if (!business) return null

  const options = ([0.3, 0.5] as const).map((partnerShare) => ({
    partnerShare,
    terms: calculatePartnershipTerms(business, decision.discount, partnerShare),
  }))

  return <>
    <div className="decision-symbol good-bg">🤝</div>
    <span className="eyebrow">ПАРТНЁРСКОЕ ПРЕДЛОЖЕНИЕ</span>
    <h2>{decision.partnerName} предлагает войти в {decision.title}</h2>
    <p>{decision.description}</p>

    <section className="v16-deal-explainer">
      <div><small>Цена бизнеса после условий партнёра</small><b>{money(options[0].terms.dealPrice)}</b></div>
      <div><small>Общий первый взнос</small><b>{money(options[0].terms.totalDownPayment)}</b></div>
      <div><small>Кредит внутри бизнеса</small><b>{money(options[0].terms.financedLoan)}</b></div>
      <div><small>Скидка к обычной цене</small><b className="good">−{Math.round((1 - decision.discount) * 100)}%</b></div>
    </section>

    {!decision.negotiated && <section className="v16-partner-negotiation">
      <div><b>Можно попросить партнёра улучшить цену</b><small>Сделка не пропадёт: при неудаче останутся текущие условия.</small></div>
      <div className="v16-two-actions">
        <button onClick={() => dispatch({ type: 'NEGOTIATE_PARTNERSHIP', request: 'small' })}><b>Мягкий торг</b><small>Попробовать ещё −3%</small></button>
        <button onClick={() => dispatch({ type: 'NEGOTIATE_PARTNERSHIP', request: 'bold' })}><b>Жёсткий торг</b><small>Попробовать ещё −6%</small></button>
      </div>
    </section>}
    {decision.negotiationNote && <div className={decision.negotiationSucceeded ? 'v14-info' : 'v14-warning'}><b>{decision.negotiationSucceeded ? 'Условия улучшены' : 'Цена осталась прежней'}</b><span>{decision.negotiationNote}</span></div>}

    <div className="v16-partner-options">{options.map(({ partnerShare, terms }) => {
      const missing = Math.max(0, terms.playerCashNeeded - player.cash)
      return <article key={partnerShare}>
        <div className="v16-partner-option-head">
          <span><small>ПАРТНЁР ВКЛАДЫВАЕТ {Math.round(partnerShare * 100)}%</small><b>У тебя остаётся {Math.round(terms.playerOwnership * 100)}% бизнеса</b></span>
          <strong className={terms.projectedPlayerFlow >= 0 ? 'good' : 'bad'}>{terms.projectedPlayerFlow >= 0 ? '+' : ''}{money(terms.projectedPlayerFlow)}<small>твой поток / мес.</small></strong>
        </div>
        <div className="v16-money-grid">
          <span>Ты платишь сейчас <b>{money(terms.playerCashNeeded)}</b></span>
          <span>Партнёр вносит <b>{money(terms.partnerCashContribution)}</b></span>
          <span>Твой долг бизнеса <b>{money(terms.playerLoan)}</b></span>
          <span>Твой платёж / мес. <b>{money(terms.playerMonthlyPayment)}</b></span>
        </div>
        {missing > 0 && <div className="v16-inline-warning">Не хватает {money(missing)}</div>}
        <button className="primary-action" disabled={missing > 0} onClick={() => dispatch({ type: 'ACCEPT_PARTNERSHIP', ownership: partnerShare })}>
          Войти за {money(terms.playerCashNeeded)} <span>→</span>
        </button>
      </article>
    })}</div>
    {commonSkip}
  </>
}

export function AssetInvestmentPanel({ player, asset }: { player: Player; asset: Asset }) {
  const summary = calculateAssetSaleSummary(player, asset)
  const marketTone = summary.marketProfit >= 0 ? 'good' : 'bad'
  const quickTone = summary.quickProfit >= 0 ? 'good' : 'bad'
  const flowTone = summary.cumulativeNetCashflow >= 0 ? 'good' : 'bad'

  return <details className="v16-asset-money" open>
    <summary><span>Деньги в этом активе</span><strong className={marketTone}>{summary.marketProfit >= 0 ? '+' : ''}{money(summary.marketProfit)} итог при продаже</strong></summary>
    <div className="v16-money-grid">
      <span>Первый взнос своими <b>{money(asset.purchaseCashContribution ?? asset.downPayment)}</b></span>
      <span>Вложено в текущую долю <b>{money(summary.invested)}</b></span>
      <span>Всего вложено за всё время <b>{money(summary.lifetimeInvested)}</b></span>
      <span>Уже возвращено продажей долей <b className={summary.cashReturned > 0 ? 'good' : ''}>{money(summary.cashReturned)}</b></span>
      <span>Чистый поток получен за всё время <b className={flowTone}>{summary.cumulativeNetCashflow >= 0 ? '+' : ''}{money(summary.cumulativeNetCashflow)}</b></span>
      <span>Кредит на первый взнос ещё остался <b className={summary.relatedAcquisitionDebt > 0 ? 'bad' : ''}>{money(summary.relatedAcquisitionDebt)}</b></span>
      <span>Текущий поток <b className={assetCashflow(asset) >= 0 ? 'good' : 'bad'}>{money(assetCashflow(asset))}/мес.</b></span>
      {asset.partnerName && <span>Партнёр <b>{asset.partnerName} · {Math.round((1 - asset.ownership) * 100)}%</b></span>}
    </div>
    <div className="v16-return-note">Итог владения учитывает все твои вложения, уже полученный поток, проданные доли, долги и возможный остаточный долг после продажи.</div>
    <div className="v16-sale-comparison">
      <div>
        <small>ПРОДАТЬ ПО РЫНКУ</small>
        <b>{money(summary.marketValue)}</b>
        <span>На руки сейчас: {money(summary.marketProceeds)}</span>
        {summary.marketDeficiency > 0 && <span className="bad">Останется долг: {money(summary.marketDeficiency)}</span>}
        <span>Только результат продажи: <b className={summary.marketPositionProfit >= 0 ? 'good' : 'bad'}>{summary.marketPositionProfit >= 0 ? '+' : ''}{money(summary.marketPositionProfit)}</b></span>
        <strong className={marketTone}>Итог владения: {summary.marketProfit >= 0 ? '+' : ''}{money(summary.marketProfit)} · {percent(summary.marketProfitPercent)}</strong>
      </div>
      <div>
        <small>ПРОДАТЬ СРОЧНО</small>
        <b>{money(summary.quickPrice)}</b>
        <span>На руки сейчас: {money(summary.quickProceeds)}</span>
        {summary.quickDeficiency > 0 && <span className="bad">Останется долг: {money(summary.quickDeficiency)}</span>}
        <span>Только результат продажи: <b className={summary.quickPositionProfit >= 0 ? 'good' : 'bad'}>{summary.quickPositionProfit >= 0 ? '+' : ''}{money(summary.quickPositionProfit)}</b></span>
        <strong className={quickTone}>Итог владения: {summary.quickProfit >= 0 ? '+' : ''}{money(summary.quickProfit)} · {percent(summary.quickProfitPercent)}</strong>
      </div>
    </div>
    <div className="v16-break-even"><span>Цена для общего результата в ноль</span><b>{money(summary.breakEvenGrossPrice)}</b><small>Учитывает весь полученный поток и деньги, уже возвращённые продажей долей.</small></div>
    <div className="v16-break-even"><span>Цена, чтобы не осталось долга по бизнесу и залогу</span><b>{money(summary.debtFreeGrossPrice)}</b><small>Отдельный кредит на первоначальный взнос здесь не погашается автоматически и показан выше.</small></div>
  </details>
}
