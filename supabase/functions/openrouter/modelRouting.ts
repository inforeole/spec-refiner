export type OpenRouterTask = "summary" | "interview";

type ModelRoute = {
  task: OpenRouterTask;
  model: string;
  maxTokensCap: number;
};

const ROUTES: Record<OpenRouterTask, ModelRoute> = {
  summary: {
    task: "summary",
    model: "anthropic/claude-haiku-4.5",
    maxTokensCap: 256,
  },
  interview: {
    task: "interview",
    model: "anthropic/claude-sonnet-4.6",
    maxTokensCap: 8192,
  },
};

export function resolveModelRoute(task: unknown): ModelRoute | null {
  if (task === undefined) return ROUTES.interview;
  if (task === "summary" || task === "interview") return ROUTES[task];
  return null;
}
