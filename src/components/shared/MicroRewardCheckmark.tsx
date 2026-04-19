import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

interface Props {
  show: boolean;
  onDone: () => void;
}

type Phase = "hidden" | "mounting" | "visible" | "fading";

export function MicroRewardCheckmark({ show, onDone }: Props) {
  const [phase, setPhase] = useState<Phase>("hidden");
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (!show) return;

    setPhase("mounting");                                          // renderiza em opacity-0
    const t0 = setTimeout(() => setPhase("visible"), 16);         // fade-in (~1 frame)
    const t1 = setTimeout(() => setPhase("fading"), 616);         // inicia fade-out após 600ms visível
    const t2 = setTimeout(() => {
      setPhase("hidden");
      onDoneRef.current();
    }, 916);                                                       // desmonta após 300ms de fade-out

    return () => { clearTimeout(t0); clearTimeout(t1); clearTimeout(t2); };
  }, [show]);

  if (phase === "hidden") return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center pb-24">
      <div
        className={`flex items-center justify-center rounded-full bg-muted p-4 shadow-md transition-opacity duration-300 ${
          phase === "visible" ? "opacity-100" : "opacity-0"
        }`}
      >
        <Check className="h-8 w-8 stroke-[3] text-foreground" />
      </div>
    </div>
  );
}
