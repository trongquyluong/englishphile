import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * LearnerCard — consistent card for learner-facing content sections.
 * Uses the existing `surface` class for background + shadow, rounded-2xl for containers.
 */
export function LearnerCard({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return <div className={cn("surface rounded-2xl p-5", className)}>{children}</div>;
}

/**
 * LearnerSection — wraps a learner-facing page section with consistent padding and layout.
 */
export function LearnerSection({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return <section className={cn("grid gap-5", className)}>{children}</section>;
}

/**
 * AccuracyBar — shows a skill/topic accuracy with a visual bar and percentage.
 */
export function AccuracyBar({
	accuracy,
	label,
}: {
	accuracy: number | null | undefined;
	label?: string;
}) {
	const value = accuracy ?? 0;
	const pct = Math.round(value * 100);
	const tone = value >= 0.75 ? "bg-accent" : value >= 0.45 ? "bg-warning" : "bg-danger";

	return (
		<div className="grid gap-1.5">
			{label ? (
				<div className="flex items-center justify-between gap-3 text-sm">
					<span className="font-semibold">{label}</span>
					<span className="text-ink-soft tabular-nums">{pct}%</span>
				</div>
			) : null}
			<div
				className="h-2 overflow-hidden rounded-full bg-panel-muted"
				role="img"
				aria-label={`${pct}% độ chính xác`}
			>
				<div className={cn("h-full rounded-full transition-all", tone)} style={{ width: `${pct}%` }} />
			</div>
		</div>
	);
}

/**
 * ActionRow — a consistent bottom action bar for pages.
 * Sticky on mobile so the CTA is always accessible.
 */
export function ActionRow({
	children,
	className,
	sticky = true,
}: {
	children: ReactNode;
	className?: string;
	sticky?: boolean;
}) {
	return (
		<div
			className={cn(
				"flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-panel/95 p-3 shadow-[0_18px_60px_-32px_rgba(23,33,27,0.45)] backdrop-blur-sm",
				sticky ? "sticky bottom-4 z-10" : "",
				className,
			)}
		>
			{children}
		</div>
	);
}

/**
 * EmptyState — friendly empty state for learner pages.
 */
export function EmptyState({
	title,
	description,
	action,
	icon: Icon,
}: {
	title: string;
	description: string;
	action?: ReactNode;
	icon?: React.ComponentType<{ className?: string; "aria-hidden"?: "true" }>;
}) {
	return (
		<div className="surface rounded-2xl p-8 text-center">
			{Icon ? (
				<Icon className="mx-auto size-8 text-ink-soft" aria-hidden="true" />
			) : null}
			<h2 className="mt-4 font-semibold">{title}</h2>
			<p className="mt-2 text-sm text-ink-soft">{description}</p>
			{action ? <div className="mt-5">{action}</div> : null}
		</div>
	);
}
