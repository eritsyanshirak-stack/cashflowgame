import { z } from 'zod'
import type { GameState } from '../domain/types'

const saveSchema = z.object({
  version: z.literal(12),
  seed: z.number().int().nonnegative(),
  phase: z.enum(['setup', 'ready', 'decision', 'finished']),
  day: z.number().int().min(1).max(30),
  month: z.number().int().min(1),
  round: z.number().int().nonnegative(),
  currentPlayerIndex: z.number().int().nonnegative(),
  lastRoll: z.number().int().min(1).max(6).nullable(),
  players: z.array(z.object({
    id: z.string(), name: z.string(), isBot: z.boolean(), professionId: z.string(),
    position: z.number().int().nonnegative(), cash: z.number(), salary: z.number(),
    baseExpenses: z.number(), baseDebt: z.number(), assets: z.array(z.unknown()),
    loans: z.array(z.unknown()), deposit: z.number(), bonds: z.number(), stocks: z.array(z.unknown()), resaleDeals: z.array(z.unknown()), activeContracts: z.array(z.unknown()),
    experience: z.number().int().nonnegative(),
    skills: z.object({ negotiation: z.number().nonnegative(), marketing: z.number().nonnegative(), management: z.number().nonnegative(), finance: z.number().nonnegative(), brand: z.number().nonnegative() }),
    status: z.enum(['active', 'free', 'bankrupt']), eliminatedMonth: z.number().int().positive().nullable(),
    botStrategy: z.enum(['careful', 'balanced', 'aggressive']).optional(), freedomStreak: z.number().int().nonnegative().optional(), restructuringUsed: z.boolean().optional(),
    specialization: z.enum(['operator', 'negotiator', 'investor', 'entrepreneur']).optional(), jobActive: z.boolean().optional(), rivalIntent: z.string().optional(),
  })).min(1),
  pendingDecision: z.unknown().nullable(),
  events: z.array(z.unknown()),
  lastMonthlyReport: z.object({
    month: z.number().int().min(1), startingCash: z.number(), salary: z.number(),
    assetRevenue: z.number(), depositIncome: z.number(), bondIncome: z.number(), stockDividends: z.number(), resaleReturns: z.number(), contractReturns: z.number().optional(),
    livingExpenses: z.number(), operatingCosts: z.number(), assetDebtPayments: z.number(),
    loanPayments: z.number(), netCashflow: z.number(), endingCash: z.number(),
  }).nullable().optional(),
  difficulty: z.enum(['easy', 'normal', 'hard']),
  stockMarket: z.array(z.unknown()),
  marketHeadline: z.string(),
  globalEvent: z.unknown().nullable(),
  recentCards: z.object({ business: z.array(z.string()), expense: z.array(z.string()), chance: z.array(z.string()), contract: z.array(z.string()), global: z.array(z.string()) }),
  buyerOffers: z.array(z.unknown()),
  activeMarginCall: z.unknown().nullable(),
  eventChains: z.array(z.unknown()),
  outcome: z.object({ winnerId: z.string().nullable(), reason: z.enum(['freedom', 'human-bankrupt', 'last-solvent']) }).nullable(),
})

export const SAVE_KEY = 'vyhod-iz-kruga-save-v12-v17'

export const saveGame = (state: GameState) => localStorage.setItem(SAVE_KEY, JSON.stringify(state))

export const loadGame = (): GameState | null => {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const parsed = saveSchema.safeParse(JSON.parse(raw))
    return parsed.success ? { ...parsed.data, lastMonthlyReport: parsed.data.lastMonthlyReport ?? null } as GameState : null
  } catch {
    return null
  }
}

export const clearSave = () => localStorage.removeItem(SAVE_KEY)
export const hasSave = () => loadGame() !== null
