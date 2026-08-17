import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, TextInput } from '@/components';
import { useAppStore } from '@/stores/appStore';

export function EditName() {
  const profile = useAppStore((s) => s.profile);
  const setNameStore = useAppStore((s) => s.setName);
  const navigate = useNavigate();
  const [name, setName] = useState(profile?.name ?? '');

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    const update = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      root.style.setProperty('--keyboard-inset', `${inset}px`);
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      root.style.removeProperty('--keyboard-inset');
    };
  }, []);

  const handleSave = async () => {
    await setNameStore(name.trim());
    navigate(-1);
  };

  return (
    <div className="flex flex-col h-full bg-page">
      <div className="flex-1 overflow-y-auto px-4 pt-14">
        <h1 className="font-serif text-display mb-6">Add your name</h1>
        <p className="text-label text-secondary mb-6">
          Your current profile shows as Anonymous. Enter your real name so you appear correctly.
        </p>
        <TextInput
          label="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </div>
      <div className="shrink-0 px-4 pb-4 safe-bottom border-t border-hairline pt-3" style={{ paddingBottom: 'calc(1rem + var(--keyboard-inset, 0px))' }}>
        <Button fullWidth disabled={name.trim().length === 0} onClick={handleSave}>
          Save
        </Button>
      </div>
    </div>
  );
}
