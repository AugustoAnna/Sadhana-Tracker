import { useState } from 'react';

import { useNavigate } from 'react-router-dom';

import { BackHeader, StickyAction, PracticeIllustration } from '@/components';

import { useAppStore } from '@/stores/appStore';

import { getPractice } from '@/data/catalogue';

import { isInstanceCompletedTwiceToday } from '@/utils/dates';

import { formatInstanceName, getInstanceOrdinalLabel } from '@/utils/instances';



export function SessionSelect() {

  const navigate = useNavigate();

  const instances = useAppStore((s) => s.instances);

  const logs = useAppStore((s) => s.logs);

  const savedSessions = useAppStore((s) => s.savedSessions);

  const sessionDraft = useAppStore((s) => s.sessionDraft);

  const setSessionDraft = useAppStore((s) => s.setSessionDraft);



  const [selected, setSelected] = useState<Set<string>>(

    new Set(sessionDraft?.practiceInstanceIds ?? []),

  );

  const [otherOpen, setOtherOpen] = useState(false);



  const availableInstances = instances.filter(

    (i) => !isInstanceCompletedTwiceToday(logs, i.id),

  );



  const allCompletedTwice = instances.length > 0 && availableInstances.length === 0;



  const primaryInstances = availableInstances.filter((i) => {

    const completedOnce = logs.some(

      (l) => l.instanceId === i.id && new Date(l.timestamp).toDateString() === new Date().toDateString(),

    );

    if (completedOnce && i.instanceNumber === 1) {

      return false;

    }

    return !completedOnce;

  });



  const otherInstances = availableInstances.filter(

    (i) => !primaryInstances.includes(i),

  );



  const toggle = (id: string) => {

    setSelected((prev) => {

      const next = new Set(prev);

      if (next.has(id)) next.delete(id);

      else next.add(id);

      return next;

    });

  };



  const handleReview = () => {

    setSessionDraft({

      practiceInstanceIds: [...selected],

      includeInvocation: true,

    });

    navigate('/session/review');

  };



  const handleSessionTap = (instanceIds: string[]) => {

    const newSelected = new Set(selected);

    for (const id of instanceIds) {

      if (!isInstanceCompletedTwiceToday(logs, id)) {

        const inst = instances.find((i) => i.id === id);

        if (!inst) continue;

        const completedOnce = logs.some(

          (l) => l.instanceId === id && new Date(l.timestamp).toDateString() === new Date().toDateString(),

        );

        if (completedOnce && inst.instanceNumber === 1) {

          const second = instances.find(

            (i) => i.practiceId === inst.practiceId && i.instanceNumber === 2,

          );

          if (second && !isInstanceCompletedTwiceToday(logs, second.id)) {

            newSelected.add(second.id);

          }

        } else if (!completedOnce) {

          newSelected.add(id);

        }

      }

    }

    setSelected(newSelected);

  };



  const hasSaved = savedSessions.length > 0;



  if (allCompletedTwice) {

    return (

      <div className="h-full flex flex-col">

        <BackHeader title="Start Session" />

        <div className="flex-1 flex items-center justify-center px-8">

          <p className="text-center text-secondary">

            You have completed every practice twice today. Come back tomorrow for a fresh session.

          </p>

        </div>

      </div>

    );

  }



  return (

    <div className="h-full flex flex-col">

      <div className="flex-1 overflow-y-auto pb-24">

        <BackHeader title="Start Session" />



        <div className="px-4 mb-6">

          <h3 className="font-semibold mb-3">{hasSaved ? 'Saved sessions' : 'Recent sessions'}</h3>

          <div className="flex gap-3 overflow-x-auto no-scrollbar">

            {savedSessions.slice(0, 3).map((session) => (

              <button

                key={session.id}

                onClick={() => handleSessionTap(session.practiceInstanceIds)}

                className="flex-shrink-0 w-24"

              >

                <SessionGrid instanceIds={session.practiceInstanceIds} />

                <p className="text-xs text-center mt-1 truncate">{session.name}</p>

              </button>

            ))}

            {!hasSaved && (

              <p className="text-sm text-muted">Complete a session to see recent sessions here.</p>

            )}

          </div>

        </div>



        <div className="px-4">

          {primaryInstances.map((inst) => {

            const p = getPractice(inst.practiceId);

            if (!p) return null;

            return (

              <SelectRow

                key={inst.id}

                name={formatInstanceName(p.name, inst, instances)}

                selected={selected.has(inst.id)}

                onToggle={() => toggle(inst.id)}

              />

            );

          })}



          {otherInstances.length > 0 && (

            <>

              <button

                onClick={() => setOtherOpen(!otherOpen)}

                className="flex items-center gap-2 w-full py-3 font-semibold text-sm"

              >

                <svg

                  width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"

                  className={`transition-transform ${otherOpen ? 'rotate-90' : ''}`}

                >

                  <path d="M9 18l6-6-6-6" />

                </svg>

                All other practices

              </button>

              {otherOpen && otherInstances.map((inst) => {

                const p = getPractice(inst.practiceId);

                if (!p) return null;

                const label = getInstanceOrdinalLabel(inst, instances);

                return (

                  <SelectRow

                    key={inst.id}

                    name={p.name}

                    instanceLabel={label ?? undefined}

                    selected={selected.has(inst.id)}

                    onToggle={() => toggle(inst.id)}

                  />

                );

              })}

            </>

          )}

        </div>

      </div>



      <StickyAction

        label="Review Session"

        count={selected.size}

        disabled={selected.size < 2}

        onClick={handleReview}

      />

    </div>

  );

}



function SelectRow({

  name, instanceLabel, selected, onToggle,

}: {

  name: string;

  instanceLabel?: string;

  selected: boolean;

  onToggle: () => void;

}) {

  return (

    <button

      onClick={onToggle}

      className="flex items-center gap-3 py-3 w-full border-b border-border"

    >

      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${

        selected ? 'bg-primary border-primary' : 'border-border'

      }`}>

        {selected && (

          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">

            <path d="M5 13l4 4L19 7" />

          </svg>

        )}

      </div>

      <PracticeIllustration size={36} />

      <div className="text-left">

        <p className="font-medium text-sm">{name}</p>

        {instanceLabel && (

          <p className="text-xs text-muted capitalize">{instanceLabel}</p>

        )}

      </div>

    </button>

  );

}



function SessionGrid({ instanceIds }: { instanceIds: string[] }) {

  const ids = instanceIds.slice(0, 9);

  const remaining = instanceIds.length - 9;



  return (

    <div className="w-20 h-20 bg-white rounded-xl border border-border p-1 grid grid-cols-2 gap-0.5 relative">

      {ids.map((id) => (

          <div key={id} className="rounded bg-amber-100 flex items-center justify-center">

            <PracticeIllustration size={20} />

          </div>

        ))}

      {remaining > 0 && (

        <div className="absolute bottom-1 right-1 bg-primary text-white text-[10px] font-bold rounded px-1">

          +{remaining}

        </div>

      )}

    </div>

  );

}


