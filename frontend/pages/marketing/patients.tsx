// frontend/pages/marketing/patients.tsx
// Marketing portal — patient list page.
// Marketing layout is applied globally by _app.tsx for /marketing/* routes.

import PatientsIndexPage from "../../components/patients/PatientsIndexPage";

export default function MarketingPatientsPage() {
  return (
    <PatientsIndexPage
      showSummaryCards={false}
      patientProfileBasePath="/marketing/patients"
      isReceptionContext
      containerClassName="w-full px-3 sm:px-4 lg:px-6 py-4 font-sans"
    />
  );
}
