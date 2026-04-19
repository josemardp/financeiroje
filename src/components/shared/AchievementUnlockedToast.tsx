import { useEffect, useRef, useState } from "react";
import { Trophy } from "lucide-react";

interface Achievement {
  id: string;
  icon: string | null;
  title: string;
  description: string;
}

interface Props {
  achievement: Achievement | null;
  onDone: () => void;
}

type Phase = "hidden" | "mounting" | "visible" | "fading";

export function AchievementUnlockedToast({ achievement, onDone }: Props) {
  const [phase, setPhase] = useState<Phase>("hidden");
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (!achievement) {
      setPhase("hidden");
      return;
    }

    setPhase("mounting");
    const t0 = setTimeout(() => setPhase("visible"), 16);
    const t1 = setTimeout(() => setPhase("fading"), 2516);
    const t2 = setTimeout(() => {
      setPhase("hidden");
      onDoneRef.current();
    }, 2816);

    return () => { clearTimeout(t0); clearTimeout(t1); clearTimeout(t2); };
  }, [achievement?.id]);

  if (phase === "hidden" || !achievement) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      <div
        className={`flex w-full max-w-sm items-start gap-3 rounded-xl border bg-background p-4 shadow-lg transition-opacity duration-300 ${
          phase === "visible" ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-lg">
          {achievement.icon ?? <Trophy className="h-4 w-4 text-muted-foreground" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Nova conquista
          </p>
          <p className="text-sm font-semibold leading-tight">{achievement.title}</p>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {achievement.description}
          </p>
        </div>
      </div>
    </div>
  );
}
