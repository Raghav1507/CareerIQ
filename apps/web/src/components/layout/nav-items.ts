import {
  Briefcase,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  Map,
  Settings,
  Sparkles,
  Target,
  UserRound,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
};

export const mainNav: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    description: "Career intelligence overview",
  },
  {
    href: "/resume",
    label: "Resume Analysis",
    icon: FileText,
    description: "Upload and extract your resume",
  },
  {
    href: "/recommendations",
    label: "Recommendations",
    icon: Sparkles,
    description: "Personalised career roles",
  },
  {
    href: "/roles",
    label: "Career Roles",
    icon: Briefcase,
    description: "The ten technical roles",
  },
  {
    href: "/skill-gap",
    label: "Skill Gap",
    icon: Target,
    description: "Gap analysis for a target role",
  },
  {
    href: "/roadmap",
    label: "Learning Roadmap",
    icon: Map,
    description: "Personalised learning plan",
  },
  {
    href: "/job-analyzer",
    label: "Job Analyzer",
    icon: ClipboardCheck,
    description: "Job description compatibility",
  },
];

export const secondaryNav: NavItem[] = [
  {
    href: "/onboarding",
    label: "Career Profile",
    icon: UserRound,
    description: "Education, skills and goals",
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    description: "Account and preferences",
  },
];
