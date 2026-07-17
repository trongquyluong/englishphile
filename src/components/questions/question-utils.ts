import type { Option } from "@/lib/problem-types";

export function getOptions(value: unknown): Option[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const option = item as Record<string, unknown>;
      return {
        id: String(option.id ?? ""),
        text: String(option.text ?? ""),
      };
    })
    .filter((item): item is Option => Boolean(item?.id));
}
