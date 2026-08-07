import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import dayjs from "dayjs";
import { useEmpireStore } from "../../store/empireStore";
import { Card, EmptyState, GlowButton, SectionTitle } from "../../components/ui";

export function EarningsScreen() {
  const earnings = useEmpireStore((s) => s.earnings);
  const logEarning = useEmpireStore((s) => s.logEarning);
  const getEarningsSummary = useEmpireStore((s) => s.getEarningsSummary);

  const [amount, setAmount] = useState<number>(0);
  const [source, setSource] = useState("");

  const monthSummary = getEarningsSummary("month");
  const totalSummary = getEarningsSummary("all");

  const chartData = useMemo(() => {
    const byMonth = new Map<string, number>();
    for (const e of earnings) {
      const key = e.date.slice(0, 7);
      byMonth.set(key, (byMonth.get(key) ?? 0) + e.amount);
    }
    return Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, total]) => ({ month: dayjs(month + "-01").format("MMM YY"), total }));
  }, [earnings]);

  return (
    <div className="flex flex-col gap-5">
      <SectionTitle>Earnings</SectionTitle>

      <div className="grid grid-cols-2 gap-3">
        <Card className="text-center">
          <div className="font-mono text-xs text-white/50 uppercase">Gesamt</div>
          <div className="ge-text-glow-red mt-1 font-display text-3xl text-ge-green">{totalSummary.total.toFixed(0)}€</div>
        </Card>
        <Card className="text-center">
          <div className="font-mono text-xs text-white/50 uppercase">Dieser Monat</div>
          <div className="mt-1 font-display text-3xl text-ge-gold">{monthSummary.total.toFixed(0)}€</div>
        </Card>
      </div>

      <Card>
        <div className="mb-3 font-mono text-xs tracking-widest text-white/50 uppercase">Einnahme loggen</div>
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (amount <= 0 || !source.trim()) return;
            logEarning(amount, source.trim());
            setAmount(0);
            setSource("");
          }}
        >
          <input
            type="number"
            min={0}
            step="0.01"
            value={amount || ""}
            onChange={(e) => setAmount(Number(e.target.value))}
            placeholder="Betrag (€)"
            className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-ge-red sm:w-32"
          />
          <input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="Quelle, z.B. Rafael Editing"
            className="flex-1 rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-ge-red"
          />
          <GlowButton type="submit" variant="green">
            Loggen
          </GlowButton>
        </form>
      </Card>

      <Card>
        <div className="mb-3 font-mono text-xs tracking-widest text-white/50 uppercase">Verlauf pro Monat</div>
        {chartData.length === 0 ? (
          <EmptyState>Noch keine Einnahmen geloggt.</EmptyState>
        ) : (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                <Tooltip
                  contentStyle={{ background: "#050505", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8 }}
                  labelStyle={{ color: "#F5F5F5" }}
                  itemStyle={{ color: "#39FF88" }}
                  cursor={{ fill: "rgba(255,255,255,0.05)" }}
                />
                <Bar dataKey="total" fill="#FF1432" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card>
        <div className="mb-3 font-mono text-xs tracking-widest text-white/50 uppercase">Letzte Einträge</div>
        {earnings.length === 0 ? (
          <EmptyState>Noch keine Einträge.</EmptyState>
        ) : (
          <div className="flex flex-col gap-1.5">
            {earnings.slice(0, 8).map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
                <div>
                  <div className="text-sm text-white">{e.source}</div>
                  <div className="font-mono text-[11px] text-white/40">{e.date}</div>
                </div>
                <div className="font-mono text-sm text-ge-green">+{e.amount.toFixed(2)}€</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
