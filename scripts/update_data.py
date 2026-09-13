"""Download completed daily bars. Verify every month against TWSE trading dates.
Fail closed on missing quote bars, unknown adjustment or official-source errors.
Only writes site/data.js atomically after validation. No tokens or external packages.
"""
import json,math,time,datetime as dt,urllib.request,urllib.parse,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
TZ=dt.timezone(dt.timedelta(hours=8))

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
    rows=[]
    for day,row in sorted(official.items()):
        if day not in quotes:raise ValueError(f'Yahoo missing actual trading date {day}')
        k,ts=quotes[day];close=q['close'][k];ac=adj[k]
        if not close or not ac or not all(math.isfinite(x) and x>0 for x in [close,ac]):raise ValueError(f'Bad adjustment {day}')
        factor=ac/close;split=1.
        for e in events.values():
            if e['date']>ts:split*=e['numerator']/e['denominator']
        values={name:float(row[col].replace(',',''))/split for name,col in [('open',3),('high',4),('low',5),('close',6)]}
        # A material close mismatch implies adjustment cannot be trusted for this date.
        if abs(values['close']/close-1)>.01:raise ValueError(f'Yahoo / official close mismatch {day}')
        adjusted={key:round(v*factor,8) for key,v in values.items()}
        if adjusted['low']>min(adjusted['open'],adjusted['close']) or adjusted['high']<max(adjusted['open'],adjusted['close']):raise ValueError(f'Invalid OHLC {day}')
        rows.append({'date':str(day),**adjusted,'factor':factor,'volume':int(row[1].replace(',',''))})
    if len(rows)<100:raise ValueError('Insufficient validated bars')
    if rows[-1]['date']!=str(max(quotes)):raise ValueError('Latest Yahoo / official date mismatch; retry after official close publication')
    return {'schema':1,'symbol':'0050','generatedAt':now.isoformat(timespec='seconds'),'source':'TWSE OHLC / Yahoo adjustment','note':'收盤後更新；實際交易日期已按證交所逐月核對。','rows':rows}

if __name__=='__main__':
    data=build();target=ROOT/'site/data.js';temp=target.with_suffix('.tmp')
    temp.write_text('window.MARKET_DATA = '+json.dumps(data,ensure_ascii=False,allow_nan=False)+';\n',encoding='utf-8');temp.replace(target)
    print('Updated',len(data['rows']),'bars through',data['rows'][-1]['date'])
