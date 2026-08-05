from pathlib import Path
import re


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f"pattern not found in {path}: {old[:160]!r}")
    file.write_text(text.replace(old, new, 1))


# Domain fields for live auctions, rare-deal negotiation and explicit sale confirmation.
replace_once(
    "src/game/domain/types.ts",
    "  buyerPlayerId?: string\n}",
    "  buyerPlayerId?: string\n  sellerApprovalRequired?: boolean\n}",
)
replace_once(
    "src/game/domain/types.ts",
    "  | { kind: 'opportunity'; opportunityId: string; businessId: string; askingPrice: number; originalAskingPrice?: number; title: string; description: string; negotiationNote?: string; inspection?: DueDiligence; hiddenIssue?: BusinessIssue; issueRevealed?: boolean; profile?: DealProfile; revealedFacts?: string[]; sellerCounter?: SellerCounter; sellerTerm?: SellerCounter['term'] }",
    "  | { kind: 'opportunity'; opportunityId: string; businessId: string; askingPrice: number; originalAskingPrice?: number; title: string; description: string; negotiated?: boolean; negotiationNote?: string; inspection?: DueDiligence; hiddenIssue?: BusinessIssue; issueRevealed?: boolean; profile?: DealProfile; revealedFacts?: string[]; sellerCounter?: SellerCounter; sellerTerm?: SellerCounter['term'] }",
)
replace_once(
    "src/game/domain/types.ts",
    "  | { kind: 'auction'; businessId: string; title: string; currentBid: number; marketValue: number; minimumStep: number; inspected: boolean; issue?: BusinessIssue; issueRevealed?: boolean; botCeilings: number[]; leadingBot: number | null }",
    "  | { kind: 'auction'; businessId: string; title: string; currentBid: number; marketValue: number; minimumStep: number; inspected: boolean; issue?: BusinessIssue; issueRevealed?: boolean; botCeilings: number[]; botActive?: boolean[]; botDropChances?: number[]; bidRound?: number; lastAuctionNote?: string; leadingBot: number | null }",
)

# Auction entrants are random before bidding and each has a different willingness to leave.
replace_once(
    "src/game/engine/engine.ts",
    """  if (type === 'auction') {
    const unlocked = businesses.filter((item) => item.requiredLevel <= playerLevel(player))
    const business = pickFresh(state, 'business', unlocked, (item) => item.id, () => random(state), 4)
    const marketValue = business.price
    const minimumStep = Math.max(10_000, Math.round(marketValue * 0.05 / 10_000) * 10_000)
    return {
      kind: 'auction', businessId: business.id, title: business.name,
      currentBid: Math.round(marketValue * 0.65 / 10_000) * 10_000,
      marketValue, minimumStep, inspected: false,
      issue: rollIssue(state, business.riskRating, 0.08), issueRevealed: false,
      botCeilings: state.players.slice(1).map((bot) => Math.round(marketValue * (0.76 + random(state) * (bot.botStrategy === 'aggressive' ? 0.38 : bot.botStrategy === 'careful' ? 0.2 : 0.29)) / 10_000) * 10_000),
      leadingBot: null,
    }
  }""",
    """  if (type === 'auction') {
    const unlocked = businesses.filter((item) => item.requiredLevel <= playerLevel(player))
    const business = pickFresh(state, 'business', unlocked, (item) => item.id, () => random(state), 4)
    const marketValue = business.price
    const minimumStep = Math.max(10_000, Math.round(marketValue * 0.05 / 10_000) * 10_000)
    const botCeilings: number[] = []
    const botActive: boolean[] = []
    const botDropChances: number[] = []
    for (const bot of state.players.slice(1)) {
      const joinChance = bot.botStrategy === 'aggressive' ? 0.78 : bot.botStrategy === 'careful' ? 0.38 : 0.58
      const reserve = bot.baseExpenses * (bot.botStrategy === 'careful' ? 1.4 : 0.55)
      const canAffordToCompete = bot.cash >= reserve + marketValue * 0.08
      const joined = bot.status === 'active' && random(state) < joinChance * (canAffordToCompete ? 1 : 0.45)
      botActive.push(joined)
      botDropChances.push(bot.botStrategy === 'aggressive' ? 0.12 + random(state) * 0.12 : bot.botStrategy === 'careful' ? 0.34 + random(state) * 0.2 : 0.22 + random(state) * 0.16)
      botCeilings.push(joined
        ? Math.round(marketValue * (0.76 + random(state) * (bot.botStrategy === 'aggressive' ? 0.38 : bot.botStrategy === 'careful' ? 0.2 : 0.29)) / 10_000) * 10_000
        : 0)
    }
    const joinedCount = botActive.filter(Boolean).length
    return {
      kind: 'auction', businessId: business.id, title: business.name,
      currentBid: Math.round(marketValue * 0.65 / 10_000) * 10_000,
      marketValue, minimumStep, inspected: false,
      issue: rollIssue(state, business.riskRating, 0.08), issueRevealed: false,
      botCeilings, botActive, botDropChances, bidRound: 0,
      lastAuctionNote: joinedCount > 0 ? `В торги вошли соперники: ${joinedCount}. Они могут выйти на любой ставке.` : 'Соперники пока не вошли в торги. Объект можно забрать по стартовой цене.',
      leadingBot: null,
    }
  }""",
)
replace_once(
    "src/game/engine/engine.ts",
    """      return {
        kind: 'opportunity', opportunityId: deal.id, businessId: business.id,
        askingPrice, originalAskingPrice: askingPrice, title: deal.title, description: deal.description,
        inspection: 'none', hiddenIssue: rollIssue(state, business.riskRating, deal.issueChance * 0.45), issueRevealed: false, profile, revealedFacts: [],
      }""",
    """      return {
        kind: 'opportunity', opportunityId: deal.id, businessId: business.id,
        askingPrice, originalAskingPrice: askingPrice, title: deal.title, description: deal.description, negotiated: false,
        inspection: 'none', hiddenIssue: rollIssue(state, business.riskRating, deal.issueChance * 0.45), issueRevealed: false, profile, revealedFacts: [],
      }""",
)

# The same negotiation system now works for rare opportunities, with a higher chance to lose them.
replace_once(
    "src/game/engine/engine.ts",
    """  if (command.type === 'NEGOTIATE_BUSINESS') {
    if (decision.kind !== 'business') return reject(current, 'Сейчас нет сделки для торга')
    if (decision.negotiated) return reject(current, 'Ты уже сделал предложение')
    const settings = difficultySettings[state.difficulty]
    const boldnessPenalty = command.offerPercent === 0.85 ? 0.28 : command.offerPercent === 0.9 ? 0.13 : 0
    const successChance = settings.negotiationChance + skillLevel(player, 'negotiation') * 0.07 + negotiationSpecializationBonus(player) - boldnessPenalty
    const success = random(state) < successChance
    decision.negotiated = true
    if (success) {
      decision.askingPrice = Math.round(decision.askingPrice * command.offerPercent)
      decision.negotiationNote = `Продавец согласился на скидку ${Math.round((1 - command.offerPercent) * 100)}%`
      addEvent(state, 'Торг удался', decision.negotiationNote, 'good')
      awardProgress(state, player, 24, 'negotiation', 14)
      return { state, accepted: true }
    }
    const dealLost = random(state) < (command.offerPercent === 0.85 ? 0.34 : command.offerPercent === 0.9 ? 0.16 : 0.05)
    if (dealLost) {
      addEvent(state, 'Сделка сорвалась', 'Продавец отказался продолжать переговоры.', 'bad')
      completeHumanTurn(state)
    } else {
      decision.sellerCounter = createSellerCounter(decision.askingPrice, command.offerPercent, skillLevel(player, 'negotiation'), () => random(state))
      decision.negotiationNote = 'Продавец сделал встречное предложение: можно принять цену или оставить исходную цену с дополнительным условием.'
      addEvent(state, 'Контроффер продавца', decision.negotiationNote, 'neutral')
    }
    return { state, accepted: true }
  }""",
    """  if (command.type === 'NEGOTIATE_BUSINESS') {
    if (decision.kind !== 'business' && decision.kind !== 'opportunity') return reject(current, 'Сейчас нет сделки для торга')
    if (decision.negotiated) return reject(current, 'Ты уже сделал предложение')
    const settings = difficultySettings[state.difficulty]
    const rareOpportunityPenalty = decision.kind === 'opportunity' ? 0.08 : 0
    const boldnessPenalty = command.offerPercent === 0.85 ? 0.28 : command.offerPercent === 0.9 ? 0.13 : 0
    const successChance = settings.negotiationChance + skillLevel(player, 'negotiation') * 0.07 + negotiationSpecializationBonus(player) - boldnessPenalty - rareOpportunityPenalty
    const success = random(state) < successChance
    decision.negotiated = true
    if (success) {
      decision.askingPrice = Math.round(decision.askingPrice * command.offerPercent)
      decision.negotiationNote = `Продавец согласился на скидку ${Math.round((1 - command.offerPercent) * 100)}%`
      addEvent(state, decision.kind === 'opportunity' ? 'Торг по редкой возможности удался' : 'Торг удался', decision.negotiationNote, 'good')
      awardProgress(state, player, decision.kind === 'opportunity' ? 32 : 24, 'negotiation', decision.kind === 'opportunity' ? 18 : 14)
      return { state, accepted: true }
    }
    const baseLossChance = command.offerPercent === 0.85 ? 0.34 : command.offerPercent === 0.9 ? 0.16 : 0.05
    const dealLost = random(state) < Math.min(0.78, baseLossChance + (decision.kind === 'opportunity' ? 0.14 : 0))
    if (dealLost) {
      addEvent(state, 'Сделка сорвалась', decision.kind === 'opportunity' ? 'Редкая возможность ушла другому покупателю после слишком жёсткого торга.' : 'Продавец отказался продолжать переговоры.', 'bad')
      completeHumanTurn(state)
    } else {
      decision.sellerCounter = createSellerCounter(decision.askingPrice, command.offerPercent, skillLevel(player, 'negotiation'), () => random(state))
      decision.negotiationNote = 'Продавец сделал встречное предложение: можно принять цену или оставить исходную цену с дополнительным условием.'
      addEvent(state, 'Контроффер продавца', decision.negotiationNote, 'neutral')
    }
    return { state, accepted: true }
  }""",
)

# A buyer accepting the player's counteroffer no longer sells immediately.
replace_once(
    "src/game/engine/v14Core.ts",
    """  if (result.kind === 'accepted') {
    sellAssetAtPrice(state, player, asset.id, result.price, 'Покупатель принял контроффер')
    return accepted()
  }""",
    """  if (result.kind === 'accepted') {
    offer.offeredPrice = result.price
    offer.round = 2
    offer.final = true
    offer.sellerApprovalRequired = true
    pushSystemEvent(state, 'Покупатель принял твой контроффер', `${asset.name}: покупатель согласен на ${result.price.toLocaleString('ru-RU')} ₽. Сделка не закрыта — подтверди продажу.`, 'good')
    return accepted()
  }""",
)
replace_once(
    "src/game/engine/v14Core.ts",
    """  offer.offeredPrice = result.price
  offer.round = 2
  offer.final = true
  pushSystemEvent(state, 'Финальное предложение покупателя', `${asset.name}: ${result.price.toLocaleString('ru-RU')} ₽.`, 'neutral')""",
    """  offer.offeredPrice = result.price
  offer.round = 2
  offer.final = true
  offer.sellerApprovalRequired = false
  pushSystemEvent(state, 'Финальное предложение покупателя', `${asset.name}: ${result.price.toLocaleString('ru-RU')} ₽.`, 'neutral')""",
)

# Auction bots may stay out, quit on any round or raise by a random number of steps.
replace_once(
    "src/game/engine/v14Core.ts",
    """  if (command.type === 'AUCTION_BID' && decision.kind === 'auction') {
    if (command.amount < decision.currentBid + decision.minimumStep) return rejected('Ставка слишком мала')
    const highestBot = Math.max(0, ...decision.botCeilings)
    if (command.amount > highestBot) {
      state.pendingDecision = { kind: 'business', businessId: decision.businessId, askingPrice: command.amount, negotiated: true, negotiationNote: 'Победа на аукционе', inspection: decision.inspected ? 'basic' : 'none', hiddenIssue: decision.issue, issueRevealed: decision.issueRevealed }
      pushSystemEvent(state, 'Ты выиграл аукцион', `Финальная цена ${command.amount.toLocaleString('ru-RU')} ₽. Теперь собери финансирование.`, 'good')
      return accepted()
    }
    const eligible = decision.botCeilings.map((ceiling, index) => ({ ceiling, index })).filter((item) => item.ceiling >= command.amount + decision.minimumStep)
    const bot = eligible[Math.floor(random() * eligible.length)] ?? { ceiling: highestBot, index: decision.botCeilings.indexOf(highestBot) }
    decision.currentBid = Math.min(bot.ceiling, command.amount + decision.minimumStep)
    decision.leadingBot = bot.index
    pushSystemEvent(state, 'Соперник перебил ставку', `Новая цена ${decision.currentBid.toLocaleString('ru-RU')} ₽.`, 'neutral')
    return accepted()
  }""",
    """  if (command.type === 'AUCTION_BID' && decision.kind === 'auction') {
    const active = [...(decision.botActive ?? decision.botCeilings.map((ceiling) => ceiling > 0))]
    const dropChances = decision.botDropChances ?? decision.botCeilings.map(() => 0.24)
    const activeBeforeBid = active.some(Boolean)
    const minimumAllowed = activeBeforeBid ? decision.currentBid + decision.minimumStep : decision.currentBid
    if (command.amount < minimumAllowed) return rejected('Ставка слишком мала')

    const round = (decision.bidRound ?? 0) + 1
    decision.bidRound = round
    const dropped: number[] = []
    for (let index = 0; index < active.length; index += 1) {
      if (!active[index]) continue
      const ceiling = decision.botCeilings[index] ?? 0
      if (ceiling < command.amount + decision.minimumStep) {
        active[index] = false
        dropped.push(index)
        continue
      }
      const pressure = command.amount / Math.max(1, ceiling)
      const exitChance = Math.min(0.9, (dropChances[index] ?? 0.24) + Math.max(0, pressure - 0.62) * 0.72 + Math.max(0, round - 1) * 0.06)
      if (random() < exitChance) {
        active[index] = false
        dropped.push(index)
      }
    }
    decision.botActive = active

    const eligible = decision.botCeilings
      .map((ceiling, index) => ({ ceiling, index }))
      .filter((item) => active[item.index] && item.ceiling >= command.amount + decision.minimumStep)

    if (eligible.length === 0) {
      state.pendingDecision = { kind: 'business', businessId: decision.businessId, askingPrice: command.amount, negotiated: true, negotiationNote: 'Победа на аукционе', inspection: decision.inspected ? 'basic' : 'none', hiddenIssue: decision.issue, issueRevealed: decision.issueRevealed }
      const exitNote = activeBeforeBid ? (dropped.length > 0 ? 'Соперники вышли после твоей ставки.' : 'Никто не перебил твою ставку.') : 'Ни один соперник не вошёл в торги.'
      pushSystemEvent(state, 'Ты выиграл аукцион', `${exitNote} Финальная цена ${command.amount.toLocaleString('ru-RU')} ₽. Теперь собери финансирование.`, 'good')
      return accepted()
    }

    const selected = eligible[Math.floor(random() * eligible.length)]
    const botPlayer = state.players[selected.index + 1]
    const maxSteps = botPlayer?.botStrategy === 'aggressive' ? 3 : botPlayer?.botStrategy === 'careful' ? 2 : 2
    const requestedSteps = 1 + Math.floor(random() * maxSteps)
    const maximumSteps = Math.max(1, Math.floor((selected.ceiling - command.amount) / decision.minimumStep))
    const steps = Math.min(requestedSteps, maximumSteps)
    decision.currentBid = command.amount + decision.minimumStep * steps
    decision.leadingBot = selected.index
    const droppedNames = dropped.map((index) => state.players[index + 1]?.name).filter(Boolean)
    decision.lastAuctionNote = `${botPlayer?.name ?? 'Соперник'} поднял ставку на ${steps} ${steps === 1 ? 'шаг' : 'шага'}${droppedNames.length ? `. Вышли: ${droppedNames.join(', ')}` : ''}.`
    pushSystemEvent(state, 'Соперник перебил ставку', `${decision.lastAuctionNote} Новая цена ${decision.currentBid.toLocaleString('ru-RU')} ₽.`, 'neutral')
    return accepted()
  }""",
)

# Speculators can be pessimistic, neutral or unusually optimistic.
replace_once(
    "src/game/systems/v15.ts",
    """  if (archetype === 'urgent') return 0.89 + random() * 0.08
  return 0.84 + random() * 0.11""",
    """  if (archetype === 'urgent') return 0.89 + random() * 0.08
  const mood = random()
  if (mood < 0.22) return 1.02 + random() * 0.1
  if (mood < 0.66) return 0.93 + random() * 0.1
  return 0.84 + random() * 0.1""",
)

# A speculative offer can be slightly above the listing and all first-round offers remain negotiable.
replace_once(
    "src/game/systems/v14.ts",
    """    const archetypePrice = Math.round(marketValue * buyerOfferMultiplier(asset, archetype, random))
    const offeredPrice = acceptsAsking ? asset.listingPrice : Math.min(asset.listingPrice, archetypePrice)""",
    """    const archetypePrice = Math.round(marketValue * buyerOfferMultiplier(asset, archetype, random))
    const offerCap = archetype === 'speculator' ? Math.round(asset.listingPrice * 1.08) : asset.listingPrice
    const offeredPrice = acceptsAsking ? asset.listingPrice : Math.min(offerCap, archetypePrice)""",
)
replace_once(
    "src/game/systems/v14.ts",
    """  const requestedPremium = requestedPrice / Math.max(1, offer.marketValue) - 1
  const jump = requestedPrice / Math.max(1, offer.offeredPrice) - 1
  const acceptanceChance = Math.max(0.07, Math.min(0.94, 0.68 + negotiationLevel * 0.06 + specializationBonus - requestedPremium * 1.55 - jump * 1.8))""",
    """  const requestedPremium = requestedPrice / Math.max(1, offer.marketValue) - 1
  const jump = requestedPrice / Math.max(1, offer.offeredPrice) - 1
  const temperament = offer.archetype === 'strategic' ? 0.08 : offer.archetype === 'management' ? 0.03 : offer.archetype === 'urgent' ? -0.02 : offer.archetype === 'speculator' ? -0.07 : 0
  const acceptanceChance = Math.max(0.07, Math.min(0.94, 0.68 + negotiationLevel * 0.06 + specializationBonus + temperament - requestedPremium * 1.55 - jump * 1.8))""",
)
replace_once(
    "src/game/systems/v14.ts",
    """  const floor = Math.max(offer.offeredPrice, Math.round(offer.marketValue * 0.9))
  const ceiling = Math.min(requestedPrice, offer.askingPrice)
  const counter = Math.round(floor + (ceiling - floor) * (0.28 + random() * 0.34))""",
    """  const floor = Math.max(offer.offeredPrice, Math.round(offer.marketValue * 0.9))
  const ceiling = Math.max(floor, Math.min(requestedPrice, Math.max(offer.askingPrice, Math.round(offer.offeredPrice * 1.08))))
  const counter = Math.round(floor + (ceiling - floor) * (0.28 + random() * 0.34))""",
)

# Buyer modal explicitly requires seller approval after a counteroffer is accepted.
replace_once(
    "src/V14UI.tsx",
    """    <div className=\"sheet-handle\"/><span className=\"eyebrow\">ПОКУПАТЕЛЬ НАШЁЛСЯ</span><h2>{offer.buyerName} предлагает сделку</h2>{offer.archetype && <span className=\"v15-buyer-archetype\">{buyerArchetypeLabel[offer.archetype]}</span>}""",
    """    <div className=\"sheet-handle\"/><span className=\"eyebrow\">{offer.sellerApprovalRequired ? 'ПОКУПАТЕЛЬ СОГЛАСИЛСЯ' : 'ПОКУПАТЕЛЬ НАШЁЛСЯ'}</span><h2>{offer.sellerApprovalRequired ? 'Подтверди финальную продажу' : `${offer.buyerName} предлагает сделку`}</h2>{offer.archetype && <span className=\"v15-buyer-archetype\">{buyerArchetypeLabel[offer.archetype]}</span>}""",
)
replace_once(
    "src/V14UI.tsx",
    """    {offer.final && <div className=\"v14-warning\"><b>Это финальная цена покупателя</b><span>Следующий контроффер он уже не рассматривает.</span></div>}
    <button className=\"primary-action\" onClick={() => dispatch({ type: 'RESPOND_BUYER_OFFER', offerId: offer.id, action: 'accept' })}>Принять {money(offer.offeredPrice)} <span>→</span></button>""",
    """    {offer.sellerApprovalRequired
      ? <div className=\"v14-info\"><b>Покупатель принял твою повышенную цену</b><span>Актив ещё не продан. Деньги и бизнес изменятся только после твоего подтверждения.</span></div>
      : offer.final && <div className=\"v14-warning\"><b>Это финальная цена покупателя</b><span>Следующий контроффер он уже не рассматривает.</span></div>}
    {offer.archetype === 'speculator' && !offer.final && <div className=\"v16-return-note\">Спекулянт может торговаться жёстко, но иногда готов платить выше рынка или твоей цены объявления.</div>}
    <button className=\"primary-action\" onClick={() => dispatch({ type: 'RESPOND_BUYER_OFFER', offerId: offer.id, action: 'accept' })}>{offer.sellerApprovalRequired ? 'Подтвердить продажу' : 'Принять'} {money(offer.offeredPrice)} <span>→</span></button>""",
)

# Auction UI reflects actual entrants and can award the opening price when nobody joined.
replace_once(
    "src/V14UI.tsx",
    """  const player = game.players[0]
  if (decision.kind === 'market') return <MarketDecision />""",
    """  const player = game.players[0]
  const activeAuctionBots = decision.kind === 'auction'
    ? (decision.botActive ?? decision.botCeilings.map((ceiling) => ceiling > 0)).filter(Boolean).length
    : 0
  if (decision.kind === 'market') return <MarketDecision />""",
)
replace_once(
    "src/V14UI.tsx",
    """  if (decision.kind === 'auction') return <><div className=\"decision-symbol good-bg\">🔨</div><span className=\"eyebrow\">АУКЦИОН С СОПЕРНИКАМИ</span><h2>{decision.title}</h2><div className=\"v14-summary-grid\"><span>Рыночная стоимость <b>{money(decision.marketValue)}</b></span><span>Текущая ставка <b>{money(decision.currentBid)}</b></span></div>{decision.issueRevealed && <div className={decision.issue && decision.issue !== 'none' ? 'v14-warning' : 'v14-info'}><b>{decision.issue && decision.issue !== 'none' ? 'Проверка нашла риск' : 'Документы чистые'}</b></div>}<div className=\"v14-action-list\"><button disabled={decision.inspected || player.cash < Math.max(12_000, decision.marketValue * .015)} onClick={() => dispatch({ type: 'AUCTION_INSPECT' })}><b>Проверить документы</b><small>{money(Math.max(12_000, decision.marketValue * .015))}</small></button><button onClick={() => dispatch({ type: 'AUCTION_BID', amount: decision.currentBid + decision.minimumStep })}><b>Поднять до {money(decision.currentBid + decision.minimumStep)}</b><small>Боты могут перебить ставку</small></button></div><button className=\"ghost-action\" onClick={() => dispatch({ type: 'AUCTION_WITHDRAW' })}>Выйти из аукциона</button></>""",
    """  if (decision.kind === 'auction') {
    const nextBid = activeAuctionBots > 0 ? decision.currentBid + decision.minimumStep : decision.currentBid
    return <><div className=\"decision-symbol good-bg\">🔨</div><span className=\"eyebrow\">ЖИВОЙ АУКЦИОН</span><h2>{decision.title}</h2><div className=\"v14-summary-grid\"><span>Рыночная стоимость <b>{money(decision.marketValue)}</b></span><span>Текущая ставка <b>{money(decision.currentBid)}</b></span><span>Активных соперников <b>{activeAuctionBots}</b></span><span>Раунд торгов <b>{decision.bidRound ?? 0}</b></span></div>{decision.lastAuctionNote && <div className=\"v16-return-note\">{decision.lastAuctionNote}</div>}{decision.issueRevealed && <div className={decision.issue && decision.issue !== 'none' ? 'v14-warning' : 'v14-info'}><b>{decision.issue && decision.issue !== 'none' ? 'Проверка нашла риск' : 'Документы чистые'}</b></div>}<div className=\"v14-action-list\"><button disabled={decision.inspected || player.cash < Math.max(12_000, decision.marketValue * .015)} onClick={() => dispatch({ type: 'AUCTION_INSPECT' })}><b>Проверить документы</b><small>{money(Math.max(12_000, decision.marketValue * .015))}</small></button><button onClick={() => dispatch({ type: 'AUCTION_BID', amount: nextBid })}><b>{activeAuctionBots > 0 ? `Поднять до ${money(nextBid)}` : `Забрать за ${money(nextBid)}`}</b><small>{activeAuctionBots > 0 ? 'Любой бот может выйти сейчас или продолжить; ответная ставка тоже случайная.' : 'Никто не вошёл в торги — доплачивать шаг не нужно.'}</small></button></div><button className=\"ghost-action\" onClick={() => dispatch({ type: 'AUCTION_WITHDRAW' })}>Выйти из аукциона</button></>
  }""",
)

# Rare opportunities expose the same negotiation controls and their extra risk.
replace_once(
    "src/App.tsx",
    """      {decision.kind === 'business' && !decision.negotiated && <div className=\"negotiation\"><div><b>Попробовать торг</b><small>Чем ниже цена, тем выше шанс потерять сделку</small></div><div><button onClick={() => dispatch({ type: 'NEGOTIATE_BUSINESS', offerPercent: 0.95 })}>−5%</button><button onClick={() => dispatch({ type: 'NEGOTIATE_BUSINESS', offerPercent: 0.9 })}>−10%</button><button onClick={() => dispatch({ type: 'NEGOTIATE_BUSINESS', offerPercent: 0.85 })}>−15%</button></div></div>}
      {decision.kind === 'business' && decision.negotiationNote && <div className=\"negotiation-note\">{decision.negotiationNote}</div>}""",
    """      {!decision.negotiated && <div className=\"negotiation\"><div><b>{decision.kind === 'opportunity' ? 'Торг по редкой возможности' : 'Попробовать торг'}</b><small>{decision.kind === 'opportunity' ? 'Скидку получить можно, но редкий продавец быстрее отдаст объект другому.' : 'Чем ниже цена, тем выше шанс потерять сделку'}</small></div><div><button onClick={() => dispatch({ type: 'NEGOTIATE_BUSINESS', offerPercent: 0.95 })}>−5%</button><button onClick={() => dispatch({ type: 'NEGOTIATE_BUSINESS', offerPercent: 0.9 })}>−10%</button><button onClick={() => dispatch({ type: 'NEGOTIATE_BUSINESS', offerPercent: 0.85 })}>−15%</button></div></div>}
      {decision.negotiationNote && <div className=\"negotiation-note\">{decision.negotiationNote}</div>}""",
)

# Focused regression tests for all requested behaviour.
Path("src/game/engine/v18-live-negotiation.test.ts").write_text(r'''import { describe, expect, it } from 'vitest'
import { businesses } from '../content/content'
import type { Asset, BuyerOffer, Decision } from '../domain/types'
import { loanPayment } from '../systems/economy'
import { buyerOfferMultiplier } from '../systems/v15'
import { emptyGame, executeCommand } from './engine'
import { handleDecisionV14Command, handleReadyV14Command } from './v14Core'

const startedGame = () => executeCommand(emptyGame(818), {
  type: 'START_GAME', professionId: 'trainer', botCount: 2, difficulty: 'normal', seed: 818,
}).state

const testAsset = (): Asset => {
  const business = businesses.find((item) => item.id === 'vending')!
  return {
    ...business,
    id: 'asset-v18', ownerId: 'human', ownership: 1,
    monthlyPayment: loanPayment(business.loan, business.loanRate, business.loanTermMonths),
    purchaseMonth: 1, developmentLevel: 0, developments: [], totalDevelopmentCost: 0,
    lastDevelopedMonth: null, saleOffer: null, offerExpiresMonth: null, status: 'active',
    dueDiligence: 'none', launchMonthsRemaining: 0, incidentCooldown: 0,
    issueMonths: 0, missedPayments: 0, listingPrice: 150_000,
    listingStartedMonth: 1, listingExpiresMonth: 4,
  }
}

const auctionDecision = (overrides: Partial<Extract<Decision, { kind: 'auction' }>> = {}): Extract<Decision, { kind: 'auction' }> => ({
  kind: 'auction', businessId: 'vending', title: 'Тестовый аукцион', currentBid: 100_000,
  marketValue: 200_000, minimumStep: 10_000, inspected: false, issue: 'none', issueRevealed: false,
  botCeilings: [180_000, 0], botActive: [true, false], botDropChances: [0.2, 0.2],
  bidRound: 0, leadingBot: null, ...overrides,
})

describe('balance v1.8 live negotiation', () => {
  it('awards the opening bid when no bot enters the auction', () => {
    const game = startedGame()
    game.phase = 'decision'
    game.pendingDecision = auctionDecision({ botCeilings: [0, 0], botActive: [false, false] })

    const result = handleDecisionV14Command(game, { type: 'AUCTION_BID', amount: 100_000 }, () => 0.5)

    expect(result.accepted).toBe(true)
    expect(game.pendingDecision?.kind).toBe('business')
    expect(game.pendingDecision?.kind === 'business' && game.pendingDecision.askingPrice).toBe(100_000)
  })

  it('allows a bot to quit immediately after the first raise', () => {
    const game = startedGame()
    game.phase = 'decision'
    game.pendingDecision = auctionDecision({ botDropChances: [0.9, 0.2] })

    const result = handleDecisionV14Command(game, { type: 'AUCTION_BID', amount: 110_000 }, () => 0.1)

    expect(result.accepted).toBe(true)
    expect(game.pendingDecision?.kind).toBe('business')
    expect(game.pendingDecision?.kind === 'business' && game.pendingDecision.askingPrice).toBe(110_000)
  })

  it('lets an aggressive bot make a random multi-step raise', () => {
    const game = startedGame()
    game.players[1].botStrategy = 'aggressive'
    game.phase = 'decision'
    game.pendingDecision = auctionDecision({ botDropChances: [0, 0.2] })
    const values = [0.99, 0, 0.99]

    const result = handleDecisionV14Command(game, { type: 'AUCTION_BID', amount: 110_000 }, () => values.shift() ?? 0.5)

    expect(result.accepted).toBe(true)
    expect(game.pendingDecision?.kind).toBe('auction')
    expect(game.pendingDecision?.kind === 'auction' && game.pendingDecision.currentBid).toBe(140_000)
  })

  it('gives speculators both low and above-market moods', () => {
    const asset = testAsset()
    const highValues = [0.1, 0.5]
    const lowValues = [0.9, 0.5]
    const high = buyerOfferMultiplier(asset, 'speculator', () => highValues.shift() ?? 0.5)
    const low = buyerOfferMultiplier(asset, 'speculator', () => lowValues.shift() ?? 0.5)
    expect(high).toBeGreaterThan(1)
    expect(low).toBeLessThan(1)
  })

  it('keeps the business until the player confirms an accepted counteroffer', () => {
    const game = startedGame()
    const asset = testAsset()
    game.players[0].assets = [asset]
    const offer: BuyerOffer = {
      id: 'offer-v18', assetId: asset.id, buyerName: 'Спекулянт', askingPrice: 150_000,
      offeredPrice: 120_000, marketValue: 140_000, round: 1, final: false, expiresMonth: 1,
      archetype: 'speculator',
    }
    game.buyerOffers = [offer]

    const counter = handleReadyV14Command(game, { type: 'RESPOND_BUYER_OFFER', offerId: offer.id, action: 'counter5' }, () => 0)
    expect(counter.accepted).toBe(true)
    expect(game.players[0].assets).toHaveLength(1)
    expect(game.buyerOffers[0].sellerApprovalRequired).toBe(true)

    const confirm = handleReadyV14Command(game, { type: 'RESPOND_BUYER_OFFER', offerId: offer.id, action: 'accept' }, () => 0)
    expect(confirm.accepted).toBe(true)
    expect(game.players[0].assets).toHaveLength(0)
  })

  it('allows negotiation on a rare opportunity', () => {
    const game = startedGame()
    game.difficulty = 'easy'
    game.players[0].skills.negotiation = 3
    game.phase = 'decision'
    game.pendingDecision = {
      kind: 'opportunity', opportunityId: 'rare-test', businessId: 'vending',
      askingPrice: 200_000, originalAskingPrice: 200_000, title: 'Редкая точка', description: 'Тест',
      negotiated: false, inspection: 'none', hiddenIssue: 'none', issueRevealed: false,
    }

    const result = executeCommand(game, { type: 'NEGOTIATE_BUSINESS', offerPercent: 0.95 })

    expect(result.accepted).toBe(true)
    expect(result.state.pendingDecision?.kind).toBe('opportunity')
    expect(result.state.pendingDecision?.kind === 'opportunity' && result.state.pendingDecision.negotiated).toBe(true)
    expect(result.state.pendingDecision?.kind === 'opportunity' && result.state.pendingDecision.askingPrice).toBe(190_000)
  })
})
''')
