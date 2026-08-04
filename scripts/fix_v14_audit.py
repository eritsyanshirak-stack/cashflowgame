from pathlib import Path


def replace_required(path: str, old: str, new: str, label: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise RuntimeError(f'Missing audit anchor: {label}')
    file.write_text(text.replace(old, new, 1))


replace_required(
    'src/game/engine/engine.test.ts',
    "expect(result.state.players[0].cash).toBe(300_000)",
    "expect(result.state.players[0].cash).toBe(266_400)",
    'quick sale engine test value',
)
replace_required(
    'src/game/engine/engine.test.ts',
    "expect(sale.state.players[0].cash).toBe(240_000)",
    "expect(sale.state.players[0].cash).toBe(233_700)",
    'secured quick sale proceeds',
)
replace_required(
    'src/game/engine/engine.test.ts',
    "expect(sale.state.players[0].loans[0]).toMatchObject({ balance: 20_000 })",
    "expect(sale.state.players[0].loans[0]).toMatchObject({ balance: 21_400 })",
    'distressed quick sale deficiency',
)

replace_required(
    'src/V14UI.tsx',
    "disabled={game.phase !== 'ready' || asset.ownership * 100 <= share}",
    "disabled={game.phase !== 'ready' || asset.ownership * 100 <= share || Boolean(pledgedLoanForAsset(player, asset.id))}",
    'disable partial sale of pledged asset',
)
replace_required(
    'src/V14UI.tsx',
    "{player.assets.filter((asset) => asset.id !== collateralAssetId).map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}",
    "{player.assets.filter((asset) => asset.id !== collateralAssetId && !pledgedLoanForAsset(player, asset.id)).map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}",
    'hide pledged assets from partial stock financing sale',
)
