import NurseProfileSummaryView from "./nurses/NurseProfileSummaryView";

export default function MarketingProfileView() {
  return (
    <NurseProfileSummaryView
      meUrl="/api/reception/me"
      showLogout
      roleLabel="Маркетинг"
    />
  );
}
