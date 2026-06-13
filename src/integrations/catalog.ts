import type { IntegrationCatalogEntry } from "@/src/integrations/types";

export const INTEGRATION_CATALOG: readonly IntegrationCatalogEntry[] = [
  {
    id: "gmail",
    name: "Gmail",
    description:
      "Connect Gmail to monitor inbox activity, filter incoming emails, trigger workflows, and send AI-generated messages.",
    category: "Email",
    isAvailable: true,
    comingSoon: false,
    permissions: [
      "Read email metadata and content",
      "Send emails on your behalf",
      "Modify labels and read status",
      "View your email address",
    ],
    logoColor: "#EA4335",
  },
  {
    id: "outlook",
    name: "Outlook",
    description: "Monitor Outlook inbox, automate responses, and send emails through Microsoft 365.",
    category: "Email",
    isAvailable: false,
    comingSoon: true,
    permissions: ["Read mail", "Send mail"],
    logoColor: "#0078D4",
  },
  {
    id: "slack",
    name: "Slack",
    description: "Send messages, monitor channels, and trigger workflows from Slack events.",
    category: "Communication",
    isAvailable: false,
    comingSoon: true,
    permissions: ["Read messages", "Post messages"],
    logoColor: "#4A154B",
  },
  {
    id: "microsoft_teams",
    name: "Microsoft Teams",
    description: "Integrate Teams channels and notifications into agent workflows.",
    category: "Communication",
    isAvailable: false,
    comingSoon: true,
    permissions: ["Read messages", "Send messages"],
    logoColor: "#6264A7",
  },
  {
    id: "google_drive",
    name: "Google Drive",
    description: "Access, search, and manage files in Google Drive from your agents.",
    category: "Storage",
    isAvailable: false,
    comingSoon: true,
    permissions: ["Read files", "Write files"],
    logoColor: "#4285F4",
  },
  {
    id: "notion",
    name: "Notion",
    description: "Read and update Notion pages and databases from agent workflows.",
    category: "Productivity",
    isAvailable: false,
    comingSoon: true,
    permissions: ["Read content", "Update content"],
    logoColor: "#000000",
  },
  {
    id: "hubspot",
    name: "HubSpot",
    description: "Sync contacts, deals, and tickets with HubSpot CRM.",
    category: "CRM",
    isAvailable: false,
    comingSoon: true,
    permissions: ["Read CRM records", "Update CRM records"],
    logoColor: "#FF7A59",
  },
];

export function getCatalogEntry(providerId: string): IntegrationCatalogEntry | undefined {
  return INTEGRATION_CATALOG.find((entry) => entry.id === providerId);
}
