import type { Candidate, CandidateStage } from '../lib/mock-data';

const PIPELINE_STAGES: CandidateStage[] = ['applied', 'screening', 'interview', 'final', 'hired'];
const STAGE_FLOW: CandidateStage[] = ['applied', 'screening', 'interview', 'final', 'hired', 'rejected', 'drop-off', 'archived'];
const STAGE_LABELS: Record<CandidateStage, string> = {
  applied: 'Applied',
  screening: 'Screening',
  interview: 'Interview',
  final: 'Final Round',
  hired: 'Hired',
  rejected: 'Rejected',
  'drop-off': 'Drop Off',
  archived: 'Archived'
};

type StageTimeline = Partial<Record<CandidateStage, Date>>;

const toDate = (value?: string | null): Date | null => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const buildStageTimeline = (candidate: Candidate): StageTimeline => {
  const timeline: StageTimeline = {};

  candidate.stageHistory?.forEach((entry) => {
    const stage = entry.stage as CandidateStage;
    const enteredAt = toDate(entry.enteredAt ?? null);
    if (stage && enteredAt) {
      timeline[stage] = enteredAt;
    }
  });

  const timestampFields: Partial<Record<CandidateStage, string | undefined>> = {
    applied: candidate.appliedAt ?? candidate.appliedDate,
    screening: candidate.screeningAt,
    interview: candidate.interviewAt,
    final: candidate.finalAt,
    hired: candidate.hiredAt,
    rejected: candidate.rejectedAt,
    'drop-off': candidate.droppedAt,
    archived: candidate.archivedDate
  };

  Object.entries(timestampFields).forEach(([stage, value]) => {
    const parsed = toDate(value);
    if (parsed && !timeline[stage as CandidateStage]) {
      timeline[stage as CandidateStage] = parsed;
    }
  });

  return timeline;
};

const findNextStageDate = (
  currentStage: CandidateStage,
  timeline: StageTimeline,
  currentStageId: CandidateStage
): Date | null => {
  const currentIndex = STAGE_FLOW.indexOf(currentStage);
  if (currentIndex === -1) {
    return null;
  }

  for (let idx = currentIndex + 1; idx < STAGE_FLOW.length; idx += 1) {
    const nextStage = STAGE_FLOW[idx];
    const nextDate = timeline[nextStage];
    if (nextDate) {
      return nextDate;
    }
  }

  if (currentStage === currentStageId) {
    return new Date();
  }

  return null;
};

export const calculateAverageStageDuration = (candidates: Candidate[] = []) => {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return [];
  }

  const aggregates = new Map<CandidateStage, { total: number; count: number }>();

  candidates.forEach((candidate) => {
    const timeline = buildStageTimeline(candidate);
    const currentStageId = candidate.stage;

    PIPELINE_STAGES.forEach((stage) => {
      const start = timeline[stage];
      if (!start) {
        return;
      }

      const end = findNextStageDate(stage, timeline, currentStageId);
      if (!end || end <= start) {
        return;
      }

      const durationDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
      const aggregate = aggregates.get(stage) ?? { total: 0, count: 0 };
      aggregate.total += durationDays;
      aggregate.count += 1;
      aggregates.set(stage, aggregate);
    });
  });

  return PIPELINE_STAGES
    .map((stage) => {
      const aggregate = aggregates.get(stage);
      if (!aggregate || aggregate.count === 0) {
        return null;
      }
      return {
        stage: STAGE_LABELS[stage],
        avgDays: Number((aggregate.total / aggregate.count).toFixed(1))
      };
    })
    .filter((entry): entry is { stage: string; avgDays: number } => Boolean(entry));
};
