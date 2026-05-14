"use client";

import {
  AlertCircle,
  CheckCircle2,
  CircleDashed,
  Loader2,
  Sparkles
} from "lucide-react";
import type {
  DeploymentEvent,
  DeploymentEventStatus,
  DeploymentResource
} from "@/lib/deployment-engine";

interface DeploymentTimelineProps {
  events: DeploymentEvent[];
  isDeploying: boolean;
}

function MarkerIcon({ status }: { status: DeploymentEventStatus }) {
  if (status === "complete") return <CheckCircle2 size={15} aria-hidden="true" />;
  if (status === "active")
    return <Loader2 size={15} aria-hidden="true" className="ot-spin" />;
  if (status === "error") return <AlertCircle size={15} aria-hidden="true" />;
  return <CircleDashed size={15} aria-hidden="true" />;
}

function pickOverall(events: DeploymentEvent[], isDeploying: boolean) {
  const last = events[events.length - 1];
  if (events.length === 0 || !last) {
    return {
      progress: 0,
      status: (isDeploying ? "active" : "pending") as DeploymentEventStatus,
      headline: isDeploying ? "Spinning up your agent…" : "Ready when you are",
      detail: isDeploying
        ? "Streaming provisioning stages — keep this tab open."
        : "Fill in the form and hit Launch. We'll stream every step right here."
    };
  }
  const hasError = events.some((e) => e.status === "error");
  const allDone = events.every((e) => e.status === "complete");
  const progress = Math.max(
    last.progress,
    Math.round((events.filter((e) => e.status === "complete").length / Math.max(events.length, 1)) * 100)
  );
  if (hasError) {
    const errored = events.find((e) => e.status === "error")!;
    return {
      progress,
      status: "error" as DeploymentEventStatus,
      headline: `Stopped at ${errored.label}`,
      detail: errored.detail
    };
  }
  if (allDone) {
    return {
      progress: 100,
      status: "complete" as DeploymentEventStatus,
      headline: "Agent is live",
      detail: last.detail
    };
  }
  return {
    progress,
    status: "active" as DeploymentEventStatus,
    headline: last.label,
    detail: last.detail
  };
}

function ResourceChips({ resources }: { resources: DeploymentResource[] | undefined }) {
  if (!resources || resources.length === 0) return null;
  return (
    <div className="resource-chips">
      {resources.map((r) => (
        <span key={`${r.type}-${r.name}`} className="resource-chip" data-type={r.type}>
          <strong>{r.type}</strong>
          <span>{r.name}</span>
        </span>
      ))}
    </div>
  );
}

export function DeploymentTimeline({ events, isDeploying }: DeploymentTimelineProps) {
  const overall = pickOverall(events, isDeploying);

  return (
    <div className="deploy-progress" aria-live="polite">
      <div className="deploy-progress__overall" data-status={overall.status}>
        <div className="deploy-progress__overall-text">
          <span className="deploy-progress__pill">
            <Sparkles size={12} aria-hidden="true" />
            {overall.status === "complete"
              ? "Live"
              : overall.status === "error"
                ? "Needs attention"
                : overall.status === "active"
                  ? "Provisioning"
                  : "Idle"}
          </span>
          <strong>{overall.headline}</strong>
          <small>{overall.detail}</small>
        </div>
        <div className="deploy-progress__bar" role="progressbar" aria-valuenow={overall.progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="progress-track">
            <div
              className="progress-track__fill"
              data-status={overall.status}
              style={{ width: `${overall.progress}%` }}
            />
          </div>
          <span className="deploy-progress__percent">{overall.progress}%</span>
        </div>
      </div>

      <ol className="timeline timeline--steps">
        {events.length === 0 && (
          <li className="timeline-row" data-status="pending">
            <span className="timeline-marker">
              <MarkerIcon status="pending" />
            </span>
            <span className="timeline-copy">
              <strong>{isDeploying ? "Waiting for the first event" : "Deployment idle"}</strong>
              <small>Provisioning stages will appear here as they happen.</small>
            </span>
          </li>
        )}
        {events.map((event) => (
          <li
            key={event.id}
            className="timeline-row"
            data-status={event.status}
            data-complete={event.status === "complete" ? "true" : "false"}
          >
            <span className="timeline-marker">
              <MarkerIcon status={event.status} />
            </span>
            <span className="timeline-copy">
              <strong>{event.label}</strong>
              <small>{event.detail}</small>
              <ResourceChips resources={event.resources} />
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
