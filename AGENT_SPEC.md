# AI agent handoff — 0050 Detector / Codex

This is a standalone static GitHub Pages package, NOT Titan production code. No automatic orders, portfolio tracking, notifications, or live quotes. Do not upload the parent workspace or credentials. User requested a GitHub-uploadable package, not an already-created GitHub repository.

## Architecture

- `site/data.js` assigns a generated public data object to `window.MARKET_DATA`. Script delivery supports direct local-file reading as well as HTTPS; no browser-to-Yahoo CORS workaround or proxy.
- `engine.js` is UMD-style pure logic used in both browser and Node tests. Signal calculations use adjusted prices. In detect(i,n), previous MA is rows[i-1].ma[n]; slope uses rows[i-6].ma[n]. i>=65 is required for MA60 slope. ATR14 uses SMA of TR.
- `confirmation` examines qualifying signal dates in the previous 1–3 sessions, cancels after a close below the original stop, accepts FIRST higher close than original high AND low>=original low. It reports today's completion only. Different candidate episodes can overlap; this is NOT a portfolio strategy with wait/holding deduplication.
- `size` rejects open<=stop, distance>8%, invalid inputs. Fraction=min(.25,.005/max(distance,.02)); shares=floor(capital*fraction/(open*1.001)). Fees are assumptions; there is no portfolio-state constraint.
- UI stores no personal inputs, transmits no inputs. Opens are manual scenarios; it never silently assumes close is next-open. Historical prices use selected-date adjustment factor and current split-unit equivalence; next-day corporate actions are NOT incorporated into sizing.

## Data/update behavior

Updater uses Yahoo2y daily events and adjusted-close ratio plus TWSE month OHLC/date inventory over the last430 calendar days. Official raw prices are divided by cumulative later Yahoo split ratios to match Yahoo split units, then multiplied by adjclose/quote.close. Date gaps, latest date disagreement or >1% close mismatch abort publication. No blanket deletion of zero-volume days; use official date inventory. Output atomically replaced only after successful collection.

Only completed daily candles: before15:00 Taiwan cutoff yesterday, otherwise today. No trading-calendar guess for next entry date. Output includes dates, factor, OHLC, official volume, source and generation timestamp. This is not a full independent audit of dividend adjustment accuracy or redistribution rights.

Workflow `main`, push/manual/schedule UTC08:35、10:35、13:35 Mon–Fri. Deploy artifact contains site/ only, pages environment with limited standard permissions. Failed update stops deployment. Workflow doesn't commit refreshed data back to main; currently deployed artifact may be newer than repository seed. Data source throttling is surfaced as failure. Document public scheduled-workflow inactivity disablement.

## Verification / limitations

Additional observation: engine.continuousRise(rows,i,n,days) checks N strict consecutive day-to-day MA increases ending at selected close (N+1 observations). UI selects 2/3/5/10, default3, separately displays MA20 and21 plus OR/AND. NOT backtested, NOT connected to detect().pass, confirmation or size. Do not imply old backtests validate this optional observation. Unit tests verify arithmetic only.

Run Node engine.test.cjs and data.test.cjs from repository root. Real update ran successfully during development. Before publishing, user must enable Pages Source=GitHub Actions and test the resulting HTTPS URL on a phone. Browser tool local-file preview was blocked by URL policy; do not assert actual mobile visual QA completed.

UI rules must stay consistent with README and tests; changing MA logic or sizing is a strategy change, not a cosmetic edit. Test equality boundaries, confirmation cancellation/first confirmation, prefix invariance, data completeness, and safe missing-data behavior. Keep latest date prominent. No claim of proven profitability or fixed maximum loss.
