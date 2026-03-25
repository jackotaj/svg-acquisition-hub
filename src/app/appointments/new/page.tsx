import { Suspense } from 'react';
import NewAppointmentForm from './NewAppointmentForm';

export default function NewAppointmentPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-500">Loading...</div>}>
      <NewAppointmentForm />
    </Suspense>
  );
}
