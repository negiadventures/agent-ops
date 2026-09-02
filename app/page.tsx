import Dashboard from "@/components/Dashboard";
import runs from "@/data/runs.json";
import type { Run } from "@/lib/types";

export default function Page() {
  return <Dashboard runs={runs as Run[]} />;
}
