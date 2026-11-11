"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Plus, Save, Search, Sparkles, Trash2, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch, ApiException } from "@/lib/api";
import { normalizeSkillName } from "@/lib/utils";
import type { EducationEntry, ExperienceLevel, ProfileRow, SkillCategory } from "@/types/db";

type CatalogSkill = {
  id: string;
  slug: string;
  name: string;
  category: SkillCategory;
  aliases: string[];
};

type OwnedSkill = {
  skill_id: string;
  slug: string;
  name: string;
  category: SkillCategory;
  proficiency: string;
};

type Props = {
  profile: ProfileRow | null;
  catalog: CatalogSkill[];
  owned: OwnedSkill[];
  roles: Array<{ slug: string; name: string }>;
};

const LEVELS: Array<{ value: ExperienceLevel; label: string }> = [
  { value: "entry", label: "Entry" },
  { value: "junior", label: "Junior" },
  { value: "mid", label: "Mid" },
  { value: "senior", label: "Senior" },
  { value: "lead", label: "Lead" },
];

const emptyEducation = (): EducationEntry => ({ degree: "", field: "", institution: "", start: "", end: "" });

function ChipList({
  items,
  onRemove,
  onAdd,
  placeholder,
}: {
  items: string[];
  onRemove: (v: string) => void;
  onAdd: (v: string) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = React.useState("");
  function add() {
    const v = draft.trim();
    if (!v) return;
    if (!items.includes(v)) onAdd(v);
    setDraft("");
  }
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={add}>
          <Plus className="h-4 w-4" aria-hidden />
          Add
        </Button>
      </div>
      {items.length ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <Badge key={item} variant="secondary" className="gap-1 pr-1.5">
              {item}
              <button
                type="button"
                aria-label={`Remove ${item}`}
                className="ml-0.5 rounded-full p-0.5 hover:bg-background/60"
                onClick={() => onRemove(item)}
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Nothing added yet.</p>
      )}
    </div>
  );
}

function SkillsPicker({
  catalog,
  owned,
  onAdd,
  onRemove,
}: {
  catalog: CatalogSkill[];
  owned: OwnedSkill[];
  onAdd: (skill: { skill_id?: string; name?: string; proficiency: string }) => Promise<void>;
  onRemove: (skillId: string) => Promise<void>;
}) {
  const [search, setSearch] = React.useState("");
  const [proficiency, setProficiency] = React.useState("intermediate");
  const [busy, setBusy] = React.useState<string | null>(null);

  const norm = normalizeSkillName(search);

  const matches = React.useMemo(() => {
    if (!norm) return [];
    const ownedIds = new Set(owned.map((s) => s.skill_id));
    return catalog
      .filter(
        (s) =>
          !ownedIds.has(s.id) &&
          (normalizeSkillName(s.slug).includes(norm) ||
            normalizeSkillName(s.name).includes(norm) ||
            s.aliases.some((a) => normalizeSkillName(a).includes(norm)))
      )
      .slice(0, 8);
  }, [norm, catalog, owned]);

  const exactCustom =
    norm && !catalog.some((s) => normalizeSkillName(s.slug) === norm || normalizeSkillName(s.name) === norm);

  async function add(skill: { skill_id?: string; name?: string }) {
    setBusy(skill.skill_id ?? skill.name ?? "x");
    try {
      await onAdd({ ...skill, proficiency });
      setSearch("");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="skill-search">Search the 78-skill catalogue</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
            <Input
              id="skill-search"
              className="pl-8"
              placeholder="React, PostgreSQL, Docker…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Proficiency</Label>
          <Select value={proficiency} onValueChange={setProficiency}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="beginner">Beginner</SelectItem>
              <SelectItem value="intermediate">Intermediate</SelectItem>
              <SelectItem value="advanced">Advanced</SelectItem>
              <SelectItem value="expert">Expert</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {search.trim() && matches.length ? (
        <div className="flex flex-wrap gap-2">
          {matches.map((s) => (
            <Button
              key={s.id}
              type="button"
              size="sm"
              variant="outline"
              disabled={busy !== null}
              onClick={() => add({ skill_id: s.id })}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              {s.name}
              <span className="text-muted-foreground">· {s.category.replace("_", "/")}</span>
            </Button>
          ))}
          {exactCustom ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy !== null}
              onClick={() => add({ name: search.trim() })}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Add “{search.trim()}” as a custom skill
            </Button>
          ) : null}
        </div>
      ) : search.trim() ? (
        <p className="text-sm text-muted-foreground">No catalogue match — add it as a custom skill above.</p>
      ) : null}

      <Separator />

      <div>
        <h3 className="mb-2 text-sm font-semibold">
          Your skills <Badge variant="muted">{owned.length}</Badge>
        </h3>
        {owned.length === 0 ? (
          <p className="text-sm text-muted-foreground">No skills yet — search above to add your first.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {owned.map((s) => (
              <Badge key={s.skill_id} variant="outline" className="gap-1 pr-1.5">
                {s.name}
                <span className="text-muted-foreground">· {s.proficiency}</span>
                <button
                  type="button"
                  aria-label={`Remove ${s.name}`}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-muted"
                  disabled={busy === s.skill_id}
                  onClick={async () => {
                    setBusy(s.skill_id);
                    try {
                      await onRemove(s.skill_id);
                    } finally {
                      setBusy(null);
                    }
                  }}
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function ProfileEditor({ profile, catalog, owned, roles }: Props) {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [skills, setSkills] = React.useState<OwnedSkill[]>(owned);

  const [headline, setHeadline] = React.useState(profile?.headline ?? "");
  const [summary, setSummary] = React.useState(profile?.summary ?? "");
  const [experienceLevel, setExperienceLevel] = React.useState<ExperienceLevel>(
    profile?.experience_level ?? "entry"
  );
  const [years, setYears] = React.useState(String(profile?.years_experience ?? 0));
  const [location, setLocation] = React.useState(profile?.location ?? "");
  const [education, setEducation] = React.useState<EducationEntry[]>(
    profile?.education?.length ? profile.education : [emptyEducation()]
  );
  const [interests, setInterests] = React.useState<string[]>(profile?.interests ?? []);
  const [goals, setGoals] = React.useState<string[]>(profile?.career_goals ?? []);
  const [targetRole, setTargetRole] = React.useState(profile?.target_role_slug ?? "");
  const [preferred, setPreferred] = React.useState<string[]>(profile?.preferred_roles ?? []);

  async function saveProfile() {
    setSaving(true);
    try {
      await apiFetch("/api/profile", {
        method: "POST",
        body: JSON.stringify({
          headline: headline.trim() || null,
          summary: summary.trim() || null,
          education: education.filter((e) => e.degree || e.institution || e.field),
          interests,
          career_goals: goals,
          experience_level: experienceLevel,
          years_experience: Number(years) || 0,
          location: location.trim() || null,
          preferred_roles: preferred,
          target_role_slug: targetRole || null,
        }),
      });
      toast.success("Profile saved", { description: "Recommendations can now use your details." });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiException ? err.message : "Could not save the profile.");
    } finally {
      setSaving(false);
    }
  }

  async function addSkill(input: { skill_id?: string; name?: string; proficiency: string }) {
    try {
      const res = await apiFetch<{ skill: OwnedSkill & { skill_id: string } }>("/api/profile/skills", {
        method: "POST",
        body: JSON.stringify(input),
      });
      setSkills((prev) =>
        prev.some((s) => s.skill_id === res.skill.skill_id)
          ? prev.map((s) => (s.skill_id === res.skill.skill_id ? { ...s, proficiency: res.skill.proficiency } : s))
          : [...prev, res.skill]
      );
      toast.success(`Added ${res.skill.name}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiException ? err.message : "Could not add the skill.");
    }
  }

  async function removeSkill(skillId: string) {
    try {
      await apiFetch(`/api/profile/skills?skill_id=${skillId}`, { method: "DELETE" });
      setSkills((prev) => prev.filter((s) => s.skill_id !== skillId));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiException ? err.message : "Could not remove the skill.");
    }
  }

  function updateEducation(index: number, patch: Partial<EducationEntry>) {
    setEducation((prev) => prev.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  }

  function togglePreferred(slug: string) {
    setPreferred((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserRound className="h-4 w-4 text-primary" aria-hidden />
          Profile editor
        </CardTitle>
        <CardDescription>
          Everything here feeds the recommendation engine. Skills save immediately; other details save when you
          press Save.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="basics">
          <TabsList className="mb-4">
            <TabsTrigger value="basics">Basics</TabsTrigger>
            <TabsTrigger value="education">Education</TabsTrigger>
            <TabsTrigger value="skills">Skills ({skills.length})</TabsTrigger>
            <TabsTrigger value="goals">Interests & goals</TabsTrigger>
          </TabsList>

          <TabsContent value="basics" className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="headline">Headline</Label>
              <Input
                id="headline"
                placeholder="Final-year CSE student · Aspiring backend engineer"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                maxLength={160}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="summary">Summary</Label>
              <Textarea
                id="summary"
                placeholder="A short paragraph about who you are and what you are working towards."
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={4}
                maxLength={4000}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Experience level</Label>
                <Select value={experienceLevel} onValueChange={(v) => setExperienceLevel(v as ExperienceLevel)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEVELS.map((l) => (
                      <SelectItem key={l.value} value={l.value}>
                        {l.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="years">Years of experience</Label>
                <Input
                  id="years"
                  type="number"
                  min={0}
                  max={50}
                  step={0.5}
                  value={years}
                  onChange={(e) => setYears(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  placeholder="Noida, India"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  maxLength={120}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="education" className="space-y-4">
            {education.map((entry, i) => (
              <div key={i} className="rounded-lg border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="flex items-center gap-2 text-sm font-semibold">
                    <GraduationCap className="h-4 w-4 text-primary" aria-hidden />
                    Education {i + 1}
                  </h4>
                  {education.length > 1 ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setEducation((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>
                  ) : null}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Degree</Label>
                    <Input
                      placeholder="B.Tech"
                      value={entry.degree ?? ""}
                      onChange={(e) => updateEducation(i, { degree: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Field</Label>
                    <Input
                      placeholder="Computer Science"
                      value={entry.field ?? ""}
                      onChange={(e) => updateEducation(i, { field: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Institution</Label>
                    <Input
                      placeholder="University name"
                      value={entry.institution ?? ""}
                      onChange={(e) => updateEducation(i, { institution: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Start</Label>
                    <Input
                      placeholder="2023"
                      value={entry.start ?? ""}
                      onChange={(e) => updateEducation(i, { start: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>End</Label>
                    <Input
                      placeholder="2027"
                      value={entry.end ?? ""}
                      onChange={(e) => updateEducation(i, { end: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>GPA (optional)</Label>
                    <Input
                      placeholder="8.7"
                      value={typeof entry.gpa === "number" ? String(entry.gpa) : (entry.gpa ?? "")}
                      onChange={(e) => updateEducation(i, { gpa: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={() => setEducation((prev) => [...prev, emptyEducation()])}>
              <Plus className="h-4 w-4" aria-hidden />
              Add education
            </Button>
          </TabsContent>

          <TabsContent value="skills">
            <SkillsPicker catalog={catalog} owned={skills} onAdd={addSkill} onRemove={removeSkill} />
          </TabsContent>

          <TabsContent value="goals" className="space-y-6">
            <div className="space-y-1.5">
              <Label>Interests</Label>
              <ChipList
                items={interests}
                onAdd={(v) => setInterests((prev) => [...prev, v])}
                onRemove={(v) => setInterests((prev) => prev.filter((x) => x !== v))}
                placeholder="cloud, data engineering, design systems…"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Career goals</Label>
              <ChipList
                items={goals}
                onAdd={(v) => setGoals((prev) => [...prev, v])}
                onRemove={(v) => setGoals((prev) => prev.filter((x) => x !== v))}
                placeholder="land a SDE-1 role, contribute to open source…"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Target role (one of the ten M1 roles)</Label>
              <Select value={targetRole || "none"} onValueChange={(v) => setTargetRole(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a target role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not decided yet</SelectItem>
                  {roles.map((r) => (
                    <SelectItem key={r.slug} value={r.slug}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Also interested in</Label>
              <div className="flex flex-wrap gap-2">
                {roles.map((r) => (
                  <Badge
                    key={r.slug}
                    variant={preferred.includes(r.slug) ? "default" : "outline"}
                    className="cursor-pointer select-none"
                    onClick={() => togglePreferred(r.slug)}
                  >
                    {r.name}
                  </Badge>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-6 flex items-center gap-3">
          <Button onClick={saveProfile} disabled={saving}>
            <Save className="h-4 w-4" aria-hidden />
            {saving ? "Saving…" : "Save profile"}
          </Button>
          <p className="text-xs text-muted-foreground">
            <Sparkles className="mr-1 inline h-3.5 w-3.5 text-primary" aria-hidden />
            Headline + ≥1 skill + an interest or goal marks your profile complete.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
