"""Download completed daily bars. Verify every month against TWSE trading dates.
Fail closed on missing quote bars, unknown adjustment or official-source errors.
Only writes site/data.js atomically after validation. No tokens or external packages.
"""
import json,math,time,datetime as dt,urllib.request,urllib.parse,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
TZ=dt.timezone(dt.timedelta(hours=8))

def positive(value):
    return isinstance(value,(int,float)) and math.isfinite(value) and value>0

def adjustment_for(day,quotes,q,adj,action_days):
    """Fill an interior adjustment gap only, never extrapolate over an action.
    Prices always come from TWSE. Never forward-fill a missing market price.
    """
    if day in quotes:
        k,_=quotes[day]
        if positive(q['close'][k]) and positive(adj[k]):return adj[k]/q['close'][k],False
    valid=[d for d,(k,_) in quotes.items() if positive(q['close'][k]) and positive(adj[k])]
    left=max((d for d in valid if d<day),default=None)
    right=min((d for d in valid if d>day),default=None)
    if left is None or right is None:raise ValueError(f'Adjustment unavailable without both neighbours: {day}')
    if (right-left).days>7 or any(left<d<=right for d in action_days):raise ValueError(f'Unsafe adjustment gap: {day}')
    li=quotes[left][0];ri=quotes[right][0];a=adj[li]/q['close'][li];b=adj[ri]/q['close'][ri]
    if not math.isclose(a,b,rel_tol=1e-6,abs_tol=1e-8):raise ValueError(f'Adjustment changes across gap: {day}')
    return a,True

def get(url):
    last=None
    for wait in [0,2,5]:
        if wait:time.sleep(wait)
        try:
            req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 (0050 research detector)'})
            with urllib.request.urlopen(req,timeout=30) as r:return json.load(r)
        except Exception as e:last=e
    raise RuntimeError(str(last))

def build(now=None):
    now=now or dt.datetime.now(TZ)
    cutoff=now.date() if now.hour>=15 else now.date()-dt.timedelta(days=1)
    result=get('https://query1.finance.yahoo.com/v8/finance/chart/0050.TW?range=2y&interval=1d&events=div%2Csplits')['chart']['result'][0]
    q=result['indicators']['quote'][0];adj=result['indicators']['adjclose'][0]['adjclose'];events=result.get('events',{}).get('splits',{})
    action_days={dt.datetime.fromtimestamp(e['date'],TZ).date() for kind in ['splits','dividends','capitalGains'] for e in result.get('events',{}).get(kind,{}).values()}
    quotes={}
    for k,ts in enumerate(result['timestamp']):
        day=dt.datetime.fromtimestamp(ts,TZ).date()
        if day<=cutoff and day>=cutoff-dt.timedelta(days=430):quotes[day]=(k,ts)
    months=sorted(set((d.year,d.month) for d in quotes));official={}
    for year,month in months:
        url='https://www.twse.com.tw/exchangeReport/STOCK_DAY?'+urllib.parse.urlencode({'response':'json','date':f'{year}{month:02}01','stockNo':'0050'})
        doc=get(url)
        if doc.get('stat')!='OK':raise ValueError(f'Official monthly data unavailable: {year}-{month}')
        for row in doc.get('data',[]):
            a=row[0].split('/');day=dt.date(int(a[0])+1911,int(a[1]),int(a[2]))
            if day>cutoff or day<min(quotes):continue
            official[day]=row
    rows=[];recovered=[]
    for day,row in sorted(official.items()):
        factor,filled=adjustment_for(day,quotes,q,adj,action_days)
        if filled:recovered.append(str(day))
        split=1.
        for e in events.values():
            if dt.datetime.fromtimestamp(e['date'],TZ).date()>day:split*=e['numerator']/e['denominator']
        values={name:float(row[col].replace(',',''))/split for name,col in [('open',3),('high',4),('low',5),('close',6)]}
        # A material close mismatch implies adjustment cannot be trusted for this date.
        close=q['close'][quotes[day][0]] if day in quotes else None
        if positive(close) and abs(values['close']/close-1)>.01:raise ValueError(f'Yahoo / official close mismatch {day}')
        adjusted={key:round(v*factor,8) for key,v in values.items()}
        if adjusted['low']>min(adjusted['open'],adjusted['close']) or adjusted['high']<max(adjusted['open'],adjusted['close']):raise ValueError(f'Invalid OHLC {day}')
        rows.append({'date':str(day),**adjusted,'factor':factor,'volume':int(row[1].replace(',',''))})
    if len(rows)<100:raise ValueError('Insufficient validated bars')
    if rows[-1]['date']!=str(max(quotes)):raise ValueError('Latest Yahoo / official date mismatch; retry after official close publication')
    return {'schema':1,'symbol':'0050','generatedAt':now.isoformat(timespec='seconds'),'source':'TWSE OHLC / Yahoo adjustment','note':'收盤後更新；實際交易日期已按證交所逐月核對。'+(' Yahoo缺列已用證交所價格與前後一致調整比例補齊：'+', '.join(recovered) if recovered else ''),'recoveredAdjustmentDates':recovered,'rows':rows}

if __name__=='__main__':
    data=build();target=ROOT/'site/data.js';temp=target.with_suffix('.tmp')
    temp.write_text('window.MARKET_DATA = '+json.dumps(data,ensure_ascii=False,allow_nan=False)+';\n',encoding='utf-8');temp.replace(target)
    print('Updated',len(data['rows']),'bars through',data['rows'][-1]['date'])
