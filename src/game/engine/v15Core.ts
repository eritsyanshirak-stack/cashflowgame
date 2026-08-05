import type { GameCommand, GameState } from '../domain/types'
import { pushSystemEvent } from '../systems/v14'
import { playerLevel } from '../systems/progression'
import {
  buyerNegotiationSpecializationBonus,
  refreshPortfolioSynergies,
  specializationNames,
} from '../systems/v15'

export interface V15CommandResult {
  handled: boolean
  accepted: boolean
  completeTurn?: boolean
  error?: string
}

const rejected = (error: string): V15CommandResult => ({ handled: true, accepted: false, error })
const accepted = (completeTurn = false): V15CommandResult => ({ handled: true, accepted: true, completeTurn })

export const handleReadyV15Command = (state: GameState, command: GameCommand): V15CommandResult => {
  const player = state.players[0]
  if (command.type !== 'CHOOSE_SPECIALIZATION') return { handled: false, accepted: false }
  if (player.specialization) return rejected('Специализация уже выбрана')
  if (playerLevel(player) < 3) return rejected('Специализация открывается на третьем уровне')

  player.specialization = command.specialization
  if (command.specialization === 'entrepreneur') {
    player.salary = 0
    player.jobActive = false
  }
  refreshPortfolioSynergies(player)
  pushSystemEvent(
    state,
    'Выбрана специализация',
    `${specializationNames[command.specialization]} меняет стратегию этой партии.`,
    'good',
  )
  return accepted()
}

export const handleDecisionV15Command = (state: GameState, command: GameCommand): V15CommandResult => {
  const decision = state.pendingDecision
  if (!decision || (decision.kind !== 'business' && decision.kind !== 'opportunity')) {
    return { handled: false, accepted: false }
  }
  if (command.type !== 'RESPOND_SELLER_COUNTER') return { handled: false, accepted: false }
  if (!decision.sellerCounter) return rejected('Контроффер продавца уже недоступен')

  if (command.action === 'acceptPrice') {
    decision.askingPrice = decision.sellerCounter.price
    decision.negotiationNote = `Принят контроффер продавца: ${decision.askingPrice.toLocaleString('ru-RU')} ₽.`
    decision.sellerCounter = undefined
    pushSystemEvent(state, 'Контроффер принят', decision.negotiationNote, 'good')
    return accepted()
  }

  if (command.action === 'acceptTerm') {
    decision.askingPrice = decision.originalAskingPrice ?? decision.askingPrice
    decision.sellerTerm = decision.sellerCounter.term
    decision.negotiationNote = decision.sellerCounter.note
    decision.sellerCounter = undefined
    pushSystemEvent(state, 'Согласованы условия вместо скидки', decision.negotiationNote, 'good')
    return accepted()
  }

  decision.askingPrice = decision.originalAskingPrice ?? decision.askingPrice
  decision.negotiationNote = 'Ты отказался от контроффера. Сделка остаётся доступна по исходной цене.'
  decision.sellerCounter = undefined
  pushSystemEvent(state, 'Контроффер отклонён', decision.negotiationNote, 'neutral')
  return accepted()
}

export const sellerNegotiationBonus = (state: GameState) =>
  buyerNegotiationSpecializationBonus(state.players[0])
