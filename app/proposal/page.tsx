import type { Metadata } from "next";
import { ProposalApp } from "@/components/proposal/ProposalApp";
import "./proposal.css";

export const metadata: Metadata = {
  title: "Andrew Porter Fine Clothiers — Pricing Proposal",
  description: "Sirrom Studios pricing configuration and client proposal for Andrew Porter Fine Clothiers.",
  robots: { index: false, follow: false },
};

/* Standalone page: lives outside the (desk) route group, so it has no workspace nav. */
export default function ProposalPage() {
  return <ProposalApp />;
}
