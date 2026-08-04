(function(){
  'use strict';
  function show(el){if(!el)return;el.hidden=false;el.classList.remove('hidden');}
  function hide(el){if(!el)return;el.hidden=true;el.classList.add('hidden');}
  function text(id,value){var el=document.getElementById(id);if(el)el.textContent=value;}
  function rub(n){return Math.round(Number(n)||0).toLocaleString('ru-RU')+' ₽';}

  function safeStart(){
    var setup=document.getElementById('setupScreen');
    var game=document.getElementById('gameScreen');
    try{
      if(typeof startGame==='function') startGame();
      hide(setup);show(game);
      if(typeof render==='function') render();
      var board=document.getElementById('board');
      if(board && !board.children.length && typeof renderBoard==='function') renderBoard();
      text('statusText','Твой ход. Бросай кубик.');
    }catch(err){
      console.error('start failed',err);
      hide(setup);show(game);
      text('turnLabel','Твой ход');
      text('statusText','Игра запущена в безопасном режиме. Бросай кубик.');
      try{
        if(typeof state!=='undefined' && (!state.players||!state.players.length) && typeof freshState==='function' && typeof playerFrom==='function' && typeof professions!=='undefined'){
          var key=(document.getElementById('professionSelect')||{}).value||Object.keys(professions)[0];
          var count=Number((document.getElementById('botCountSelect')||{}).value||2);
          var keys=Object.keys(professions).filter(function(k){return k!==key;});
          state=freshState();state.started=true;state.phase='ready';state.current=0;state.busy=false;
          state.players=[playerFrom(key,'Ты',false,0)];
          for(var i=0;i<count;i++)state.players.push(playerFrom(keys[i%keys.length],'Соперник '+(i+1),true,i+1));
          if(typeof render==='function')render();
        }
      }catch(fallbackErr){console.error('fallback failed',fallbackErr);text('statusText','Ошибка запуска: '+fallbackErr.message);}
    }
  }

  function install(){
    var old=document.getElementById('newGameBtn');
    if(old){
      var fresh=old.cloneNode(true);old.parentNode.replaceChild(fresh,old);
      fresh.addEventListener('click',function(e){e.preventDefault();safeStart();});
    }
    var setup=document.getElementById('setupScreen'),game=document.getElementById('gameScreen'),sheet=document.getElementById('sheetBackdrop');
    if(setup)show(setup);if(game)hide(game);if(sheet)hide(sheet);
    window.addEventListener('error',function(e){var m=document.getElementById('loadError');if(m){m.hidden=false;m.textContent='Ошибка игры: '+(e.message||'неизвестная ошибка');}});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();