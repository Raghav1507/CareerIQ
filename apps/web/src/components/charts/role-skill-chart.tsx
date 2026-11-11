"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type RoleSkillCount = {
  slug: string;
  name: string;
  required: number;
  optional: number;
};

/** Required vs optional skill counts for each of the ten M1 roles. */
export function RoleSkillChart({ data }: { data: RoleSkillCount[] }) {
  const short = (name: string) =>
    name
      .replace(" Developer", "")
      .replace(" Engineer", "")
      .replace(" Analyst", "")
      .replace("Full Stack", "Full Stack");

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
          <XAxis
            dataKey="name"
            tickFormatter={short}
            tick={{ fontSize: 11 }}
            interval={0}
            angle={-30}
            textAnchor="end"
            height={70}
            className="text-muted-foreground"
          />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} className="text-muted-foreground" />
          <Tooltip
            cursor={{ fill: "var(--color-muted)", opacity: 0.5 }}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid var(--color-border)",
              background: "var(--color-card)",
              fontSize: 12,
            }}
            formatter={(value, name) => [value, name === "required" ? "Required" : "Optional"]}
          />
          <Legend
            formatter={(value) => (
              <span className="text-xs text-muted-foreground">
                {value === "required" ? "Required skills" : "Optional skills"}
              </span>
            )}
          />
          <Bar dataKey="required" stackId="a" fill="var(--color-chart-1)" radius={[0, 0, 0, 0]} />
          <Bar dataKey="optional" stackId="a" fill="var(--color-chart-3)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
