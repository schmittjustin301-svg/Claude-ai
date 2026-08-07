import { AnimatePresence, motion } from "framer-motion";
import { useEmpireStore } from "../store/empireStore";

export function LevelUpOverlay() {
  const overlay = useEmpireStore((s) => s.levelUpOverlay);
  const dismiss = useEmpireStore((s) => s.dismissLevelUpOverlay);

  return (
    <AnimatePresence>
      {overlay?.visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={dismiss}
          className="ge-grid-bg fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 16 }}
            className="text-center"
          >
            <div className="font-mono text-sm tracking-[0.3em] text-ge-red uppercase">Level Up</div>
            <div className="ge-text-glow-red font-display text-8xl text-ge-white">{overlay.level}</div>
            <div className="mt-4 font-mono text-xs text-white/50">Tippen zum Schließen</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
