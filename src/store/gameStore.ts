import { create } from 'zustand'
import type { GameState } from '../game/domain/types'
import { emptyGame, executeCommand, type PatchedGameCommand } from '../game/engine/patchedEngine'
import { clearSave, loadGame, saveGame } from '../game/persistence/save'

interface GameStore {
  game: GameState
  error: string | null
  dispatch: (command: PatchedGameCommand) => boolean
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
