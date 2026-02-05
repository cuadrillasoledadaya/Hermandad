import { OfflineTestPanel } from '@/components/test/offline-test-panel';

export const metadata = {
  title: 'Test Offline - Dexie',
  description: 'Panel de pruebas del sistema offline con Dexie.js',
};

export default function TestOfflinePage() {
  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <OfflineTestPanel />
    </main>
  );
}
