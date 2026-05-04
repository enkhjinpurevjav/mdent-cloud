import React from "react";
import ReceptionLayout from "./ReceptionLayout";

type Props = {
  children: React.ReactNode;
  wide?: boolean;
};

export default function MarketingLayout({ children, wide }: Props) {
  return (
    <ReceptionLayout wide={wide} portalType="marketing">
      {children}
    </ReceptionLayout>
  );
}
