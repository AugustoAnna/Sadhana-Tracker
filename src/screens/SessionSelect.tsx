import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackHeader, StickyAction, PracticeIllustration } from '@/components';
import { useAppStore } from '@/stores/appStore';
import { getPractice } from '@/data/catalogue';
import { isInstanceCompletedTwiceToday } from '@/utils/dates';
import { formatInstanceName, getInstanceSuffix } from '@/utils/instances';

export function SessionSelect() {
  const navigate = useNavigate();
  const instances = useAppStore((s) => s.instances);
  const logs = useAppStore((s) => s.logs);
  const savedSessions = useAppStore((s) => s.savedSessions);
  const setSessionDraft = useAppStore((s) => s.setSessionDraft);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [otherOpen, setOtherOpen] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const availableInstances = instances.filter(
    (i) => !isInstanceCompletedTwiceToday(logs, i.id),
  );

  const primaryInstances = availableInstances.filter((i) => {
    const completedOnce = logs.some(
      (l) => l.instanceId === i.id && new Date(l.timestamp).toDateString() === new Date().toDateString(),
    );
    if (completedOnce && i.instanceNumber === 1) return false;
    return !completedOnce;
  });

  const otherInstances = availableInstances.filter((i) => !primaryInstances.includes(i));

  const toggle = (id: string) => {
    setActiveSessionId(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleReview = () => {
    setSessionDraft({ practiceInstanceIds: [...selected], includeInvocation: true });
    navigate('/session/review');
  };

  const handleSessionTap = (sessionId: string, instanceIds: string[]) => {
    setActiveSessionId(sessionId);
    const newSelected = new Set<string>();
    let needsExpand = false;
    for (const id of instanceIds) {
      if (!isInstanceCompletedTwiceToday(logs, id)) {
        const inst = instances.find((i) => i.id === id);
        if (!inst) continue;
        if (otherInstances.some((o) => o.id === id)) needsExpand = true;
        newSelected.add(id);
      }
    }
    if (needsExpand) setOtherOpen(true);
    setSelected(newSelected);
  };

  const hasSaved = savedSessions.length > 0;

  return (
    <div className="h-full flex flex-col bg-page">
      <div className="flex-1 overflow-y-auto pb-24">
        <BackHeader title="Start session" />
        <p className="px-4 text-label text-secondary mb-6">
          Select the practices you want to do in this session.
        </p>

        {hasSaved && (
          <div className="px-4 mb-6">
            <p className="eyebrow mb-3">Saved sessions</p>
            <div className="flex gap-3 overflow-x-auto no-scrollbar">
              {savedSessions.slice(0, 3).map((session) => (
                <button
                  key={session.id}
                  onClick={() => handleSessionTap(session.id, session.practiceInstanceIds)}
                  className={`flex-shrink-0 w-24 rounded-[12px] p-1 ${
                    activeSessionId === session.id ? 'ring-2 ring-primary' : ''
                  }`}
                >
                  <SessionGrid instanceIds={session.practiceInstanceIds} instances={instances} />
                  <p className="text-label text-center mt-1.5 truncate">{session.name}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="px-4">
          {primaryInstances.length > 0 && (
            <>
              <p className="eyebrow mb-2">Practices</p>
              <div className="bg-card rounded-[14px] px-3 mb-4">
                {primaryInstances.map((inst) => {
                  const p = getPractice(inst.practiceId);
                  if (!p) return null;
                  return (
                    <SelectRow
                      key={inst.id}
                      practiceId={p.id}
                      name={formatInstanceName(p.name, inst, instances)}
                      selected={selected.has(inst.id)}
                      onToggle={() => toggle(inst.id)}
                    />
                  );
                })}
              </div>
            </>
          )}

          {otherInstances.length > 0 && (
            <>
              <button
                onClick={() => setOtherOpen(!otherOpen)}
                className="flex items-center gap-2 w-full py-3 text-title"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  className={`transition-transform ${otherOpen ? 'rotate-90' : ''}`}>
                  <path d="M9 18l6-6-6-6" />
                </svg>
                All other practices
              </button>
              {otherOpen && (
                <div className="bg-card rounded-[14px] px-3">
                  {otherInstances.map((inst) => {
                    const p = getPractice(inst.practiceId);
                    if (!p) return null;
                    const suffix = getInstanceSuffix(inst, instances);
                    return (
                      <SelectRow
                        key={inst.id}
                        practiceId={p.id}
                        name={suffix ? `${p.name} ${suffix}` : p.name}
                        selected={selected.has(inst.id)}
                        onToggle={() => toggle(inst.id)}
                      />
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <StickyAction
        label="Review session"
        count={selected.size}
        disabled={selected.size < 1}
        onClick={handleReview}
      />
    </div>
  );
}

function SelectRow({ practiceId, name, selected, onToggle }: {
  practiceId: string; name: string; selected: boolean; onToggle: () => void;
}) {
  return (
    <button onClick={onToggle} className="flex items-center gap-3 py-3 w-full border-b border-hairline last:border-0">
      <div className={`w-5 h-5 rounded-[7px] border-2 flex items-center justify-center flex-shrink-0 ${
        selected ? 'bg-primary border-primary' : 'border-border'
      }`}>
        {selected && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
            <path d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <PracticeIllustration practiceId={practiceId} size={40} />
      <p className="text-body truncate text-left">{name}</p>
    </button>
  );
}

function SessionGrid({ instanceIds, instances }: { instanceIds: string[]; instances: { id: string; practiceId: string }[] }) {
  const ids = instanceIds.slice(0, 9);
  return (
    <div className="w-20 h-20 bg-card rounded-[12px] border border-border p-1 grid grid-cols-3 gap-0.5">
      {ids.map((id) => {
        const inst = instances.find((i) => i.id === id);
        return (
          <div key={id} className="rounded-[4px] overflow-hidden flex items-center justify-center">
            <PracticeIllustration practiceId={inst?.practiceId ?? id} size={22} />
          </div>
        );
      })}
    </div>
  );
}
