import "server-only";

import { notFound } from "next/navigation";

export function retiredClassroomNotFound(): never {
  notFound();
}
