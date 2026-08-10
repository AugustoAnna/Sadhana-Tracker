import instrumentationMd from '../../docs/instrumentation.md?raw';

export function InstrumentationPage() {
  return (
    <div className="h-full overflow-y-auto bg-page px-4 py-8 prose prose-sm max-w-none">
      <pre className="whitespace-pre-wrap font-sans text-body text-ink">{instrumentationMd}</pre>
    </div>
  );
}
