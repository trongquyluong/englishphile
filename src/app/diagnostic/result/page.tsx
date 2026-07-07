import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BarChart3, CheckCircle2, Dumbbell, Target, XCircle } from "lucide-react";
import { DifficultyBadge } from "@/components/ui/Badges";
import { LearnerCard } from "@/components/ui/LearnerCard";
import { cn } from "@/lib/utils";
import { requireUser } from "@/lib/auth/session";
import {
	getActiveLearningRecommendations,
	getDiagnosticMetadata,
	getLatestDiagnosticAttempt,
} from "@/lib/diagnostic";
import { prisma } from "@/lib/prisma";

function pct(value: number | null | undefined) {
	return value === null || value === undefined ? "—" : `${Math.round(value * 100)}%`;
}

function barWidth(value: number | null | undefined) {
	return `${Math.max(0, Math.min(100, Math.round((value ?? 0) * 100)))}%`;
}

function parseBreakdown(value: unknown) {
	return Array.isArray(value)
		? (value as Array<{
				label?: string;
				topicName?: string;
				statusLabel?: string;
				accuracy?: number | null;
				attempted?: number;
				correct?: number;
		  }>)
		: [];
}

type PageProps = {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DiagnosticResultPage({ searchParams }: PageProps) {
	const user = await requireUser();
	const params = await searchParams;
	const attemptId = typeof params.attempt === "string" ? params.attempt : "";
	const attempt = attemptId
		? await prisma.diagnosticAttempt.findFirst({ where: { id: attemptId, userId: user.id } })
		: await getLatestDiagnosticAttempt(user.id);
	if (!attempt) redirect("/diagnostic");

	const skillBreakdown = parseBreakdown(attempt.skillBreakdownJson);
	const topicBreakdown = parseBreakdown(attempt.topicBreakdownJson);
	const recommendations = await getActiveLearningRecommendations(user.id, 5);
	const accuracy = attempt.total ? (attempt.score ?? 0) / attempt.total : null;
	const metadata = getDiagnosticMetadata(attempt.recommendationJson);
	const scoring = metadata.scoring;

	return (
		<div className="grid gap-6">
			{/* Score header */}
			<LearnerCard>
				<div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
					<div className="flex-1">
						<div className="flex items-center gap-3">
							<div>
								<p className="text-sm font-semibold text-accent">Kết quả diagnostic</p>
								<h1 className="mt-2 text-3xl font-semibold tracking-tight">
									Trình độ ước lượng của bạn
								</h1>
							</div>
							{attempt.estimatedLevel ? (
								<DifficultyBadge difficulty={attempt.estimatedLevel} />
							) : null}
						</div>
						<p className="mt-2 text-sm text-ink-soft">
							{scoring?.levelExplanation ??
								"Kết quả này dùng để gợi ý bài luyện phù hợp, không phải điểm thi chính thức."}
						</p>
					</div>

					{/* Score metrics */}
					<div className="grid w-fit gap-3 sm:grid-cols-2 lg:grid-cols-4">
						<div className="rounded-2xl bg-panel-muted p-4">
							<p className="text-xs font-semibold text-ink-soft">
								Điểm có trọng số
							</p>
							<p className="mt-2 text-3xl font-semibold tabular-nums">
								{attempt.score ?? "—"}/{attempt.total ?? "—"}
							</p>
						</div>
						<div className="rounded-2xl bg-panel-muted p-4">
							<p className="text-xs font-semibold text-ink-soft">
								Độ chính xác
							</p>
							<p className="mt-2 text-3xl font-semibold tabular-nums">{pct(accuracy)}</p>
						</div>
						<div className="rounded-2xl bg-panel-muted p-4">
							<p className="text-xs font-semibold text-ink-soft">
								Độ tin cậy
							</p>
							<p className="mt-2 text-2xl font-semibold">
								{scoring?.confidenceLabel ?? "—"}
							</p>
							<p className="mt-1 text-xs text-ink-soft">{scoring?.confidenceReason}</p>
						</div>
						<div className="rounded-2xl bg-panel-muted p-4">
							<p className="text-xs font-semibold text-ink-soft">
								Ngày hoàn thành
							</p>
							<p className="mt-2 text-base font-semibold">
								{attempt.completedAt?.toLocaleDateString("vi-VN") ?? "Chưa hoàn thành"}
							</p>
						</div>
					</div>
				</div>
			</LearnerCard>

			{/* Skill and topic breakdown */}
			<div className="grid gap-5 lg:grid-cols-2">
				<LearnerCard>
					<div className="mb-4 flex items-center gap-2">
						<BarChart3 className="size-5 text-accent" aria-hidden="true" />
						<h2 className="text-lg font-semibold">Theo kỹ năng</h2>
					</div>
					<div className="grid gap-3">
						{skillBreakdown.map((item) => {
							const val = item.accuracy ?? 0;
							const tone = val >= 0.75 ? "bg-accent" : val >= 0.45 ? "bg-warning" : "bg-danger";
							return (
								<div key={item.label} className="rounded-2xl bg-panel-muted p-3">
									<div className="mb-2 flex items-center justify-between gap-3 text-sm">
										<span className="font-semibold">{item.label}</span>
										<span className="text-ink-soft tabular-nums">
											{item.accuracy !== null && item.accuracy !== undefined
												? `${Math.round(item.accuracy * 100)}%`
												: "—"}
										</span>
									</div>
									<div className="h-2 overflow-hidden rounded-full bg-background" role="img" aria-label={`${item.label}: ${pct(item.accuracy)}`}>
										<div className={cn("h-full rounded-full", tone)} style={{ width: barWidth(item.accuracy) }} />
									</div>
								</div>
							);
						})}
						{!skillBreakdown.length ? (
							<p className="rounded-2xl bg-panel-muted p-4 text-sm text-ink-soft">
								Chưa có dữ liệu kỹ năng.
							</p>
						) : null}
					</div>
				</LearnerCard>

				<LearnerCard>
					<div className="mb-4 flex items-center gap-2">
						<Target className="size-5 text-accent" aria-hidden="true" />
						<h2 className="text-lg font-semibold">Theo topic</h2>
					</div>
					<div className="grid gap-2">
						{topicBreakdown.slice(0, 8).map((item) => (
							<div
								key={item.topicName}
								className="flex items-center justify-between gap-3 rounded-2xl bg-panel-muted px-3 py-2.5 text-sm"
							>
								<span className="font-semibold">{item.topicName}</span>
								<span className="tabular-nums text-ink-soft">
									{pct(item.accuracy)}
								</span>
							</div>
						))}
						{!topicBreakdown.length ? (
							<p className="rounded-2xl bg-panel-muted p-4 text-sm text-ink-soft">
								Chưa có đủ dữ liệu topic.
							</p>
						) : null}
					</div>
				</LearnerCard>
			</div>

			{/* Strengths and weaknesses */}
			<div className="grid gap-5 lg:grid-cols-2">
				<LearnerCard>
					<div className="mb-4 flex items-center gap-2">
						<CheckCircle2 className="size-5 text-accent" aria-hidden="true" />
						<h2 className="text-lg font-semibold">Điểm mạnh</h2>
					</div>
					<div className="grid gap-2">
						{scoring?.strengths?.length ? (
							scoring.strengths.map((item) => (
								<div
									key={item.skillType}
									className="flex items-center justify-between gap-3 rounded-2xl bg-accent-soft px-3 py-2.5 text-sm font-semibold text-accent-strong"
								>
									<span>{item.label}</span>
									<span className="tabular-nums">{pct(item.accuracy)}</span>
								</div>
							))
						) : (
							<p className="rounded-2xl bg-panel-muted p-4 text-sm text-ink-soft">
								Chưa đủ dữ liệu để gọi là điểm mạnh.
							</p>
						)}
					</div>
				</LearnerCard>

				<LearnerCard>
					<div className="mb-4 flex items-center gap-2">
						<XCircle className="size-5 text-warning" aria-hidden="true" />
						<h2 className="text-lg font-semibold">Cần luyện thêm</h2>
					</div>
					<div className="grid gap-2">
						{scoring?.weakAreas?.length ? (
							scoring.weakAreas.map((item) => (
								<div
									key={item.skillType}
									className="flex items-center justify-between gap-3 rounded-2xl bg-warning-soft px-3 py-2.5 text-sm font-semibold text-warning"
								>
									<span>{item.label}</span>
									<span className="tabular-nums">{item.statusLabel}</span>
								</div>
							))
						) : (
							<p className="rounded-2xl bg-panel-muted p-4 text-sm text-ink-soft">
								Chưa phát hiện điểm yếu rõ ràng.
							</p>
						)}
					</div>
				</LearnerCard>
			</div>

			{/* Recommendations + next steps */}
			<LearnerCard>
				<div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<h2 className="text-lg font-semibold">Gợi ý hôm nay</h2>
					<div className="flex flex-wrap gap-2">
						<Link href="/gym" className="btn btn-sm btn-primary">
							<Dumbbell className="size-4" aria-hidden="true" />
							Vào Gym
						</Link>
						<Link href="/recommendations" className="btn btn-sm btn-secondary">
							Luyện bài được gợi ý
						</Link>
					</div>
				</div>

				<div className="grid gap-3 md:grid-cols-2">
					{recommendations.map((rec) => (
						<Link
							key={rec.id}
							href={rec.problem ? `/problems/${rec.problem.slug}` : "/recommendations"}
							className="rounded-2xl bg-panel-muted p-4 transition-shadow hover:shadow-[var(--shadow-border-hover)]"
						>
							<div className="flex items-start justify-between gap-3">
								<h3 className="text-sm font-semibold">{rec.problem?.title ?? "Bài luyện"}</h3>
								<ArrowRight className="size-4 shrink-0 text-ink-soft" aria-hidden="true" />
							</div>
							<p className="mt-2 text-sm text-ink-soft">{rec.reason}</p>
						</Link>
					))}
					{!recommendations.length ? (
						<p className="rounded-2xl bg-panel-muted p-4 text-sm text-ink-soft md:col-span-2">
							Chưa có gợi ý. Hãy hoàn thành diagnostic để nhận bài luyện phù hợp.
						</p>
					) : null}
				</div>
			</LearnerCard>
		</div>
	);
}
