import type { Metadata } from 'next';
import { Brand } from '../../components/brand';
import { VehicleForm } from '../../components/vehicle-form';
import { serverApi } from '../../lib/server-api';
export const metadata: Metadata = { title: 'Your van' };
export default async function OnboardingPage() {
  await serverApi('/auth/me');
  return <main className="onboarding-page"><header><Brand/><span className="step">Step 1 of 1</span></header><div className="onboarding-copy"><p className="eyebrow">ONE MINUTE SETUP</p><h1>Your van</h1><p className="lead">Tell us what fits. We’ll keep every suggestion inside your real capacity.</p></div><VehicleForm onboarding/></main>;
}
