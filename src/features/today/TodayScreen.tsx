import { useState } from "react";
import { useEmpireStore } from "../../store/empireStore";
import { Card, EmptyState, GlowButton, SectionTitle } from "../../components/ui";

export function TodayScreen() {
  const channels = useEmpireStore((s) => s.channels);
  const contracts = useEmpireStore((s) => s.contracts);
  const dailyTasks = useEmpireStore((s) => s.dailyTasks);
  const streak = useEmpireStore((s) => s.appState.streak);
  const addContract = useEmpireStore((s) => s.addContract);
  const completeContract = useEmpireStore((s) => s.completeContract);
  const deleteContract = useEmpireStore((s) => s.deleteContract);
  const addDailyTask = useEmpireStore((s) => s.addDailyTask);
  const completeDailyTask = useEmpireStore((s) => s.completeDailyTask);
  const deleteDailyTask = useEmpireStore((s) => s.deleteDailyTask);

  const [contractText, setContractText] = useState("");
  const [channelId, setChannelId] = useState(channels[0]?.id ?? "");
  const [xp, setXp] = useState(20);
  const [taskText, setTaskText] = useState("");

  const openContracts = contracts.filter((c) => !c.done);
  const doneContracts = contracts.filter((c) => c.done);

  return (
    <div className="flex flex-col gap-5">
      <SectionTitle
        right={
          <span className="rounded-full border border-ge-gold/40 px-2.5 py-0.5 font-mono text-[11px] text-ge-gold">
            {streak} Tage Streak 🔥
          </span>
        }
      >
        Today
      </SectionTitle>

      <Card>
        <div className="mb-3 font-mono text-xs tracking-widest text-white/50 uppercase">Neuer Contract</div>
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!contractText.trim() || !channelId) return;
            addContract(contractText.trim(), channelId, xp);
            setContractText("");
          }}
        >
          <input
            value={contractText}
            onChange={(e) => setContractText(e.target.value)}
            placeholder="z.B. 3 Reels für Justingymlife schneiden"
            className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-ge-red"
          />
          <div className="flex flex-wrap gap-2">
            <select
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-ge-red"
            >
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              value={xp}
              onChange={(e) => setXp(Number(e.target.value))}
              className="w-20 rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-ge-red"
            />
            <GlowButton type="submit" className="w-full sm:w-auto">
              Anlegen
            </GlowButton>
          </div>
        </form>
      </Card>

      <Card>
        <div className="mb-3 font-mono text-xs tracking-widest text-white/50 uppercase">Offene Contracts</div>
        {openContracts.length === 0 ? (
          <EmptyState>Keine offenen Contracts — leg einen an.</EmptyState>
        ) : (
          <div className="flex flex-col gap-2">
            {openContracts.map((c) => {
              const channel = channels.find((ch) => ch.id === c.channel_id);
              return (
                <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm text-white">{c.text}</div>
                    <div className="font-mono text-[11px] text-white/40">
                      {channel?.icon} {channel?.name} · +{c.xp} XP
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <GlowButton variant="green" onClick={() => completeContract(c.id)}>
                      ✓
                    </GlowButton>
                    <GlowButton variant="ghost" onClick={() => deleteContract(c.id)}>
                      ✕
                    </GlowButton>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {doneContracts.length > 0 && (
          <div className="mt-3 border-t border-white/10 pt-3 font-mono text-[11px] text-white/40">
            {doneContracts.length} erledigt
          </div>
        )}
      </Card>

      <Card>
        <div className="mb-3 font-mono text-xs tracking-widest text-white/50 uppercase">Tagesliste</div>
        <form
          className="mb-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!taskText.trim()) return;
            addDailyTask(taskText.trim());
            setTaskText("");
          }}
        >
          <input
            value={taskText}
            onChange={(e) => setTaskText(e.target.value)}
            placeholder="Kurze To-do für heute"
            className="flex-1 rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-ge-red"
          />
          <GlowButton type="submit" variant="ghost">
            +
          </GlowButton>
        </form>
        {dailyTasks.length === 0 ? (
          <EmptyState>Keine To-dos für heute.</EmptyState>
        ) : (
          <div className="flex flex-col gap-1.5">
            {dailyTasks.map((t) => (
              <label key={t.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-white/5">
                <input
                  type="checkbox"
                  checked={t.done}
                  onChange={() => !t.done && completeDailyTask(t.id)}
                  className="h-4 w-4 accent-[#ff1432]"
                />
                <span className={t.done ? "flex-1 text-sm text-white/35 line-through" : "flex-1 text-sm text-white"}>
                  {t.text}
                </span>
                <button onClick={() => deleteDailyTask(t.id)} className="text-white/30 hover:text-white/70">
                  ✕
                </button>
              </label>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
