import { z } from 'zod'
import type { GameState } from '../domain/types'

const saveSchema = z.object({
  version: z.literal(2),
  seed: z.number().int().nonnegative(),
  phase: z.enum(['setup', 'ready', 'decision', 'victory']),
  day: z.number().int().min(1).max(30),
  month: z.number().int().min(1),
  round: z.number().int().nonnegative(),
  currentPlayerIndex: z.number().int().nonnegative(),
  lastRoll: z.number().int().min(1).max(6).nullable(),
  players: z.array(z.object({
    id: z.string(), name: z.string(), isBot: z.boolean(), professionId: z.string(),
    position: z.number().int().nonnegative(), cash: z.number(), salary: z.number(),
    baseExpenses: z.number(), baseDebt: z.number(), assets: z.array(z.unknown()),
    loans: z.array(z.unknown()), deposit: z.number(), bonds: z.number(),
  })).min(1),
  pendingDecision: z.unknown().nullable(),
  events: z.array(z.unknown()),
  lastMonthlyReport: z.object({
    month: z.number().int().min(1), startingCash: z.number(), salary: z.number(),
    assetRevenue: z.number(), depositIncome: z.number(), bondIncome: z.number(),
    livingExpenses: z.number(), operatingCosts: z.number(), assetDebtPayments: z.number(),
    loanPayments: z.number(), netCashflow: z.number(), endingCash: z.number(),
  }).nullable().optional(),
})

export const SAVE_KEY = 'vyhod-iz-kruga-save-v2'

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
export const hasSave = () => Boolean(localStorage.getItem(SAVE_KEY))
