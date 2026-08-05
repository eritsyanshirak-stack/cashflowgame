from pathlib import Path

path = Path('src/game/persistence/save.ts')
text = path.read_text()
text = text.replace('version: z.literal(11)', 'version: z.literal(12)', 1)
text = text.replace("export const SAVE_KEY = 'vyhod-iz-kruga-save-v11-v16'", "export const SAVE_KEY = 'vyhod-iz-kruga-save-v12-v17'", 1)
path.write_text(text)
