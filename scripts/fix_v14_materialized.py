from pathlib import Path

engine = Path('src/game/engine/engine.ts')
text = engine.read_text()
text = text.replace(
    "import { board, businesses, chanceCards, developments, difficultySettings, expenseScenarios, initialStockMarket, marketHeadlines, professions, rareDeals } from '../content/content'",
    "import { board, businesses, chanceCards, developments, difficultySettings, expenseCards, expenseScenarios, initialStockMarket, marketHeadlines, professions, rareDeals } from '../content/content'",
)
engine.write_text(text)

core = Path('src/game/engine/v14Core.ts')
text = core.read_text()
text = text.replace(
    "export const sellAssetShareForFunding = (state: GameState, player: Player, assetId: string, percent: 10 | 25 | 50) =>",
    "export const sellAssetShareForFunding = (state: GameState, _player: Player, assetId: string, percent: 10 | 25 | 50) =>",
)
core.write_text(text)
