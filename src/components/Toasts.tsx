import { AnimatePresence, motion } from "framer-motion";
import { useEmpireStore } from "../store/empireStore";
import clsx from "clsx";

const KIND_STYLES: Record<string, string> = {
  xp: "border-ge-green/50 text-ge-green",
  achievement: "border-ge-gold/50 text-ge-gold",
  boss: "border-ge-red/50 text-ge-red",
  info: "border-white/20 text-white",
};

export function Toasts() {
  const toasts = useEmpireStore((s) => s.toasts);
  const dismiss = useEmpireStore((s) => s.dismissToast);

  return (
    <div className="pointer-events-none fixed top-3 left-1/2 z-50 flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-3">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            onClick={() => dismiss(t.id)}
            className={clsx(
              "pointer-events-auto rounded-xl border bg-black/90 px-4 py-2.5 font-mono text-xs shadow-lg backdrop-blur",
              KIND_STYLES[t.kind]
            )}
          >
            {t.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
