import { create } from 'zustand'
import type { GameCommand, GameState } from '../game/domain/types'
import { emptyGame, executeCommand } from '../game/engine/engine'
import { clearSave, loadGame, saveGame } from '../game/persistence/save'

interface GameStore {
  game: GameState
  error: string | null
  dispatch: (command: GameCommand) => boolean
  continueGame: () => boolean
  resetGame: () => void
}

export const useGameStore = create<GameStore>((set, get) => ({
  game: emptyGame(),
  error: null,
  dispatch: (command) => {
    const result = executeCommand(get().game, command)
    if (result.accepted) {
      saveGame(result.state)
      set({ game: result.state, error: null })
      return true
    }
    set({ error: result.error ?? 'Не удалось выполнить действие' })
    return false
  },
  continueGame: () => {
    const game = loadGame()
    if (!game) return false
    set({ game, error: null })
    return true
  },
  resetGame: () => {
    clearSave()
    set({ game: emptyGame(), error: null })
  },
}))
