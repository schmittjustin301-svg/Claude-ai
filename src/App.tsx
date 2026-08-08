import { useEffect, useState, type ReactElement } from "react";
import { Nav, type TabKey } from "./components/Nav";
import { Toasts } from "./components/Toasts";
import { LevelUpOverlay } from "./components/LevelUpOverlay";
import { RandomEventBanner } from "./components/RandomEventBanner";
import { useEmpireStore } from "./store/empireStore";
import { OverviewScreen } from "./features/overview/OverviewScreen";
import { TodayScreen } from "./features/today/TodayScreen";
import { BossScreen } from "./features/boss/BossScreen";
import { EarningsScreen } from "./features/earnings/EarningsScreen";
import { RoadmapScreen } from "./features/roadmap/RoadmapScreen";
import { SkillTreeScreen } from "./features/skills/SkillTreeScreen";
import { AchievementsScreen } from "./features/achievements/AchievementsScreen";
import { ChatScreen } from "./features/chat/ChatScreen";
import { AthletesScreen } from "./features/athletes/AthletesScreen";
import { ClipLabScreen } from "./features/cliplab/ClipLabScreen";
import { BrainScreen } from "./features/brain/BrainScreen";
import { useVideoJobNotifier } from "./features/cliplab/useVideoJobNotifier";
import { useVideoJobStore } from "./store/videoJobStore";
import { useVaultStore } from "./store/vaultStore";

const SCREENS: Record<TabKey, () => ReactElement> = {
  overview: OverviewScreen,
  today: TodayScreen,
  boss: BossScreen,
  earnings: EarningsScreen,
  athletes: AthletesScreen,
  cliplab: ClipLabScreen,
  brain: BrainScreen,
  roadmap: RoadmapScreen,
  skills: SkillTreeScreen,
  achievements: AchievementsScreen,
  chat: ChatScreen,
};

function App() {
  const [tab, setTab] = useState<TabKey>("overview");
  const init = useEmpireStore((s) => s.init);
  const tick = useEmpireStore((s) => s.tick);
  const loadVideoJobs = useVideoJobStore((s) => s.load);
  const initVault = useVaultStore((s) => s.init);

  // Generations outlive the tab that started them, so watching and announcing
  // them belongs at the app root rather than inside the video screen.
  useVideoJobNotifier();

  useEffect(() => {
    loadVideoJobs();
    initVault();
  }, [loadVideoJobs, initVault]);

  useEffect(() => {
    init();
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [init, tick]);

  const Screen = SCREENS[tab];

  return (
    <div className="ge-grid-bg min-h-screen bg-ge-black text-ge-white">
      <Toasts />
      <LevelUpOverlay />
      <Nav active={tab} onChange={setTab} />

      <main className="mx-auto flex h-screen max-w-2xl flex-col gap-4 overflow-hidden px-4 pt-6 pb-24 md:ml-56 md:max-w-3xl md:px-8 md:pb-8">
        <RandomEventBanner />
        <div className={tab === "chat" ? "flex min-h-0 flex-1 flex-col" : "flex-1 overflow-y-auto pb-4"}>
          <Screen />
        </div>
      </main>
    </div>
  );
}

export default App;
