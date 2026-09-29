import React, { useState } from 'react';
import { useRevenueReport } from '../api/hooks/useRevenueReport';
import { downloadClientsCsv } from '../api/reports';
import { QueryBoundary } from '../components/QueryBoundary';
import { Btn, Segmented, fmt, useToast } from '../components';
import { Charts } from '../lib/charts';
import { Icon, type IconComponent } from '../lib/icons';

const allZero = (s: number[]) => s.length === 0 || s.every(v => v === 0);

export function ReportsScreen(): React.ReactElement {
  const q = useRevenueReport();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [range, setRange] = useState('12m');

  const exportCsv = async () => {
    setBusy(true);
    try {
      const blob = await downloadClientsCsv();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'catre-clients.csv';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast({ title: 'Export ready', kind: 'success' });
    } catch {
      toast({ title: 'Export failed', msg: 'Could not download the CSV.', kind: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page page-wide">
      <div className="page-head">
        <div className="ph-text">
          <h1 className="page-title">Reports</h1>
          <p className="page-desc">Revenue, growth, churn and usage analytics.</p>
        </div>
        <div className="page-actions">
          <Segmented value={range} onChange={setRange} options={[
            { value: '90d', label: '90d' }, { value: '12m', label: '12m' }, { value: 'ytd', label: 'YTD' },
          ]} />
          <Btn variant="primary" icon={Icon.download} disabled={busy} onClick={exportCsv}>
            {busy ? 'Exporting…' : 'Export CSV'}
          </Btn>
        </div>
      </div>

      <QueryBoundary isLoading={q.isLoading} isError={q.isError} error={q.error}>
        {q.data && (() => {
          const planColor: Record<string, string> = {};
          q.data.revenue_by_plan.forEach(p => { planColor[p.label] = p.color; });
          const colorFor = (name: string) => planColor[name] ?? 'var(--slate)';

          const kpis: { title: string; val: string; sub: string; icon: IconComponent }[] = [
            { title: 'ARR', val: fmt.money(q.data.arr), sub: 'annualized', icon: Icon.dollar },
            { title: 'Avg. revenue / client', val: fmt.money(q.data.arpa), sub: 'per active client', icon: Icon.activity },
            { title: 'Net growth', val: fmt.pct(q.data.net_growth), sub: 'net new clients', icon: Icon.trendUp },
            { title: 'Gross churn', val: fmt.pct(q.data.gross_churn_pct), sub: 'monthly logo churn', icon: Icon.trendDown },
          ];

          return (
            <>
              <div className="kpi-grid" style={{ marginBottom: 16 }}>
                {kpis.map(k => (
                  <div className="kpi" key={k.title}>
                    <div className="kpi-top">
                      <span>{k.title}</span>
                      <span className="kpi-ic">{React.createElement(k.icon, { size: 14 })}</span>
                    </div>
                    <div className="kpi-val">{k.val}</div>
                    <div className="tiny muted" style={{ marginTop: 2 }}>{k.sub}</div>
                  </div>
                ))}
              </div>

              <div className="dash-row" style={{ marginBottom: 16 }}>
                <div className="card dash-grow-16">
                  <div className="card-head"><div className="f1"><h3>Revenue trend</h3><div className="sub">MRR, last 12 months</div></div></div>
                  <div className="card-pad">
                    {allZero(q.data.revenue_series)
                      ? <p className="muted" style={{ padding: '32px 0', textAlign: 'center' }}>Not enough history yet</p>
                      : <Charts.Line data={q.data.revenue_series} labels={q.data.months} format={fmt.k} />}
                  </div>
                </div>
                <div className="card">
                  <div className="card-head"><h3>Revenue by plan</h3></div>
                  <div className="card-pad" style={{ display: 'grid', placeItems: 'center', minHeight: 230 }}>
                    <Charts.Donut data={q.data.revenue_by_plan} />
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-head"><h3>Plan performance</h3></div>
                <div className="tbl-wrap">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Plan</th>
                        <th style={{ textAlign: 'right' }}>Clients</th>
                        <th style={{ textAlign: 'right' }}>MRR</th>
                        <th style={{ textAlign: 'right' }}>Share</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {q.data.plan_performance.map(p => (
                        <tr key={p.plan_name}>
                          <td>
                            <div className="row gap8">
                              <span style={{ width: 9, height: 9, borderRadius: 3, background: colorFor(p.plan_name) }} />
                              <b>{p.plan_name}</b>
                            </div>
                          </td>
                          <td className="num">{fmt.num(p.clients)}</td>
                          <td className="num" style={{ fontWeight: 600 }}>{fmt.money(p.mrr)}</td>
                          <td className="num">{fmt.pct(p.share_pct)}</td>
                          <td style={{ width: 180 }}>
                            <div className="bar"><span style={{ width: p.share_pct + '%', background: colorFor(p.plan_name) }} /></div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          );
        })()}
      </QueryBoundary>
    </div>
  );
}
