/* Shared browser / Node calculation engine. All signal features stop at index i. */
(function(root){
  'use strict';
  const MAS=[5,8,10,13,20,21,34,60];
  function validate(data){
    if(!data||!Array.isArray(data.rows)||data.rows.length<66)throw Error('至少需要66筆完整日線');
    let prev='';
    data.rows.forEach(r=>{
      if(!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||r.date<=prev)throw Error('日期須唯一且遞增');
      if(!['open','high','low','close'].every(k=>Number.isFinite(r[k])&&r[k]>0)||r.low>Math.min(r.open,r.close)||r.high<Math.max(r.open,r.close))throw Error('OHLC資料不完整');
      prev=r.date;
    }); return data;
  }
  function enrich(rows){return rows.map((r,i)=>{
    const ma={};for(const n of MAS)ma[n]=i+1>=n?rows.slice(i-n+1,i+1).reduce((a,b)=>a+b.close,0)/n:null;
    const atr=i>=13?rows.slice(i-13,i+1).reduce((a,b,k)=>{const j=i-13+k;return a+Math.max(b.high-b.low,j?Math.abs(b.high-rows[j-1].close):0,j?Math.abs(b.low-rows[j-1].close):0);},0)/14:null;
    return {...r,ma,atr};
  });}
  function detect(rows,i,n){
    if(i<65||!MAS.includes(n))return null;
    const p=rows[i],prev=rows[i-1],m=prev.ma[n];
    const checks=[
      ['前日收盤不低於前日目標均線',prev.close>=m],
      ['當日最低價 ≥ 前日均線98%',p.low>=m*.98],
      ['當日最低價 ≤ 前日均線102%',p.low<=m*1.02],
      ['當日收盤站回前日目標均線',p.close>=m],
      ['目標均線高於5交易日前',m>rows[i-6].ma[n]],
      ['前日MA60高於5交易日前',prev.ma[60]>rows[i-6].ma[60]],
      ['當日收盤不低於前日MA60',p.close>=prev.ma[60]]
    ];
    return {n,date:p.date,ma:m,low:p.low,close:p.close,high:p.high,checks,pass:checks.every(c=>c[1]),gap:(p.low/m-1)*100,stop:p.low-.5*prev.atr,atr:prev.atr,slope:(m/rows[i-6].ma[n]-1)*100};
  }
  function confirmation(rows,i,n){
    let pending=null;
    for(let k=Math.max(65,i-3);k<i;k++){
      const s=detect(rows,k,n);if(!s.pass)continue;
      for(let j=k+1;j<=i;j++){
        if(rows[j].close<s.stop)break;
        if(rows[j].close>s.high&&rows[j].low>=s.low){if(j===i)return {status:'confirmed',signal:s};break;}
        if(j===i&&i-k<3)pending={status:'waiting',signal:s,remaining:3-(i-k)};
      }
    }
    return pending||{status:'none'};
  }
  function size(open,stop,capital){
    if(![open,stop,capital].every(Number.isFinite)||open<=0||stop<=0||capital<=0)return {valid:false,reason:'請輸入大於0的資金與價格'};
    if(open<=stop)return {valid:false,reason:'取消：買價不高於風險價'};
    const distance=(open-stop)/open;if(distance>.08+1e-12)return {valid:false,reason:'取消：風險距離超過8%',distance};
    const fraction=Math.min(.25,.005/Math.max(distance,.02)),budget=capital*fraction;
    const shares=Math.floor(budget/(open*1.001));
    return {valid:shares>=1,reason:shares?'':'預算不足買入1股',distance,fraction,budget,shares,spent:shares*open*1.001,priceRisk:shares*(open-stop)};
  }
  // Extra observation only; NOT backtested and deliberately excluded from detect().pass.
  // N rises need N+1 consecutive MA observations, ending on the selected close.
  function continuousRise(rows,i,n,days=3){
    if(!Number.isInteger(days)||days<1||days>10||i<days)return null;
    const values=rows.slice(i-days,i+1).map(r=>r.ma[n]);
    if(values.some(v=>!Number.isFinite(v)))return null;
    return {pass:values.slice(1).every((v,k)=>v>values[k]),values,start:rows[i-days].date,end:rows[i].date,days};
  }
  const api={MAS,validate,enrich,detect,confirmation,size,continuousRise};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Detector=api;
})(typeof globalThis!=='undefined'?globalThis:this);
