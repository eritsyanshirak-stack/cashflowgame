from pathlib import Path

path = Path('src/game/domain/types.ts')
text = path.read_text()
old = 'export interface GameState {\n  version: 11'
new = 'export interface GameState {\n  version: 12'
if old not in text:
    raise SystemExit('GameState version pattern not found')
path.write_text(text.replace(old, new, 1))
