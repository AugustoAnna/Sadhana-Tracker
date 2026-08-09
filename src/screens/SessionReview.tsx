import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { BackHeader, Toggle, Modal, BottomSheet, Button, TextInput, PracticeIllustration } from '@/components';
import { useAppStore } from '@/stores/appStore';
import { getPractice } from '@/data/catalogue';

export function SessionReview() {
  const navigate = useNavigate();
  const sessionDraft = useAppStore((s) => s.sessionDraft);
  const setSessionDraft = useAppStore((s) => s.setSessionDraft);
  const setPlayerSession = useAppStore((s) => s.setPlayerSession);
  const saveSession = useAppStore((s) => s.saveSession);
  const showToast = useAppStore((s) => s.showToast);
  const instances = useAppStore((s) => s.instances);

  const [orderedIds, setOrderedIds] = useState<string[]>(
    sessionDraft?.practiceInstanceIds ?? [],
  );
  const [includeInvocation, setIncludeInvocation] = useState(
    sessionDraft?.includeInvocation ?? true,
  );
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [sessionName, setSessionName] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setOrderedIds((ids) => {
        const oldIndex = ids.indexOf(active.id as string);
        const newIndex = ids.indexOf(over.id as string);
        return arrayMove(ids, oldIndex, newIndex);
      });
    }
  };

  const handleRemove = (id: string) => {
    setRemoveId(id);
  };

  const confirmRemove = () => {
    if (removeId) {
      setOrderedIds((ids) => ids.filter((i) => i !== removeId));
      setRemoveId(null);
    }
  };

  const handleStart = () => {
    setPlayerSession({ practiceInstanceIds: orderedIds, includeInvocation });
    navigate('/player');
  };

  const handleSave = () => {
    const defaultName = generateSessionName(orderedIds);
    setSessionName(defaultName);
    setSaveOpen(true);
  };

  const confirmSave = async () => {
    await saveSession(sessionName || generateSessionName(orderedIds), orderedIds);
    setSaveOpen(false);
    showToast('Session saved');
  };

  const availableToAdd = instances.filter((i) => !orderedIds.includes(i.id));

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto pb-32">
        <BackHeader title="Review session" />
        <p className="px-4 text-label text-secondary mb-4">
          Reorder your practices, or add and remove them.
        </p>

        <div className="px-4 flex items-center justify-between py-3 border-b border-border">
          <span className="text-body">Start and end the session with invocation</span>
          <Toggle checked={includeInvocation} onChange={setIncludeInvocation} />
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
            <div className="px-4">
              {orderedIds.map((id) => {
                const inst = instances.find((i) => i.id === id);
                const p = inst ? getPractice(inst.practiceId) : null;
                if (!p) return null;
                return (
                  <SortableItem
                    key={id}
                    id={id}
                    name={p.name}
                    practiceId={p.id}
                    onRemove={() => handleRemove(id)}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>

        {availableToAdd.length > 0 && (
          <button
            onClick={() => {
              setSessionDraft({ practiceInstanceIds: orderedIds, includeInvocation });
              navigate('/session/select');
            }}
            className="mx-4 mt-2 flex items-center gap-3 py-3 w-[calc(100%-2rem)] border border-dashed border-primary rounded-xl px-4 text-primary font-medium"
          >
            <span className="w-8 h-8 rounded-full border-2 border-primary flex items-center justify-center">+</span>
            Add practice
          </button>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-page/95 backdrop-blur-sm border-t border-hairline px-4 py-3 safe-bottom z-50">
        <button
          onClick={handleSave}
          className="w-full py-2 text-primary text-meta mb-2 min-h-11"
        >
          Save this session
        </button>
        <button
          onClick={handleStart}
          disabled={orderedIds.length === 0}
          className="w-full py-3.5 min-h-11 rounded-xl bg-primary text-white font-semibold disabled:opacity-40"
        >
          Start session
        </button>
      </div>

      <Modal
        open={!!removeId}
        title="Remove practice?"
        message="This will remove the practice from this session only."
        confirmLabel="Remove"
        onConfirm={confirmRemove}
        onCancel={() => setRemoveId(null)}
      />

      <BottomSheet open={saveOpen} onClose={() => setSaveOpen(false)} title="Name this session">
        <TextInput
          value={sessionName}
          onChange={(e) => setSessionName(e.target.value)}
          label="Session name"
        />
        <Button fullWidth className="mt-4" onClick={confirmSave}>Save</Button>
      </BottomSheet>
    </div>
  );
}

function SortableItem({ id, name, practiceId, onRemove }: { id: string; name: string; practiceId: string; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 py-3 border-b border-hairline bg-card px-3 first:rounded-t-[14px] last:rounded-b-[14px] last:border-0">
      <button {...attributes} {...listeners} className="touch-none p-2 min-h-11">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--color-muted)">
          <circle cx="8" cy="6" r="2" /><circle cx="16" cy="6" r="2" />
          <circle cx="8" cy="12" r="2" /><circle cx="16" cy="12" r="2" />
          <circle cx="8" cy="18" r="2" /><circle cx="16" cy="18" r="2" />
        </svg>
      </button>
      <PracticeIllustration practiceId={practiceId} size={40} />
      <p className="flex-1 text-body">{name}</p>
      <button onClick={onRemove} className="text-error w-11 h-11 flex items-center justify-center">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14" />
        </svg>
      </button>
    </div>
  );
}

function generateSessionName(instanceIds: string[]): string {
  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
  return `${timeOfDay} · ${instanceIds.length} practices`;
}
