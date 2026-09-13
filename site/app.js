'use strict';
const $=id=>document.getElementById(id),f=(x,d=2)=>Number.isFinite(x)?x.toLocaleString('zh-TW',{maximumFractionDigits:d,minimumFractionDigits:d}):'—';
let rows=[],i=0,n=21;
function draw(){
  const start=Math.max(0,i-89),w=rows.slice(start,i+1),values=w.flatMap(r=>[r.close,r.ma[n]]).filter(Number.isFinite),min=Math.min(...values)*.985,max=Math.max(...values)*1.015;
  const y=v=>220-(v-min)/(max-min)*175,x=k=>55+k/(Math.max(w.length-1,1))*790;
  let s='<svg viewBox="0 0 880 265" role="img" aria-label="調整收盤價與當日均線，非訊號參考的前日均線">';
  for(let k=0;k<4;k++){const v=min+(max-min)*k/3;s+=`<line x1="55" x2="850" y1="${y(v)}" y2="${y(v)}" stroke="#dce6ed"/><text x="4" y="${y(v)+4}" font-size="13" fill="#48657a">${f(v,1)}</text>`;}
  for(const [key,color] of [['close','#175d8a'],['ma','#bf7b16']]){const pts=w.map((r,k)=>`${x(k)},${y(key==='close'?r.close:r.ma[n])}`).join(' ');s+=`<polyline fill="none" stroke="${color}" stroke-width="2.4" points="${pts}"/>`;}
  s+=`<text x="55" y="248" font-size="13">${w[0].date}</text><text x="850" y="248" text-anchor="end" font-size="13">${w.at(-1).date}</text></svg>`;
  $('chart').innerHTML=s;$('chart-label').textContent=`${w[0].date}～${w.at(-1).date}｜縱軸：元／調整後單位；橫軸：台灣交易日期。藍線：收盤；橘線：當日MA${n}（觸線判斷另用前日MA）。`;
}
function computeSize(){
  const base=Detector.detect(rows,i,n),c=Detector.confirmation(rows,i,n),isConfirm=$('mode').value==='confirm';
  const signal=isConfirm&&c.status==='confirmed'?c.signal:base;
  if(isConfirm&&c.status!=='confirmed'){$('price-unit').textContent='尚無可用的確認訊號風險價。';$('sizing').textContent='選定日沒有完成確認訊號，不能以確認版試算。';return;}
  // Convert the stored adjusted values into the selected day's quoted-price scale.
  const factor=rows[i].factor||1,stop=signal.stop/factor;
  $('price-unit').textContent=`風險價 ${f(stop)}元／股｜原訊號 ${signal.date}。歷史模式以所選日期的分割後報價等值呈現；跨除息／分割的次日價格須重新換算，不能直接套用。`;
  if(!$('open').value){$('sizing').textContent='請输入預估或實際下一交易日開盤價；不會自動以收盤價代替。';return;}
  const result=Detector.size(Number($('open').value),stop,Number($('capital').value));
  const prefix=(!signal.pass?'⚠ 觸線條件未全部通過，以下僅為情境試算。<br>':'候選條件通過，以下仍是價格情境試算。<br>');
  if(!result.valid){$('sizing').innerHTML=prefix+result.reason;return;}
  $('sizing').innerHTML=prefix+`<p>風險距離 <strong>${f(result.distance*100)}%</strong> · 配置 ${f(result.fraction*100)}%</p><b>${f(result.shares,0)} 股</b><p>預算上限 NT$ ${f(result.budget,0)}<br>估計買入含費 NT$ ${f(result.spent,0)}<br>若恰好在風險價退出，價差損失 NT$ ${f(result.priceRisk,0)}（未含賣出費）</p><small>不是損失上限；收盤觸發後隔日開盤可能跳空。</small>`;
}
function render(){
  i=Number($('date').value);n=Number($('ma').value);const p=rows[i],s=Detector.detect(rows,i,n),factor=p.factor||1;
  const riseDays=Number($('rise-days').value),extra=[20,21].map(m=>({m,...Detector.continuousRise(rows,i,m,riseDays)}));
  $('rise-result').innerHTML=extra.map(r=>`<div class="check"><span>MA${r.m}：${r.start}～${r.end}<br><small>${r.values.map(v=>f(v/factor,4)).join(' → ')} 元／選定日股價等值</small></span><b class="${r.pass?'yes':'no'}">${r.pass?'✓ 連續上升':'× 未連續上升'}</b></div>`).join('')+`<p><strong>任一條通過（OR）：${extra.some(r=>r.pass)?'是':'否'}；兩條皆通過（AND）：${extra.every(r=>r.pass)?'是':'否'}。</strong> 僅供額外觀察，未回測。</p>`;
  $('metrics').innerHTML=[['選定日收盤（元／股等值）',f(p.close/factor)],['前日MA'+n+'（元／股等值）',f(s.ma/factor)],['最低價距前日MA'+n+'（%）',f(s.gap)+'%'],['符合條件（條／8條）',Detector.MAS.filter(m=>Detector.detect(rows,i,m).pass).length+' / 8']].map(([a,b])=>`<div class="metric"><span>${a}</span><b>${b}</b></div>`).join('');
  $('cards').innerHTML=Detector.MAS.map(m=>{const v=Detector.detect(rows,i,m);return `<button class="ma-card ${v.pass?'pass':''} ${m===n?'active':''}" data-ma="${m}" aria-pressed="${m===n}"><strong>MA${m}</strong><span>${v.pass?'✓ 符合候選條件':'未符合全部條件'}</span><small>低點距前日均線 ${f(v.gap)}%</small></button>`;}).join('');
  $('cards').querySelectorAll('button').forEach(b=>b.onclick=()=>{$('ma').value=b.dataset.ma;render();});
  $('detail-title').textContent=`MA${n} · ${p.date} 檢查清單`;
  $('result').textContent=s.pass?'候選成立':'未成立';$('result').className=s.pass?'yes':'no';
  $('checks').innerHTML=s.checks.map(([label,ok])=>`<div class="check"><span>${label}</span><b class="${ok?'yes':'no'}">${ok?'✓ 通過':'× 未通過'}</b></div>`).join('');
  const c=Detector.confirmation(rows,i,n);
  $('confirm').textContent=c.status==='confirmed'?`等待確認版：今日完成 ${c.signal.date} 的候選確認；計畫買點是下一交易日開盤，價格尚須檢查。`:c.status==='waiting'?`等待確認版：${c.signal.date} 候選仍等待，最多剩${c.remaining}個交易日。`:(s.pass?'直接候選今日成立；等待版最早從下一交易日觀察確認。':'今日沒有完成的確認訊號。');
  const latest=rows.at(-1).date,days=(Date.now()-Date.parse(latest+'T13:30:00+08:00'))/86400000;
  $('notice').className=days>4?'notice':'notice ok';$('notice').textContent=(i<rows.length-1?'歷史檢視，不是今日訊號。 ':'')+(days>4?'資料距今超過4個日曆日，可能未更新或遇長假，勿當成即時訊號。 ':'此工具使用日線收盤資料，不是即時行情。 ')+`最新資料 ${latest}；目前偵測 ${p.date}。`;
  computeSize();draw();
}
try{
  const data=Detector.validate(window.MARKET_DATA);rows=Detector.enrich(data.rows);
  $('date').innerHTML=rows.map((r,k)=>k>=65?`<option value="${k}">${r.date}</option>`:'').reverse().join('');$('date').value=rows.length-1;
  $('ma').innerHTML=Detector.MAS.map(m=>`<option value="${m}">MA${m} · ${m}交易日</option>`).join('');$('ma').value='21';
  $('metadata').textContent=`0050｜${data.source}｜資料產生 ${data.generatedAt}｜${rows.length}筆日線。${data.note||''}`;
  $('rise-days').onchange=render;
  $('date').onchange=()=>{$('open').value='';render();};$('ma').onchange=render;$('mode').onchange=computeSize;$('open').oninput=computeSize;$('capital').oninput=computeSize;$('reload').onclick=()=>{const url=new URL(location.href);url.searchParams.set('reload',Date.now());location.href=url.href;};render();
}catch(e){$('notice').textContent='資料無法使用：'+e.message+'。請確認已包含data.js，或查看GitHub Actions更新狀態。';$('notice').className='notice';}
