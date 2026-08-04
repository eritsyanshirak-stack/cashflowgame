'use strict';

// Stability and economy patch v4. Loaded after game.js.
const PATCH_VERSION = 4;

function patchMigratePlayer(p) {
  p.pending = Array.isArray(p.pending) ? p.pending : [];
  p.assets = (p.assets || []).map(a => ({
    ...a,
    ownership: a.ownership || 1,
    upgrades: Array.isArray(a.upgrades) ? a.upgrades : [],
    upgradeSpent: a.upgradeSpent || 0,
    incomeReceived: a.incomeReceived || 0,
    pledged: !!a.pledged
  }));
  p.loans = (p.loans || []).map(l => ({
    ...l,
    rate: l.rate || (String(l.name).includes('Быстрый') ? .08 : String(l.name).includes('Аварий') ? .07 : .03)
  }));
  return p;
}

const originalFreshState = freshState;
freshState = function patchedFreshState() {
  const s = originalFreshState();
  s.version = PATCH_VERSION;
  s.pendingPartnerShare = 0;
  return s;
};

const originalPlayerFrom = playerFrom;
playerFrom = function patchedPlayerFrom(...args) {
  return patchMigratePlayer(originalPlayerFrom(...args));
};

load = function patchedLoad() {
  try {
    const raw = localStorage.getItem('cashflowgame-v2') || localStorage.getItem(SAVE_KEY) || localStorage.getItem('cashflowgame-v1');
    if (!raw) return false;
    const saved = JSON.parse(raw);
    if (!saved || !Array.isArray(saved.players)) return false;
    saved.version = PATCH_VERSION;
    saved.pendingPartnerShare = saved.pendingPartnerShare || 0;
    saved.players = saved.players.map(patchMigratePlayer);
    state = saved;
    return true;
  } catch (error) {
    console.warn('Не удалось восстановить сохранение', error);
    return false;
  }
};

save = function patchedSave() {
  if (state.started) {
    state.version = PATCH_VERSION;
    localStorage.setItem('cashflowgame-v2', JSON.stringify(state));
  }
  updateContinue();
};

updateContinue = function patchedContinueButton() {
  const el = document.querySelector('#continueGameBtn');
  if (!el) return;
  const hasSave = !!(localStorage.getItem('cashflowgame-v2') || localStorage.getItem(SAVE_KEY) || localStorage.getItem('cashflowgame-v1'));
  el.hidden = !hasSave;
  el.classList.toggle('hidden', !hasSave);
};

const originalShowDeal = showDeal;
showDeal = function patchedShowDeal(deal, discounted = false) {
  state.pendingPartnerShare = 0;
  return originalShowDeal(deal, discounted);
};

buyDeal = function patchedBuyDeal(partnerShare = state.pendingPartnerShare || 0) {
  const p = human();
  const d = state.pendingDeal;
  if (!d) return;
  state.pendingPartnerShare = partnerShare;
  const ownership = 1 - partnerShare;
  const down = Math.round(d.down * ownership);
  if (p.cash < down) {
    fundingMenu(down - p.cash, partnerShare);
    return;
  }
  const assetDebt = Math.round(d.debt * ownership);
  const gross = Math.round(d.gross * ownership);
  const service = Math.round(d.service * ownership);
  p.cash -= down;
  p.assets.push({
    id: `a${Date.now()}${Math.random()}`,
    name: d.name,
    icon: d.icon,
    category: d.category,
    buyPrice: d.cost,
    marketValue: d.cost,
    ownership,
    ownInvestment: down,
    debt: assetDebt,
    gross,
    service,
    payment: Math.round(assetDebt * .015),
    partnerShare,
    upgradeSpent: 0,
    incomeReceived: 0,
    upgrades: [],
    pledged: false
  });
  p.stats.bought++;
  state.pendingPartnerShare = 0;
  log('Новый актив', `${d.name}: поток ${money(assetFlow(p.assets.at(-1)))}/мес`);
  finishHumanTurn();
};

function patchedDealNeed() {
  if (!state.pendingDeal) return 0;
  const ownership = 1 - (state.pendingPartnerShare || 0);
  return Math.max(0, Math.round(state.pendingDeal.down * ownership) - human().cash);
}

fundingMenu = function patchedFundingMenu(missing, share = state.pendingPartnerShare || 0) {
  state.pendingPartnerShare = share;
  const p = human();
  openSheet('ФИНАНСИРОВАНИЕ', `Не хватает ${money(missing)}`, `
    <div class="notice">Сначала используй ликвидные активы. Дорогой долг оставляй последним вариантом.</div>
    <div class="metrics">
      ${metric('Деньги', money(p.cash))}
      ${metric('Не хватает', money(missing), 'bad')}
      ${metric('Акции', money(stockValue(p)))}
      ${metric('Депозит и облигации', money(p.deposit + p.bonds))}
    </div>
    <div class="actions one">
      ${button('Продать бизнес', 'patchFundAsset', 'btn', p.assets.length ? '' : 'disabled')}
      ${button('Продать все акции', 'patchFundStocks', 'btn', p.portfolio.length ? '' : 'disabled')}
      ${button('Снять депозит и облигации', 'patchFundSafe', 'btn', p.deposit + p.bonds > 0 ? '' : 'disabled')}
      ${button('Заложить актив', 'patchFundPledge', 'btn', p.assets.some(a => !a.pledged) ? '' : 'disabled')}
      ${button('Банковский кредит', 'patchDealLoan', 'btn btn-success')}
      ${button('Быстрый заём до 250 000', 'patchQuickLoan', 'btn btn-danger')}
      ${button('Отдать партнёру 30%', 'patchPartner30')}
      ${button('Отдать партнёру 50%', 'patchPartner50')}
      ${button('Отказаться от покупки', 'finishTurn')}
    </div>`, true);
};

function patchedContinueFunding() {
  const need = patchedDealNeed();
  if (need > 0) fundingMenu(need);
  else buyDeal();
}

function patchedTakeLoan(fast) {
  const p = human();
  const need = patchedDealNeed();
  const amount = Math.min(need, fast ? 250000 : need);
  if (amount <= 0) return buyDeal();
  const chance = fast ? 1 : clamp(.78 - totalDebt(p) / Math.max(1, p.income) * .035 + (monthlyFlow(p) > 0 ? .08 : -.12), .15, .9);
  if (Math.random() > chance) {
    log('Отказ банка', 'Банк не одобрил кредит');
    fundingMenu(need);
    return;
  }
  const rate = fast ? .08 : .03;
  p.cash += amount;
  p.loans.push({ name: fast ? 'Быстрый заём' : 'Банковский кредит', balance: amount, rate, payment: Math.round(amount * rate) });
  log(fast ? 'Дорогой заём' : 'Кредит одобрен', `${money(amount)}, платёж ${money(amount * rate)}/мес`);
  patchedContinueFunding();
}

executeSale = function patchedExecuteSale(id, price, forFunding = false) {
  const p = human();
  const asset = p.assets.find(a => a.id === id);
  if (!asset) return;
  const proceeds = price * asset.ownership - asset.debt;
  const result = proceeds + asset.incomeReceived - asset.ownInvestment - asset.upgradeSpent;
  if (proceeds >= 0) p.cash += proceeds;
  else {
    const balance = Math.abs(proceeds);
    p.loans.push({ name: 'Остаточный долг после продажи', balance, rate: .05, payment: Math.round(balance * .05) });
  }
  p.assets = p.assets.filter(a => a.id !== id);
  p.stats.sold++;
  result >= 0 ? p.stats.profit += result : p.stats.loss += Math.abs(result);
  log('Продажа бизнеса', `${asset.name}: ${result >= 0 ? 'прибыль' : 'убыток'} ${money(Math.abs(result))}`);
  render();
  if (forFunding) patchedContinueFunding(); else openAssets();
};

const originalDevelopAsset = developAsset;
developAsset = function patchedDevelopAsset(id) {
  const asset = human().assets.find(a => a.id === id);
  if (!asset) return;
  asset.upgrades = asset.upgrades || [];
  state.selectedAsset = id;
  const upgrades = [
    ['Соцсети и реклама',80000,'ads'],['Автоматизация',120000,'auto'],['Управляющий',150000,'manager'],
    ['Ремонт и бренд',110000,'brand'],['Вторая точка',320000,'second'],['Франшиза',550000,'franchise']
  ].filter(([, , key]) => !asset.upgrades.includes(key));
  openSheet('РАЗВИТИЕ', asset.name, `${cardForAsset(asset, false)}
    ${upgrades.map(([name,cost,key]) => `<article class="info-card"><div class="card-body"><strong>${name} · ${money(cost)}</strong><div class="actions one">${button('Вложиться','applyUpgrade','btn btn-success',`data-kind="${key}" data-cost="${cost}" ${key === 'franchise' && asset.upgrades.length < 2 ? 'disabled' : ''}`)}</div></div></article>`).join('')}
    ${upgrades.length ? '' : '<div class="notice">Все доступные улучшения уже сделаны.</div>'}
    ${button('Назад','assets')}`);
};

const originalApplyUpgrade = applyUpgrade;
applyUpgrade = function patchedApplyUpgrade(kind, cost) {
  const asset = human().assets.find(a => a.id === state.selectedAsset);
  if (!asset || (asset.upgrades || []).includes(kind)) return;
  if (kind === 'franchise' && asset.upgrades.length < 2) {
    openSheet('ПОКА РАНО','Франшиза', `<div class="notice">Сначала сделай минимум два других улучшения.</div>${button('Назад','assets')}`);
    return;
  }
  const before = assetFlow(asset);
  originalApplyUpgrade(kind, cost);
  const after = assetFlow(asset);
  if (asset && after !== before) setTimeout(() => log('Изменение потока', `${asset.name}: ${after - before >= 0 ? '+' : ''}${money(after - before)}/мес`), 0);
};

repayLoan = function patchedRepayLoan() {
  const p = human();
  if (!p.loans.length) {
    log('Погашение долга', 'Активных кредитов нет');
    openBank(false);
    return;
  }
  let remaining = Math.min(100000, p.cash);
  const paid = remaining;
  p.loans.sort((a,b) => (b.rate || .03) - (a.rate || .03));
  for (const loan of p.loans) {
    const part = Math.min(remaining, loan.balance);
    p.cash -= part;
    loan.balance -= part;
    remaining -= part;
    loan.payment = Math.round(loan.balance * (loan.rate || .03));
    if (remaining <= 0) break;
  }
  p.loans = p.loans.filter(l => l.balance > 0);
  log('Погашение долга', `Внесено ${money(paid - remaining)}`);
  render();
  openBank(false);
};

const originalOpportunityEvent = opportunityEvent;
opportunityEvent = function patchedOpportunityEvent() {
  originalOpportunityEvent();
  if (state.opportunity) state.opportunity.due = state.month + 1;
};

const oldFinishHumanTurn = finishHumanTurn;
finishHumanTurn = async function patchedFinishHumanTurn() {
  closeSheet(true);
  state.modalRequired = false;
  state.current = 1;
  state.phase = 'bots';
  state.busy = true;
  render();
  await runBots();
};

botAction = function patchedBotAction(p, type) {
  const aggression = ({ easy:.36, normal:.58, hard:.78 })[state.difficulty] || .58;
  if ((type === 'business' || type === 'surprise') && Math.random() < aggression) {
    const d = {...businesses[Math.floor(Math.random()*businesses.length)]};
    const payment = Math.round(d.debt * .015);
    const net = d.gross - d.service - payment;
    const reserve = p.baseExpenses * (({easy:1.25,normal:.8,hard:.45})[state.difficulty] || .8);
    if (net > 0 && p.cash > d.down + reserve) {
      p.cash -= d.down;
      p.assets.push({id:`b${Date.now()}${Math.random()}`,name:d.name,icon:d.icon,category:d.category,buyPrice:d.cost,marketValue:d.cost,ownership:1,ownInvestment:d.down,debt:d.debt,gross:d.gross,service:d.service,payment,partnerShare:0,upgradeSpent:0,incomeReceived:0,upgrades:[],pledged:false});
      p.stats.bought++;
      log('Ход соперника', `${p.name} купил ${d.name}`);
    }
  }
  if (type === 'stock' && p.cash > p.baseExpenses * 1.2) {
    const st = state.stocks[Math.floor(Math.random()*state.stocks.length)];
    const qty = Math.max(1, Math.min(state.difficulty === 'hard' ? 10 : 5, Math.floor((p.cash-p.baseExpenses)/st.price)));
    if (qty) {
      p.cash -= st.price * qty;
      let pos = p.portfolio.find(x => x.ticker === st.ticker);
      if (!pos) { pos = {ticker:st.ticker,qty:0,avg:0}; p.portfolio.push(pos); }
      pos.avg = (pos.avg * pos.qty + st.price * qty) / (pos.qty + qty);
      pos.qty += qty;
    }
  }
  if (type === 'expense') {
    p.cash -= 50000 + Math.round(Math.random()*90000);
    if (p.cash < 0) {
      const gap = -p.cash; p.cash = 0;
      p.loans.push({name:'Аварийный заём',balance:gap,rate:.07,payment:Math.round(gap*.07)});
    }
  }
  if (type === 'growth' && p.assets.length && p.cash > 180000) {
    p.cash -= 80000;
    p.assets[0].gross = Math.round(p.assets[0].gross * 1.18);
  }
};

runBots = async function patchedRunBots() {
  while (state.current < state.players.length) {
    const p = current();
    setStatus(`${p.name} принимает решение...`);
    await wait(260);
    const value = 1 + Math.floor(Math.random()*6);
    state.die = value;
    p.pos = (p.pos + value) % cells.length;
    render();
    await wait(210);
    botAction(p, cells[p.pos][0]);
    state.current++;
    await wait(180);
  }
  advanceDay(); // One day after the full table has completed a round.
  state.current = 0;
  state.phase = 'ready';
  state.busy = false;
  setStatus('Твой ход. Можно открыть разделы или бросить кубик.');
  render();
  if (passive(human()) >= monthlyExpenses(human())) showWin();
};

const originalProcessMonth = processMonth;
processMonth = function patchedProcessMonth() {
  originalProcessMonth();
  for (const p of state.players) {
    const due = (p.pending || []).filter(x => x.due <= state.month);
    for (const deal of due) {
      const result = Math.round(deal.cost * (deal.min + Math.random() * (deal.max - deal.min)));
      p.cash += result;
      if (!p.isBot) log('Перепродажа завершена', `${deal.name}: ${result-deal.cost >= 0 ? '+' : ''}${money(result-deal.cost)}`);
    }
    p.pending = (p.pending || []).filter(x => x.due > state.month);
  }
};

// Extra action handling. Capture phase runs before the legacy delegated handler.
document.addEventListener('click', (event) => {
  const b = event.target.closest('[data-action]');
  if (!b || b.disabled) return;
  const action = b.dataset.action;
  const p = human();
  if (action === 'patchDealLoan') { event.stopImmediatePropagation(); patchedTakeLoan(false); }
  if (action === 'patchQuickLoan') { event.stopImmediatePropagation(); patchedTakeLoan(true); }
  if (action === 'patchPartner30') { event.stopImmediatePropagation(); state.pendingPartnerShare=.3; buyDeal(.3); }
  if (action === 'patchPartner50') { event.stopImmediatePropagation(); state.pendingPartnerShare=.5; buyDeal(.5); }
  if (action === 'patchFundStocks') {
    event.stopImmediatePropagation();
    for (const pos of p.portfolio) { const st=state.stocks.find(s=>s.ticker===pos.ticker); if(st)p.cash += st.price*pos.qty; }
    p.portfolio=[]; log('Продажа акций','Портфель продан для сделки'); patchedContinueFunding();
  }
  if (action === 'patchFundSafe') { event.stopImmediatePropagation(); p.cash += p.deposit+p.bonds; p.deposit=0;p.bonds=0;log('Ликвидные вложения','Средства выведены');patchedContinueFunding(); }
  if (action === 'patchFundPledge') {
    event.stopImmediatePropagation();
    const asset=p.assets.find(a=>!a.pledged);if(!asset)return;
    const amount=Math.round(Math.max(0,asset.marketValue*asset.ownership-asset.debt)*.5);
    asset.pledged=true;asset.debt+=amount;asset.payment+=Math.round(amount*.025);p.cash+=amount;
    log('Залог',`${asset.name}: получено ${money(amount)}`);patchedContinueFunding();
  }
  if (action === 'patchFundAsset') {
    event.stopImmediatePropagation();
    openSheet('ПРОДАТЬ АКТИВ','Выбери актив',p.assets.map(a=>`${cardForAsset(a,false)}${button('Продать по быстрой цене','patchFundAssetNow','btn btn-primary',`data-id="${a.id}"`)}`).join(''),true);
  }
  if (action === 'patchFundAssetNow') {
    event.stopImmediatePropagation();
    const asset=p.assets.find(a=>a.id===b.dataset.id);if(!asset)return;
    executeSale(asset.id,Math.round(asset.marketValue*.88),true);
  }
  if (action === 'takeOpportunity') {
    event.stopImmediatePropagation();
    const o=state.opportunity;if(!o||p.cash<o.cost)return;
    p.cash-=o.cost;p.pending.push({...o,due:state.month+1});
    log('Перепродажа запущена',`${o.name}: результат в следующем месяце`);
    finishHumanTurn();
  }
}, true);

updateContinue();
