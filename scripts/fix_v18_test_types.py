from pathlib import Path

path = Path('src/game/engine/v18-live-negotiation.test.ts')
text = path.read_text()
text = text.replace(
"""    expect(game.pendingDecision?.kind).toBe('business')
    expect(game.pendingDecision?.kind === 'business' && game.pendingDecision.askingPrice).toBe(100_000)""",
"""    const won = game.pendingDecision as Decision | null
    expect(won?.kind).toBe('business')
    expect((won as Extract<Decision, { kind: 'business' }>).askingPrice).toBe(100_000)""",
1,
)
text = text.replace(
"""    expect(game.pendingDecision?.kind).toBe('business')
    expect(game.pendingDecision?.kind === 'business' && game.pendingDecision.askingPrice).toBe(110_000)""",
"""    const won = game.pendingDecision as Decision | null
    expect(won?.kind).toBe('business')
    expect((won as Extract<Decision, { kind: 'business' }>).askingPrice).toBe(110_000)""",
1,
)
path.write_text(text)
