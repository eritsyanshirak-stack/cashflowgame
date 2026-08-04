import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useGameStore } from './store/gameStore'
import { calculateStockSale } from './game/systems/stockSale'
import './stock-sale.css'

const money = (value: number) => `${Math.round(value).toLocaleString('ru-RU')} ₽`
const percent = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`

const useMarketMount = (active: boolean, key: string) => {
  const [target, setTarget] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!active) {
      setTarget(null)
      return
    }

    let mount: HTMLDivElement | null = null
    const attach = () => {
      const sheet = document.querySelector<HTMLElement>('.decision-market')
      if (!sheet || mount?.isConnected) return

      mount = document.createElement('div')
      mount.className = 'stock-sale-portal-mount'
      const stockList = sheet.querySelector('.stock-list')
      const fee = sheet.querySelector('.market-fee')
      if (stockList) stockList.insertAdjacentElement('afterend', mount)
      else sheet.insertBefore(mount, fee ?? null)
      setTarget(mount)
    }

    attach()
    const observer = new MutationObserver(attach)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      mount?.remove()
      setTarget(null)
    }
  }, [active, key])

  return target
}

export default function StockSaleOverlay() {
  const game = useGameStore((store) => store.game)
  const dispatch = useGameStore((store) => store.dispatch)
  const active = game.pendingDecision?.kind === 'market'
  const target = useMarketMount(active, `stock-sale-${game.month}`)

  if (!active || !target) return null

  const player = game.players[0]
  const positions = player.stocks.flatMap((holding) => {
    const quote = game.stockMarket.find((item) => item.id === holding.stockId)
    return quote ? [{ holding, quote }] : []
  })

  if (positions.length === 0) return null

  return createPortal(<section className="stock-sale-panel">
    <div className="stock-sale-title">
      <span><small>ТВОИ АКЦИИ</small><b>Что будет, если продать сейчас</b></span>
      <em>Комиссия продажи 1,5%</em>
    </div>

    <div className="stock-sale-list">{positions.map(({ holding, quote }) => {
      const all = calculateStockSale(holding.averagePrice, quote.price, holding.quantity)
      const one = calculateStockSale(holding.averagePrice, quote.price, 1)
      const tone = all.profit >= 0 ? 'good' : 'bad'

      return <article className="stock-sale-card" key={holding.stockId}>
        <div className="stock-sale-head">
          <span><b>{quote.ticker} · {holding.quantity} шт.</b><small>{quote.name}</small></span>
          <strong className={tone}>{all.profit >= 0 ? '+' : ''}{money(all.profit)}<small>{percent(all.profitPercent)}</small></strong>
        </div>

        <div className="stock-sale-facts">
          <span>Средняя покупка <b>{money(holding.averagePrice)}/шт.</b></span>
          <span>Текущая цена <b>{money(quote.price)}/шт.</b></span>
          <span>Вложено всего <b>{money(all.invested)}</b></span>
          <span>Получишь после комиссии <b>{money(all.proceeds)}</b></span>
        </div>

        <div className={`stock-sale-result ${tone}`}>
          <span>{all.profit >= 0 ? 'Прибыль при продаже' : 'Убыток при продаже'}</span>
          <b>{all.profit >= 0 ? '+' : ''}{money(all.profit)} · {percent(all.profitPercent)}</b>
        </div>

        <div className="stock-sale-actions">
          <button onClick={() => dispatch({ type: 'SELL_STOCK', stockId: quote.id, quantity: 1 })}>
            <b>Продать 1 акцию</b><small>Получишь {money(one.proceeds)} · {one.profit >= 0 ? '+' : ''}{money(one.profit)}</small>
          </button>
          <button onClick={() => dispatch({ type: 'SELL_STOCK', stockId: quote.id, quantity: holding.quantity })}>
            <b>Продать все {holding.quantity}</b><small>Получишь {money(all.proceeds)}</small>
          </button>
        </div>
      </article>
    })}</div>
  </section>, target)
}
