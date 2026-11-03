import AppShell, { PageHeader } from "@/components/AppShell";
import IntegrationsPanel from "@/components/IntegrationsPanel";

export default function Connectors() {
  return (
    <AppShell wide>
      <PageHeader eyebrow="Workspace integrations" title="Connectors" subtitle="Connect the tools you already use and bring your workflows together in Rohence Flow." />
      <IntegrationsPanel />
    </AppShell>
  );
}
