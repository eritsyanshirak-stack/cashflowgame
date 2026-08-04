from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'Missing anchor: {label}')
    return text.replace(old, new, 1)


def insert_before(text: str, anchor: str, addition: str, label: str) -> str:
    if anchor not in text:
        raise SystemExit(f'Missing anchor: {label}')
    return text.replace(anchor, addition + anchor, 1)

# ---------- Domain ----------
types_path = Path('src/game/domain/types.ts')
types = types_path.read_text()
types = replace_once(
    types,
    """  saleOffer: number | null
  offerExpiresMonth: number | null
""",
    """  saleOffer: number | null
  offerExpiresMonth: number | null
  listingPrice?: number | null
  listingExpiresMonth?: number | null
""",
    'asset listing fields',
)
types = replace_once(
    types,
    """  | { type: 'SELL_ASSET'; assetId: string }
  | { type: 'ACCEPT_SALE_OFFER'; assetId: string }
""",
    """  | { type: 'SELL_ASSET'; assetId: string }
  | { type: 'LIST_ASSET'; assetId: string; askingPrice: number }
  | { type: 'CANCEL_ASSET_LISTING'; assetId: string }
  | { type: 'ACCEPT_SALE_OFFER'; assetId: string }
  | { type: 'COUNTER_SALE_OFFER'; assetId: string; multiplier: 1.05 | 1.1 | 1.15 }
""",
    'sale commands',
)
types_path.write_text(types)

# ---------- Content balance ----------
content_path = Path('src/game/content/content.ts')
content = content_path.read_text()
content = replace_once(content, "marketVolatility: 0.05", "marketVolatility: 0.08", 'easy volatility')
content = replace_once(content, "marketVolatility: 0.09", "marketVolatility: 0.13", 'normal volatility')
content = replace_once(content, "marketVolatility: 0.14", "marketVolatility: 0.18", 'hard volatility')

old_expenses = """export const expenseCards = [
  ['Ремонт автомобиля', 85_000],
  ['Стоматолог', 70_000],
  ['Сломалась техника', 55_000],
  ['Налоговая доплата', 120_000],
  ['Ремонт квартиры', 180_000],
  ['Штраф и эвакуация автомобиля', 42_000],
  ['Срочная поездка к семье', 95_000],
  ['Подорожала страховка', 64_000],
  ['Замена рабочего ноутбука', 135_000],
] as const"""
new_expenses = """export const expenseCards = [
  ['Ремонт автомобиля', 17_000],
  ['Стоматолог', 14_000],
  ['Сломалась техника', 11_000],
  ['Налоговая доплата', 24_000],
  ['Ремонт квартиры', 36_000],
  ['Штраф и эвакуация автомобиля', 8_400],
  ['Срочная поездка к семье', 19_000],
  ['Подорожала страховка', 12_800],
  ['Замена рабочего ноутбука', 27_000],
] as const"""
content = replace_once(content, old_expenses, new_expenses, 'expense cards')

old_stocks = """export const initialStockMarket: StockQuote[] = [
  { id: 'energy', name: 'Север Энерго', ticker: 'SEVR', sector: 'Энергетика', price: 18_400, previousPrice: 18_400, dividendYield: 0.072 },
  { id: 'tech', name: 'Нова Тех', ticker: 'NOVA', sector: 'Технологии', price: 31_800, previousPrice: 31_800, dividendYield: 0.018 },
  { id: 'retail', name: 'Город Маркет', ticker: 'CITY', sector: 'Ритейл', price: 12_600, previousPrice: 12_600, dividendYield: 0.048 },
  { id: 'bank', name: 'Первый Банк', ticker: 'BANK', sector: 'Финансы', price: 24_200, previousPrice: 24_200, dividendYield: 0.061 },
  { id: 'biotech', name: 'Вита Лаб', ticker: 'VITA', sector: 'Биотех', price: 42_500, previousPrice: 42_500, dividendYield: 0.008 },
]"""
new_stocks = """export const initialStockMarket: StockQuote[] = [
  { id: 'energy', name: 'Север Энерго', ticker: 'SEVR', sector: 'Энергетика', price: 4_600, previousPrice: 4_600, dividendYield: 0.072 },
  { id: 'tech', name: 'Нова Тех', ticker: 'NOVA', sector: 'Технологии', price: 7_950, previousPrice: 7_950, dividendYield: 0.018 },
  { id: 'retail', name: 'Город Маркет', ticker: 'CITY', sector: 'Ритейл', price: 3_150, previousPrice: 3_150, dividendYield: 0.048 },
  { id: 'bank', name: 'Первый Банк', ticker: 'BANK', sector: 'Финансы', price: 6_050, previousPrice: 6_050, dividendYield: 0.061 },
  { id: 'biotech', name: 'Вита Лаб', ticker: 'VITA', sector: 'Биотех', price: 8_500, previousPrice: 8_500, dividendYield: 0.008 },
]"""
content = replace_once(content, old_stocks, new_stocks, 'stock prices')

old_headlines = """export const marketHeadlines = [
  { title: 'Ставку снизили', sector: 'Финансы', impact: 0.08 },
  { title: 'Спрос на технологии ускорился', sector: 'Технологии', impact: 0.11 },
  { title: 'Потребители начали экономить', sector: 'Ритейл', impact: -0.09 },
  { title: 'Новый экспортный контракт', sector: 'Энергетика', impact: 0.1 },
  { title: 'Испытания препарата задержались', sector: 'Биотех', impact: -0.13 },
  { title: 'Рынок ждёт новых данных', sector: null, impact: 0 },
  { title: 'Банки ужесточили кредитование', sector: 'Финансы', impact: -0.08 },
  { title: 'Ритейл отчитался сильнее ожиданий', sector: 'Ритейл', impact: 0.09 },
  { title: 'Цены на энергию снизились', sector: 'Энергетика', impact: -0.1 },
  { title: 'Биотех получил государственный заказ', sector: 'Биотех', impact: 0.12 },
  { title: 'Технологический сектор перегрет', sector: 'Технологии', impact: -0.08 },
] as const"""
new_headlines = """export const marketHeadlines = [
  { title: 'Ставку снизили', sector: 'Финансы', impact: 0.14 },
  { title: 'Спрос на технологии ускорился', sector: 'Технологии', impact: 0.18 },
  { title: 'Потребители начали экономить', sector: 'Ритейл', impact: -0.15 },
  { title: 'Новый экспортный контракт', sector: 'Энергетика', impact: 0.17 },
  { title: 'Испытания препарата задержались', sector: 'Биотех', impact: -0.2 },
  { title: 'Рынок ждёт новых данных', sector: null, impact: 0 },
  { title: 'Банки ужесточили кредитование', sector: 'Финансы', impact: -0.14 },
  { title: 'Ритейл отчитался сильнее ожиданий', sector: 'Ритейл', impact: 0.16 },
  { title: 'Цены на энергию снизились', sector: 'Энергетика', impact: -0.17 },
  { title: 'Биотех получил государственный заказ', sector: 'Биотех', impact: 0.2 },
  { title: 'Технологический сектор перегрет', sector: 'Технологии', impact: -0.16 },
  { title: 'Технологический прорыв изменил рынок', sector: 'Технологии', impact: 0.55 },
  { title: 'В отчётности банка нашли серьёзные нарушения', sector: 'Финансы', impact: -0.5 },
  { title: 'Препарат неожиданно получил одобрение', sector: 'Биотех', impact: 0.65 },
  { title: 'Ключевое испытание препарата провалилось', sector: 'Биотех', impact: -0.55 },
  { title: 'Энергетический кризис взвинтил цены', sector: 'Энергетика', impact: 0.5 },
  { title: 'Крупная сеть объявила дефолт', sector: 'Ритейл', impact: -0.48 },
] as const"""
content = replace_once(content, old_headlines, new_headlines, 'market headlines')
content_path.write_text(content)

# ---------- Engine ----------
engine_path = Path('src/game/engine/engine.ts')
engine = engine_path.read_text()

old_offer_logic = """    asset.saleOffer = null
    asset.offerExpiresMonth = null
    if (random(state) < settings.offerChance) {
      const premium = 0.91 + random(state) * 0.24 + asset.developmentLevel * 0.01
      asset.saleOffer = Math.round(asset.marketValue * premium)
      asset.offerExpiresMonth = state.month + 1
    }
"""
new_offer_logic = """    asset.saleOffer = null
    asset.offerExpiresMonth = null
    const nextMarketMonth = state.month + 1
    if (asset.listingPrice && asset.listingExpiresMonth && asset.listingExpiresMonth >= nextMarketMonth) {
      const listingRatio = asset.listingPrice / Math.max(1, asset.marketValue)
      const responseChance = listingRatio <= 0.95 ? 0.92 : listingRatio <= 1 ? 0.76 : listingRatio <= 1.1 ? 0.5 : listingRatio <= 1.2 ? 0.28 : 0.1
      if (random(state) < responseChance) {
        const fullPriceChance = Math.max(0.12, 0.78 - Math.max(0, listingRatio - 1) * 2.4)
        const buyerFactor = 0.88 + random(state) * 0.12
        asset.saleOffer = random(state) < fullPriceChance
          ? asset.listingPrice
          : Math.max(Math.round(asset.marketValue * 0.82), Math.round(Math.min(asset.listingPrice, asset.marketValue * buyerFactor)))
        asset.offerExpiresMonth = nextMarketMonth
      }
    } else {
      if (asset.listingExpiresMonth && asset.listingExpiresMonth < nextMarketMonth) {
        asset.listingPrice = null
        asset.listingExpiresMonth = null
      }
      if (random(state) < settings.offerChance) {
        const premium = 0.91 + random(state) * 0.24 + asset.developmentLevel * 0.01
        asset.saleOffer = Math.round(asset.marketValue * premium)
        asset.offerExpiresMonth = nextMarketMonth
      }
    }
"""
engine = replace_once(engine, old_offer_logic, new_offer_logic, 'asset offer logic')

engine = replace_once(
    engine,
    """    const sectorImpact = quote.sector === headline.sector ? headline.impact : 0
    const marketNoise = (random(state) * 2 - 1) * settings.marketVolatility
    quote.price = Math.max(1_000, Math.round(quote.price * (1 + sectorImpact + marketNoise)))
""",
    """    const sectorImpact = quote.sector === headline.sector ? headline.impact : 0
    const marketNoise = (random(state) * 2 - 1) * settings.marketVolatility
    const totalMove = Math.max(-0.5, Math.min(0.65, sectorImpact + marketNoise))
    quote.price = Math.max(500, Math.round(quote.price * (1 + totalMove)))
""",
    'stock market movement',
)

list_handlers = """  if (command.type === 'LIST_ASSET') {
    if (state.phase !== 'ready') return reject(current, 'Сначала заверши текущее решение')
    const asset = player.assets.find((item) => item.id === command.assetId)
    if (!asset) return reject(current, 'Актив не найден')
    const marketValue = assetMarketValue(asset)
    const minPrice = Math.round(marketValue * 0.9)
    const maxPrice = Math.round(marketValue * 1.4)
    if (!Number.isFinite(command.askingPrice) || command.askingPrice < minPrice || command.askingPrice > maxPrice) {
      return reject(current, `Цена должна быть от ${minPrice.toLocaleString('ru-RU')} ₽ до ${maxPrice.toLocaleString('ru-RU')} ₽`)
    }
    asset.listingPrice = Math.round(command.askingPrice)
    asset.listingExpiresMonth = state.month + 3
    asset.saleOffer = null
    asset.offerExpiresMonth = null
    addEvent(state, 'Актив выставлен на продажу', `${asset.name}: цена ${asset.listingPrice.toLocaleString('ru-RU')} ₽, срок три месяца.`, 'neutral')
    return { state, accepted: true }
  }

  if (command.type === 'CANCEL_ASSET_LISTING') {
    if (state.phase !== 'ready') return reject(current, 'Сначала заверши текущее решение')
    const asset = player.assets.find((item) => item.id === command.assetId)
    if (!asset) return reject(current, 'Актив не найден')
    asset.listingPrice = null
    asset.listingExpiresMonth = null
    asset.saleOffer = null
    asset.offerExpiresMonth = null
    addEvent(state, 'Продажа отменена', `${asset.name} снят с рынка.`, 'neutral')
    return { state, accepted: true }
  }

"""
engine = insert_before(engine, "  if (command.type === 'SELL_ASSET') {\n", list_handlers, 'asset listing handlers')

engine = replace_once(
    engine,
    """    const marketValue = assetMarketValue(asset)
    const { proceeds, bankPayment, deficiency } = sellAsset(player, asset, marketValue)
    addEvent(state, 'Актив продан', `${asset.name}: ${marketValue.toLocaleString('ru-RU')} ₽, банку ${bankPayment.toLocaleString('ru-RU')} ₽, на руки ${proceeds.toLocaleString('ru-RU')} ₽${deficiency > 0 ? `, остаточный долг ${deficiency.toLocaleString('ru-RU')} ₽` : ''}`, proceeds >= asset.downPayment ? 'good' : deficiency > 0 ? 'bad' : 'neutral')
""",
    """    const marketValue = assetMarketValue(asset)
    const quickPrice = Math.round(marketValue * 0.93)
    const { proceeds, bankPayment, deficiency } = sellAsset(player, asset, quickPrice)
    addEvent(state, 'Быстрая продажа', `${asset.name}: цена ${quickPrice.toLocaleString('ru-RU')} ₽ (93% рынка), банку ${bankPayment.toLocaleString('ru-RU')} ₽, на руки ${proceeds.toLocaleString('ru-RU')} ₽${deficiency > 0 ? `, остаточный долг ${deficiency.toLocaleString('ru-RU')} ₽` : ''}`, proceeds >= asset.downPayment ? 'good' : deficiency > 0 ? 'bad' : 'neutral')
""",
    'quick sale price',
)

counter_handler = """  if (command.type === 'COUNTER_SALE_OFFER') {
    if (state.phase !== 'ready') return reject(current, 'Сначала заверши текущее решение')
    const asset = player.assets.find((item) => item.id === command.assetId)
    if (!asset || !asset.saleOffer || asset.offerExpiresMonth !== state.month) return reject(current, 'Предложение уже недоступно')
    const counterPrice = Math.round(asset.saleOffer * command.multiplier)
    const marketValue = assetMarketValue(asset)
    const premium = Math.max(0, counterPrice / Math.max(1, marketValue) - 1)
    const acceptanceChance = Math.max(0.08, Math.min(0.9, 0.74 + skillLevel(player, 'negotiation') * 0.07 - premium * 1.9 - (command.multiplier - 1) * 1.4))
    if (random(state) < acceptanceChance) {
      const { proceeds } = sellAsset(player, asset, counterPrice)
      addEvent(state, 'Контроффер принят', `${asset.name}: покупатель согласился на ${counterPrice.toLocaleString('ru-RU')} ₽, на руки ${proceeds.toLocaleString('ru-RU')} ₽.`, 'good')
      awardProgress(state, player, 20, 'negotiation', 12)
      return { state, accepted: true }
    }
    asset.saleOffer = null
    asset.offerExpiresMonth = null
    addEvent(state, 'Покупатель отказался', `${asset.name}: встречная цена ${counterPrice.toLocaleString('ru-RU')} ₽ не принята. Объявление остаётся активным.`, 'bad')
    return { state, accepted: true }
  }

"""
engine = insert_before(engine, "  if (command.type === 'ROLL_DICE') {\n", counter_handler, 'counter offer handler')
engine_path.write_text(engine)

# ---------- App ----------
app_path = Path('src/App.tsx')
app = app_path.read_text()
app = replace_once(
    app,
    """  const player = game.players[0]
  return <section className="content-section">
""",
    """  const player = game.players[0]
  const [listingInputs, setListingInputs] = useState<Record<string, string>>({})
  return <section className="content-section">
""",
    'assets local state',
)

old_offer_ui = """      {asset.saleOffer && asset.offerExpiresMonth === game.month && <div className="sale-offer"><div><small>ПРЕДЛОЖЕНИЕ ДО КОНЦА МЕСЯЦА</small><strong>{money(asset.saleOffer)}</strong></div><button disabled={game.phase !== 'ready'} onClick={() => dispatch({ type: 'ACCEPT_SALE_OFFER', assetId: asset.id })}>Принять</button></div>}
"""
new_offer_ui = """      {asset.listingPrice && <div className="listing-status"><span><small>ВЫСТАВЛЕН НА ПРОДАЖУ</small><b>{money(asset.listingPrice)} · до месяца {asset.listingExpiresMonth}</b></span><button disabled={game.phase !== 'ready'} onClick={() => dispatch({ type: 'CANCEL_ASSET_LISTING', assetId: asset.id })}>Снять</button></div>}
      {asset.saleOffer && asset.offerExpiresMonth === game.month && <div className="sale-offer sale-offer-expanded"><div><small>ПОКУПАТЕЛЬ ПРЕДЛАГАЕТ</small><strong>{money(asset.saleOffer)}</strong></div><div className="sale-offer-actions"><button disabled={game.phase !== 'ready'} onClick={() => dispatch({ type: 'ACCEPT_SALE_OFFER', assetId: asset.id })}>Принять</button><button disabled={game.phase !== 'ready'} onClick={() => dispatch({ type: 'COUNTER_SALE_OFFER', assetId: asset.id, multiplier: 1.05 })}>+5%</button><button disabled={game.phase !== 'ready'} onClick={() => dispatch({ type: 'COUNTER_SALE_OFFER', assetId: asset.id, multiplier: 1.1 })}>+10%</button><button disabled={game.phase !== 'ready'} onClick={() => dispatch({ type: 'COUNTER_SALE_OFFER', assetId: asset.id, multiplier: 1.15 })}>+15%</button></div></div>}
"""
app = replace_once(app, old_offer_ui, new_offer_ui, 'sale offer UI')

old_sell_button = """      <button className="sell-button" disabled={game.phase !== 'ready'} onClick={() => dispatch({ type: 'SELL_ASSET', assetId: asset.id })}>Продать по рынку</button>
"""
new_sell_button = """      <div className="asset-listing-controls"><div><input type="number" inputMode="numeric" min={Math.round(assetMarketValue(asset) * .9)} max={Math.round(assetMarketValue(asset) * 1.4)} step="1000" value={listingInputs[asset.id] ?? Math.round(assetMarketValue(asset) * 1.1)} onChange={(event) => setListingInputs((current) => ({ ...current, [asset.id]: event.target.value }))} /><button disabled={game.phase !== 'ready'} onClick={() => dispatch({ type: 'LIST_ASSET', assetId: asset.id, askingPrice: Number(listingInputs[asset.id] ?? Math.round(assetMarketValue(asset) * 1.1)) })}>Выставить</button></div><small>Можно назначить 90–140% рыночной цены. Покупатель может согласиться, предложить меньше или не прийти.</small><div className="listing-presets">{[1, 1.1, 1.2, 1.3].map((ratio) => <button type="button" key={ratio} onClick={() => setListingInputs((current) => ({ ...current, [asset.id]: String(Math.round(assetMarketValue(asset) * ratio)) }))}>{Math.round(ratio * 100)}%</button>)}</div></div>
      <button className="sell-button" disabled={game.phase !== 'ready'} onClick={() => dispatch({ type: 'SELL_ASSET', assetId: asset.id })}>Продать сейчас за {money(Math.round(assetMarketValue(asset) * .93))}</button>
"""
app = replace_once(app, old_sell_button, new_sell_button, 'asset sale controls')

app = replace_once(
    app,
    """  const [saleAssetIds, setSaleAssetIds] = useState<string[]>([])
  const toggleSaleAsset = (assetId: string) => setSaleAssetIds((current) =>
    current.includes(assetId) ? current.filter((id) => id !== assetId) : [...current, assetId],
  )
""",
    """  const [saleAssetIds, setSaleAssetIds] = useState<string[]>([])
  const [collateralAssetId, setCollateralAssetId] = useState<string>()
  const toggleSaleAsset = (assetId: string) => {
    setSaleAssetIds((current) => current.includes(assetId) ? current.filter((id) => id !== assetId) : [...current, assetId])
    if (collateralAssetId === assetId) setCollateralAssetId(undefined)
  }
  const toggleCollateralAsset = (assetId: string) => {
    setCollateralAssetId((current) => current === assetId ? undefined : assetId)
    setSaleAssetIds((current) => current.filter((id) => id !== assetId))
  }
""",
    'deal collateral state',
)

app = replace_once(
    app,
    """    const collateralOffers = financingPlayer.assets
      .map((asset) => ({ asset, offer: assessLoan(financingPlayer, remainingGap, game.difficulty, asset, projectedOperatingIncome, businessPayment) }))
      .filter(({ offer }) => remainingGap > 0 && offer.approved)
""",
    """    const collateralOptions = financingPlayer.assets.map((asset) => ({ asset, offer: assessLoan(financingPlayer, remainingGap, game.difficulty, asset, projectedOperatingIncome, businessPayment) }))
    const selectedCollateral = collateralOptions.find(({ asset }) => asset.id === collateralAssetId)
    const selectedCollateralOffer = selectedCollateral?.offer
    const anyApprovedCollateral = collateralOptions.some(({ offer }) => remainingGap > 0 && offer.approved)
""",
    'deal collateral calculations',
)

old_financing_panel = """      {player.assets.length > 0 && <div className="deal-financing-panel">
        <div className="portfolio-heading"><span><small>СОБРАТЬ ФИНАНСИРОВАНИЕ</small><b>Продать активы для первого взноса</b></span><strong className={saleProceeds > 0 ? 'good' : ''}>+{money(saleProceeds)}</strong></div>
        <div className="funding-actions">{player.assets.map((asset) => {
          const impact = saleImpactFor(asset)
          const selected = saleAssetIds.includes(asset.id)
          return <button type="button" key={asset.id} aria-pressed={selected} className={selected ? 'selected-funding' : ''} onClick={() => toggleSaleAsset(asset.id)}>
            <b>{selected ? '✓ Продать' : 'Продать'} {asset.name}</b>
            <small>На руки {money(impact.proceeds)}{impact.deficiency > 0 ? ` · останется долг ${money(impact.deficiency)}` : ''} · поток {money(assetCashflow(asset))}/мес</small>
          </button>
        })}</div>
      </div>}
"""
new_financing_panel = """      {player.assets.length > 0 && <div className="deal-financing-panel">
        <div className="portfolio-heading"><span><small>СОБРАТЬ ФИНАНСИРОВАНИЕ</small><b>Продать или заложить актив</b></span><strong className={saleProceeds > 0 ? 'good' : ''}>+{money(saleProceeds)}</strong></div>
        <div className="deal-asset-choices">{player.assets.map((asset) => {
          const impact = saleImpactFor(asset)
          const selectedForSale = saleAssetIds.includes(asset.id)
          const selectedForCollateral = collateralAssetId === asset.id
          const alreadyPledged = Boolean(pledgedLoanForAsset(player, asset.id))
          const collateralLimit = availableCollateral(player, asset)
          return <div key={asset.id} className={`deal-asset-choice ${selectedForSale ? 'selected-sale' : ''} ${selectedForCollateral ? 'selected-collateral' : ''}`}><div className="deal-asset-copy"><b>{asset.name}</b><small>Стоимость {money(assetMarketValue(asset))} · поток {money(assetCashflow(asset))}/мес</small></div><div className="deal-asset-buttons"><button type="button" aria-pressed={selectedForSale} onClick={() => toggleSaleAsset(asset.id)}><b>{selectedForSale ? '✓ Продать' : 'Продать'}</b><small>На руки {money(impact.proceeds)}{impact.deficiency > 0 ? ` · долг ${money(impact.deficiency)}` : ''}</small></button><button type="button" aria-pressed={selectedForCollateral} disabled={alreadyPledged || collateralLimit <= 0 || remainingGap <= 0} onClick={() => toggleCollateralAsset(asset.id)}><b>{selectedForCollateral ? '✓ Заложить' : 'Заложить'}</b><small>{alreadyPledged ? 'Уже в залоге' : collateralLimit > 0 ? `Лимит до ${money(collateralLimit)}` : 'Нет свободной стоимости'}</small></button></div></div>
        })}</div>
      </div>}
"""
app = replace_once(app, old_financing_panel, new_financing_panel, 'deal financing panel')

old_funding_actions = """      <div className="funding-actions">
        {remainingGap > 0 && unsecured.approved && hasBuyerContribution && <button onClick={() => buy('credit')}><b>{saleAssetIds.length > 0 ? 'Продать активы + кредит' : 'Наличными + кредит'}</b><small>Банк добавит {money(remainingGap)} · {money(unsecured.monthlyPayment)}/мес</small></button>}
        {collateralOffers.map(({ asset, offer }) => <button key={asset.id} onClick={() => buy('secured', asset.id)}><b>{saleAssetIds.length > 0 ? 'Продать выбранные + ' : ''}заложить {asset.name}</b><small>Получить {money(remainingGap)} · {Math.round(offer.annualRate * 100)}% · {money(offer.monthlyPayment)}/мес</small></button>)}
        <button disabled={cashAfterSales < Math.round(downPayment * .7)} onClick={() => buy('partner30')}><b>{saleAssetIds.length > 0 ? 'Продажа + партнёр 30%' : 'Партнёр 30%'}</b><small>Твой взнос {money(Math.round(downPayment * .7))}</small></button>
        <button disabled={cashAfterSales < Math.round(downPayment * .5)} onClick={() => buy('partner50')}><b>{saleAssetIds.length > 0 ? 'Продажа + партнёр 50%' : 'Партнёр 50%'}</b><small>Твой взнос {money(Math.round(downPayment * .5))}</small></button>
      </div>
      {remainingGap > 0 && !unsecured.approved && collateralOffers.length === 0 && <div className="bank-verdict declined"><b>Текущая схема не проходит</b><span>{unsecured.reason}. Выбери другой актив для продажи или залога.</span></div>}
"""
new_funding_actions = """      <div className="funding-actions">
        {remainingGap > 0 && unsecured.approved && hasBuyerContribution && <button onClick={() => buy('credit')}><b>{saleAssetIds.length > 0 ? 'Продать активы + кредит' : 'Наличными + кредит'}</b><small>Банк добавит {money(remainingGap)} · {money(unsecured.monthlyPayment)}/мес</small></button>}
        {remainingGap > 0 && selectedCollateral && <button disabled={!selectedCollateralOffer?.approved} onClick={() => buy('secured', selectedCollateral.asset.id)}><b>{saleAssetIds.length > 0 ? 'Продать выбранные + ' : ''}заложить {selectedCollateral.asset.name}</b><small>{selectedCollateralOffer?.approved ? `Получить ${money(remainingGap)} · ${Math.round(selectedCollateralOffer.annualRate * 100)}% · ${money(selectedCollateralOffer.monthlyPayment)}/мес` : selectedCollateralOffer?.reason ?? 'Банк не одобрил этот залог'}</small></button>}
        <button disabled={cashAfterSales < Math.round(downPayment * .7)} onClick={() => buy('partner30')}><b>{saleAssetIds.length > 0 ? 'Продажа + партнёр 30%' : 'Партнёр 30%'}</b><small>Твой взнос {money(Math.round(downPayment * .7))}</small></button>
        <button disabled={cashAfterSales < Math.round(downPayment * .5)} onClick={() => buy('partner50')}><b>{saleAssetIds.length > 0 ? 'Продажа + партнёр 50%' : 'Партнёр 50%'}</b><small>Твой взнос {money(Math.round(downPayment * .5))}</small></button>
      </div>
      {remainingGap > 0 && collateralAssetId && selectedCollateralOffer && !selectedCollateralOffer.approved && <div className="bank-verdict declined"><b>Этот залог не подходит</b><span>{selectedCollateralOffer.reason}</span></div>}
      {remainingGap > 0 && !collateralAssetId && anyApprovedCollateral && <div className="bank-verdict"><b>Можно использовать залог</b><span>Нажми «Заложить» у нужного актива выше, затем подтверди покупку.</span></div>}
      {remainingGap > 0 && !unsecured.approved && !anyApprovedCollateral && <div className="bank-verdict declined"><b>Текущая схема не проходит</b><span>{unsecured.reason}. Продай другой актив или уменьши сумму сделки.</span></div>}
"""
app = replace_once(app, old_funding_actions, new_funding_actions, 'deal funding actions')

old_market_help = """<small className="market-fee">В цене сделки комиссия 1,5%. Можно совершить несколько операций.</small><div className="split-actions two"><button onClick={() => dispatch({ type: 'DEPOSIT', amount: 50_000 })}>Депозит 50 000</button><button onClick={() => dispatch({ type: 'BUY_BONDS', amount: 50_000 })}>Облигации 50 000</button><button onClick={() => dispatch({ type: 'WITHDRAW_DEPOSIT', amount: 50_000 })}>Снять депозит</button><button onClick={() => dispatch({ type: 'SELL_BONDS', amount: 50_000 })}>Продать облигации</button></div>"""
new_market_help = """<small className="market-fee">Акции меняются в цене и дают дивиденды. В цене сделки комиссия 1,5%.</small><div className="finance-explain"><div><b>Депозит · {money(player.deposit)}</b><span>Безопасная часть резерва. Даёт 0,9% в месяц. «Положить» переводит деньги со счёта на депозит, «снять» возвращает их обратно.</span></div><div><b>Облигации · {money(player.bonds)}</b><span>Ты даёшь деньги в долг и получаешь 1,4% в месяц. Доход выше депозита; чтобы снова потратить эти деньги, облигации нужно продать.</span></div></div><div className="split-actions two"><button disabled={player.cash < 50_000} onClick={() => dispatch({ type: 'DEPOSIT', amount: 50_000 })}>Положить 50 000 ₽</button><button disabled={player.cash < 50_000} onClick={() => dispatch({ type: 'BUY_BONDS', amount: 50_000 })}>Купить облигации</button><button disabled={player.deposit < 50_000} onClick={() => dispatch({ type: 'WITHDRAW_DEPOSIT', amount: 50_000 })}>Снять 50 000 ₽</button><button disabled={player.bonds < 50_000} onClick={() => dispatch({ type: 'SELL_BONDS', amount: 50_000 })}>Продать облигации</button></div>"""
app = replace_once(app, old_market_help, new_market_help, 'finance explanations')
app_path.write_text(app)

# ---------- CSS ----------
css_path = Path('src/premium.css')
css = css_path.read_text()
css += """

.deal-asset-choices { display: grid; gap: 9px; margin-top: 10px; }
.deal-asset-choice { padding: 10px; border: 1px solid #e1e4e6; border-radius: 13px; background: #f8f9fa; }
.deal-asset-choice.selected-sale { border-color: #d89b52; background: #fff8ed; }
.deal-asset-choice.selected-collateral { border-color: #176b4d; background: #edf6f2; }
.deal-asset-copy { display: grid; gap: 2px; margin-bottom: 8px; }
.deal-asset-copy b { color: #24292e; font-size: 11px; }
.deal-asset-copy small { color: #737980; font-size: 9px; }
.deal-asset-buttons { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
.deal-asset-buttons button { display: grid; gap: 3px; min-height: 48px; padding: 8px; text-align: left; color: #383d43; background: #fff; border: 1px solid #dde0e3; border-radius: 10px; }
.deal-asset-buttons button[aria-pressed='true'] { color: #0f6546; border-color: #3a8a6c; box-shadow: inset 0 0 0 1px rgba(23,107,77,.12); }
.deal-asset-buttons button:disabled { opacity: .46; }
.deal-asset-buttons b { font-size: 10px; }
.deal-asset-buttons small { color: #777d84; font-size: 8px; line-height: 1.25; }
.finance-explain { display: grid; gap: 8px; margin: 12px 0; }
.finance-explain > div { display: grid; gap: 4px; padding: 11px 12px; border: 1px solid #e1e4e6; border-radius: 12px; background: #f7f8f9; }
.finance-explain b { color: #20252a; font-size: 11px; }
.finance-explain span { color: #697078; font-size: 9px; line-height: 1.45; }
.asset-listing-controls { display: grid; gap: 7px; padding: 11px; margin: 10px 0; border: 1px solid #e2e4e7; border-radius: 12px; background: #f7f8f9; }
.asset-listing-controls > div:first-child { display: grid; grid-template-columns: 1fr auto; gap: 7px; }
.asset-listing-controls input { min-width: 0; padding: 9px 10px; color: #20252a; background: #fff; border: 1px solid #d9dde0; border-radius: 9px; font-weight: 700; }
.asset-listing-controls > div:first-child button { padding: 0 13px; color: #fff; background: #176b4d; border-radius: 9px; font-weight: 800; }
.asset-listing-controls > small { color: #737980; font-size: 8px; line-height: 1.4; }
.listing-presets { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; }
.listing-presets button { padding: 6px 3px; color: #4c5258; background: #fff; border: 1px solid #dfe2e5; border-radius: 8px; font-size: 9px; font-weight: 800; }
.listing-status { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px; margin-top: 9px; border: 1px solid #b9d7c9; border-radius: 11px; background: #edf6f2; }
.listing-status span { display: grid; gap: 2px; }
.listing-status small { color: #4d7d69; font-size: 7px; font-weight: 900; letter-spacing: .1em; }
.listing-status b { color: #174c39; font-size: 10px; }
.listing-status button { padding: 7px 10px; color: #4f565c; background: #fff; border: 1px solid #d7dcdf; border-radius: 8px; font-size: 9px; font-weight: 800; }
.sale-offer-expanded { display: grid; gap: 9px; }
.sale-offer-actions { display: grid; grid-template-columns: 1.4fr repeat(3, 1fr); gap: 5px; }
.sale-offer-actions button { min-height: 34px; padding: 6px; border-radius: 8px; font-size: 9px; font-weight: 800; }
"""
css_path.write_text(css)

# ---------- Tests ----------
test_path = Path('src/game/engine/engine.test.ts')
test = test_path.read_text()
test = replace_once(test, "expect(result.state.players[0].cash).toBe(300_000)", "expect(result.state.players[0].cash).toBe(266_400)", 'quick-sale expected cash')
test_path.write_text(test)

new_test = Path('src/game/engine/market-sale.test.ts')
new_test.write_text("""import { describe, expect, it } from 'vitest'
import { businesses, expenseCards, initialStockMarket, marketHeadlines } from '../content/content'
import type { Asset } from '../domain/types'
import { assetMarketValue, loanPayment } from '../systems/economy'
import { emptyGame, executeCommand } from './engine'

const gameWithAsset = () => {
  const game = executeCommand(emptyGame(41), { type: 'START_GAME', professionId: 'trainer', seed: 41 }).state
  const player = game.players[0]
  const business = businesses.find((item) => item.id === 'vending')!
  const asset: Asset = { ...business, id: 'listed-vending', ownerId: player.id, ownership: 1, monthlyPayment: loanPayment(business.loan, business.loanRate, business.loanTermMonths), purchaseMonth: 1, developmentLevel: 0, developments: [], totalDevelopmentCost: 0, lastDevelopedMonth: null, saleOffer: null, offerExpiresMonth: null, status: 'active', dueDiligence: 'none', launchMonthsRemaining: 0, incidentCooldown: 0, issueMonths: 0, missedPayments: 0 }
  player.assets = [asset]
  return game
}

describe('market and asset sale rebalance', () => {
  it('keeps random expense cards material but below 40k', () => {
    expect(Math.max(...expenseCards.map(([, amount]) => amount))).toBe(36_000)
  })

  it('makes every initial share affordable below 10k', () => {
    expect(Math.max(...initialStockMarket.map((quote) => quote.price))).toBeLessThan(10_000)
  })

  it('contains rare stock events capable of roughly 50 percent moves', () => {
    expect(marketHeadlines.some((headline) => headline.impact >= 0.5)).toBe(true)
    expect(marketHeadlines.some((headline) => headline.impact <= -0.48)).toBe(true)
  })

  it('lets the player list an asset only inside the 90-140 percent corridor', () => {
    const game = gameWithAsset()
    const asset = game.players[0].assets[0]
    const market = assetMarketValue(asset)
    const listed = executeCommand(game, { type: 'LIST_ASSET', assetId: asset.id, askingPrice: Math.round(market * 1.2) })
    expect(listed.accepted).toBe(true)
    expect(listed.state.players[0].assets[0].listingPrice).toBe(Math.round(market * 1.2))
    expect(listed.state.players[0].assets[0].listingExpiresMonth).toBe(game.month + 3)

    const tooHigh = executeCommand(gameWithAsset(), { type: 'LIST_ASSET', assetId: asset.id, askingPrice: Math.round(market * 1.5) })
    expect(tooHigh.accepted).toBe(false)
  })

  it('uses a 7 percent haircut for an immediate sale', () => {
    const game = gameWithAsset()
    const asset = game.players[0].assets[0]
    const startingCash = game.players[0].cash
    const expectedGross = Math.round(assetMarketValue(asset) * 0.93)
    const result = executeCommand(game, { type: 'SELL_ASSET', assetId: asset.id })
    expect(result.accepted).toBe(true)
    expect(result.state.players[0].cash).toBe(startingCash + expectedGross)
  })
})
""
)
