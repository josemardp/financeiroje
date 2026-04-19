import { useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useScope } from '@/contexts/ScopeContext';
import { supabase } from '@/integrations/supabase/client';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const ENGAGEMENT_TABLE = 'user_engagement_events' as const;

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type EngagementEventType =
  | 'screen_view'
  | 'time_on_page'
  | 'field_hovered'
  | 'mirror_hesitation';

export interface TrackEventParams {
  event_type: EngagementEventType;
  target_id?: string;
  context_data?: Record<string, unknown>;
}

interface EngagementEventRow {
  user_id: string;
  event_type: EngagementEventType;
  target_id?: string;
  context_data: Record<string, unknown>;
  scope: 'private' | 'family' | 'business';
}

// ---------------------------------------------------------------------------
// Camada de persistência isolada
// Único ponto de acoplamento com Supabase.
// ---------------------------------------------------------------------------

function persistEvent(row: EngagementEventRow): void {
  if (import.meta.env.DEV) return;
  // Fire-and-forget — nunca bloqueia UI, falhas são silenciosas (telemetria)
  supabase.from(ENGAGEMENT_TABLE).insert(row).then(() => {});
}

// ---------------------------------------------------------------------------
// useBehaviorTracking — hook base
// Responsabilidade: enriquecer e gravar um evento pontual.
// ---------------------------------------------------------------------------

export function useBehaviorTracking() {
  const { user } = useAuth();
  const { currentScope } = useScope();

  const trackEvent = useCallback(
    ({ event_type, target_id, context_data = {} }: TrackEventParams): void => {
      if (!user) return;

      const now = new Date();
      const enriched: Record<string, unknown> = {
        ...context_data,
        dayOfWeek: now.getDay(),
        hourOfDay: now.getHours(),
      };

      persistEvent({
        user_id: user.id,
        event_type,
        target_id,
        context_data: enriched,
        scope: currentScope === 'all' ? 'private' : currentScope,
      });
    },
    [user, currentScope],
  );

  return { trackEvent };
}

// ---------------------------------------------------------------------------
// useScreenTracking — hook derivado
// Responsabilidade: emitir screen_view no mount e time_on_page no unmount.
// ---------------------------------------------------------------------------

export function useScreenTracking(screenName: string): void {
  const { trackEvent } = useBehaviorTracking();

  // Ref garante que o cleanup usa a versão mais recente de trackEvent,
  // mesmo que user ou currentScope mudem durante a visita.
  const trackRef = useRef(trackEvent);
  trackRef.current = trackEvent;

  useEffect(() => {
    trackRef.current({ event_type: 'screen_view', context_data: { screenName } });

    const enter = Date.now();

    return () => {
      const durationMs = Date.now() - enter;
      // Ignora visitas < 2s: navegação acidental e renders do StrictMode em dev.
      if (durationMs > 2000) {
        trackRef.current({
          event_type: 'time_on_page',
          context_data: { screenName, durationMs },
        });
      }
    };
  }, [screenName]);
}
