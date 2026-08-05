from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def update(path: str, replacements: list[tuple[str, str]]) -> None:
    file = ROOT / path
    text = file.read_text()
    for old, new in replacements:
        if old not in text:
            raise RuntimeError(f'Missing audit anchor in {path}: {old[:80]!r}')
        text = text.replace(old, new, 1)
    file.write_text(text)


update('src/game/engine/engine.ts', [
    (
        "    if ((asset.insuredUntilMonth ?? 0) >= state.month) continue\n",
        "    if ((asset.insuredUntilMonth ?? 0) >= state.month || (asset.warrantyUntilMonth ?? 0) >= state.month) continue\n",
    ),
    (
        "  scheduleDealChain(state, asset)\n  return asset\n",
        "  if (!player.isBot) scheduleDealChain(state, asset)\n  return asset\n",
    ),
])

update('src/game/systems/v14.ts', [
    (
        "    const activeBots = state.players.filter((item) => item.isBot && item.status === 'active')\n    const botBuyer = activeBots.length > 0 && random() < 0.28 ? activeBots[Math.floor(random() * activeBots.length)] : undefined\n",
        "",
    ),
    (
        "      buyerName: botBuyer?.name ?? buyerArchetypeLabel[archetype],\n",
        "      buyerName: buyerArchetypeLabel[archetype],\n",
    ),
    (
        "      archetype,\n      buyerPlayerId: botBuyer?.id,\n",
        "      archetype,\n",
    ),
])

print('v1.5 audit fixes applied')
