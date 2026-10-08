import { greeting } from '@/lib/greeting';

export const dynamic = 'force-dynamic';

export default function Home() {
  return (
    <main>
      <h1>{greeting(new Date().getUTCHours())}</h1>
      <p>A small app that the software factory works on.</p>
    </main>
  );
}
