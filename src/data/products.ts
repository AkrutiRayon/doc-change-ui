import akana from "@/assets/logos/akana.png";
import blazemeter from "@/assets/logos/blazemeter.png";
import p4 from "@/assets/logos/p4.png";
import perfecto from "@/assets/logos/perfecto.png";
import puppet from "@/assets/logos/puppet.png";

export type Product = {
  id: string;
  name: string;
  description: string;
  category: string;
  logo: string;
};

export const products: Product[] = [
  {
    id: "akana",
    name: "Akana",
    description: "Full Lifecycle API Management",
    category: "API Management",
    logo: akana,
  },
  {
    id: "blazemeter",
    name: "BlazeMeter",
    description: "The Complete Continuous Testing Platform",
    category: "Testing",
    logo: blazemeter,
  },
  {
    id: "p4",
    name: "P4",
    description: "Version Control + Code Review",
    category: "Version Control",
    logo: p4,
  },
  {
    id: "perfecto",
    name: "Perfecto",
    description: "Web and Mobile App Testing",
    category: "Testing",
    logo: perfecto,
  },
  {
    id: "puppet",
    name: "Puppet",
    description: "Infrastructure Automation & Compliance",
    category: "Infrastructure",
    logo: puppet,
  },
];

export const getProduct = (id: string) => products.find((p) => p.id === id);

export type DocTag = "added" | "updated" | "critical" | "release_notes";

export type DocUpdate = {
  id: string;
  title: string;
  tag: DocTag;
  whatChanged: string;
  createdAt: string;
  link: string;
};

const hoursAgo = (n: number) =>
  new Date(Date.now() - n * 3600000).toISOString();

export const updatesByProduct: Record<string, DocUpdate[]> = {
  akana: [
    {
      id: "a1",
      title: "API Gateway policy reference",
      tag: "updated",
      whatChanged:
        "Clarified rate-limiting policy evaluation order and added examples for composite policies applied at the listener level.",
      createdAt: hoursAgo(3),
      link: "#",
    },
    {
      id: "a2",
      title: "Breaking change: legacy OAuth endpoints removed",
      tag: "critical",
      whatChanged:
        "The /oauth/v1 token endpoints are removed in the next release. Migrate integrations to /oauth/v2 which requires PKCE for public clients and returns rotated refresh tokens.",
      createdAt: hoursAgo(30),
      link: "#",
    },
  ],
  blazemeter: [
    {
      id: "b1",
      title: "Mock Services quick start",
      tag: "added",
      whatChanged:
        "New end-to-end walkthrough for creating a transaction-based mock service and binding it to a functional test suite.",
      createdAt: hoursAgo(8),
      link: "#",
    },
    {
      id: "b2",
      title: "Release notes — 2026.7",
      tag: "release_notes",
      whatChanged:
        "Performance test reports now include percentile breakdowns per label, and shared folders support nested permissions.",
      createdAt: hoursAgo(72),
      link: "#",
    },
  ],
  p4: [
    {
      id: "p1",
      title: "Helix Core server deployment guide",
      tag: "updated",
      whatChanged:
        "Updated recommended filesystem layout for large depots and refreshed guidance on journal rotation intervals.",
      createdAt: hoursAgo(12),
      link: "#",
    },
    {
      id: "p2",
      title: "p4 switch command reference",
      tag: "added",
      whatChanged: "Documented the new --reopen flag with worked examples.",
      createdAt: hoursAgo(50),
      link: "#",
    },
  ],
  perfecto: [
    {
      id: "pf1",
      title: "Mobile device cloud capabilities",
      tag: "updated",
      whatChanged:
        "Refreshed the supported capabilities matrix for iOS 19 and Android 17 devices, including new biometric simulation options.",
      createdAt: hoursAgo(5),
      link: "#",
    },
    {
      id: "pf2",
      title: "Release notes — August 2026",
      tag: "release_notes",
      whatChanged:
        "Smart reporting adds flakiness scoring across executions and a new CI plugin for GitHub Actions.",
      createdAt: hoursAgo(96),
      link: "#",
    },
  ],
  puppet: [
    {
      id: "pu1",
      title: "Compliance Enforcement modules",
      tag: "added",
      whatChanged:
        "New module catalog covering CIS benchmark enforcement for RHEL 10 and Windows Server 2025.",
      createdAt: hoursAgo(20),
      link: "#",
    },
    {
      id: "pu2",
      title: "Deprecation: legacy node classifier API",
      tag: "critical",
      whatChanged:
        "The v1 node classifier API is deprecated and will be removed. Update automation to use the v2 groups endpoint.",
      createdAt: hoursAgo(120),
      link: "#",
    },
  ],
};
