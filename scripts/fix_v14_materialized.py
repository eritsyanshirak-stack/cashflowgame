from pathlib import Path

engine = Path('src/game/engine/engine.ts')
text = engine.read_text()
text = text.replace(
    "import { board, businesses, chanceCards, developments, difficultySettings, expenseScenarios, initialStockMarket, marketHeadlines, professions, rareDeals } from '../content/content'",
    "import { board, businesses, chanceCards, developments, difficultySettings, expenseCards, expenseScenarios, initialStockMarket, marketHeadlines, professions, rareDeals } from '../content/content'",
)
engine.write_text(text)
