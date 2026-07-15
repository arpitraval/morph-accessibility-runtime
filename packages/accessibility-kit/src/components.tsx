"use client";

import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type MouseEventHandler,
  type ReactNode,
} from "react";

export type AdaptiveProfileKey = "low-vision" | "one-switch" | "cognitive-load";
export type AdaptivePresentationMode = "standard" | "high-contrast" | "one-switch" | "cognitive-load";
export type AdaptiveFontScale = "base" | "large" | "x-large";

export interface AdaptiveComponentViewModel {
  readonly id: string;
  readonly kind:
    | "HEADING"
    | "TEXT"
    | "STATUS"
    | "ACTION"
    | "GROUP"
    | "CHOICE"
    | "FIELD"
    | "SUMMARY"
    | "CONSENT";
  readonly order: number;
  readonly label: string;
  readonly description: string | null;
  readonly importance: "PRIMARY" | "SECONDARY" | "CONTEXT";
  readonly enabled: boolean;
}

interface AdaptiveStyleProps {
  readonly presentationMode?: AdaptivePresentationMode;
  readonly fontScale?: AdaptiveFontScale;
  readonly reduceMotion?: boolean;
}

export function orderAdaptiveComponents<T extends AdaptiveComponentViewModel>(
  components: readonly T[],
): readonly T[] {
  return [...components].sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
}

function adaptiveDataProps({
  presentationMode = "standard",
  fontScale = "base",
  reduceMotion = false,
}: AdaptiveStyleProps) {
  return {
    "data-presentation-mode": presentationMode,
    "data-font-scale": fontScale,
    "data-reduce-motion": reduceMotion ? "true" : "false",
  } as const;
}

export interface AdaptiveButtonProps extends AdaptiveStyleProps {
  readonly id?: string;
  readonly label: string;
  readonly description?: string | null;
  readonly importance?: "PRIMARY" | "SECONDARY" | "CONTEXT";
  readonly actionStepId?: string | null;
  readonly scanActive?: boolean;
  readonly disabled?: boolean;
  readonly onClick?: MouseEventHandler<HTMLButtonElement>;
  readonly tabIndex?: number;
  readonly "aria-keyshortcuts"?: string;
}

export const AdaptiveButton = forwardRef<HTMLButtonElement, AdaptiveButtonProps>(function AdaptiveButton(
  {
    id,
    label,
    description = null,
    importance = "SECONDARY",
    actionStepId = null,
    scanActive = false,
    disabled = false,
    onClick,
    tabIndex = 0,
    "aria-keyshortcuts": ariaKeyShortcuts,
    presentationMode = "standard",
    fontScale = "base",
    reduceMotion = false,
  },
  ref,
) {
  const generatedDescriptionId = useId();
  const descriptionId = description ? "adaptive-button-" + generatedDescriptionId + "-description" : undefined;

  return (
    <button
      {...adaptiveDataProps({ presentationMode, fontScale, reduceMotion })}
      aria-current={scanActive ? "step" : undefined}
      aria-describedby={descriptionId}
      aria-keyshortcuts={ariaKeyShortcuts}
      aria-label={label}
      className="adaptive-action"
      data-action-step-id={actionStepId ?? undefined}
      data-importance={importance.toLowerCase()}
      data-scan-active={scanActive ? "true" : "false"}
      disabled={disabled}
      id={id}
      onClick={onClick}
      ref={ref}
      tabIndex={tabIndex}
      type="button"
    >
      <span className="adaptive-action-label">{label}</span>
      {description ? (
        <span className="adaptive-action-description" id={descriptionId}>
          {description}
        </span>
      ) : null}
      <span className="adaptive-action-cue" aria-hidden="true">
        {presentationMode === "one-switch" ? "Select" : "Continue"}
      </span>
    </button>
  );
});

export interface AdaptiveTextProps extends AdaptiveStyleProps {
  readonly id?: string;
  readonly label: string;
  readonly description?: string | null;
  readonly variant?: "heading" | "body" | "status" | "summary";
  readonly headingLevel?: 2 | 3 | 4;
}

export function AdaptiveText({
  id,
  label,
  description = null,
  variant = "body",
  headingLevel = 3,
  presentationMode = "standard",
  fontScale = "base",
  reduceMotion = false,
}: AdaptiveTextProps) {
  const dataProps = adaptiveDataProps({ presentationMode, fontScale, reduceMotion });

  if (variant === "heading") {
    const content = (
      <>
        {label}
        {description ? <span className="adaptive-heading-description">{description}</span> : null}
      </>
    );
    if (headingLevel === 2) return <h2 {...dataProps} className="adaptive-heading" id={id}>{content}</h2>;
    if (headingLevel === 4) return <h4 {...dataProps} className="adaptive-heading" id={id}>{content}</h4>;
    return <h3 {...dataProps} className="adaptive-heading" id={id}>{content}</h3>;
  }

  if (variant === "status") {
    return (
      <div {...dataProps} aria-atomic="true" aria-live="polite" className="adaptive-status" id={id} role="status">
        <span aria-hidden="true" />
        <div>
          <strong>{label}</strong>
          {description ? <p>{description}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div {...dataProps} className={variant === "summary" ? "adaptive-copy adaptive-summary" : "adaptive-copy"} id={id}>
      <strong>{label}</strong>
      {description ? <p>{description}</p> : null}
    </div>
  );
}

export interface AdaptiveListProps extends AdaptiveStyleProps {
  readonly label: string;
  readonly children: ReactNode;
  readonly ordered?: boolean;
  readonly layout?: "default" | "component-stack";
}

export function AdaptiveList({
  label,
  children,
  ordered = false,
  layout = "default",
  presentationMode = "standard",
  fontScale = "base",
  reduceMotion = false,
}: AdaptiveListProps) {
  const props = {
    ...adaptiveDataProps({ presentationMode, fontScale, reduceMotion }),
    "aria-label": label,
    className: layout === "component-stack" ? "adaptive-list adaptive-component-stack" : "adaptive-list",
  };
  return ordered ? <ol {...props}>{children}</ol> : <ul {...props}>{children}</ul>;
}

export interface AdaptiveModalProps extends AdaptiveStyleProps {
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
  readonly open: boolean;
  readonly required?: boolean;
  readonly onDismiss?: (() => void) | undefined;
}

export function AdaptiveModal({
  title,
  description,
  children,
  open,
  required = false,
  onDismiss,
  presentationMode = "standard",
  fontScale = "base",
  reduceMotion = false,
}: AdaptiveModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const focusable = dialog?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    focusable?.[0]?.focus();
  }, [open]);

  if (!open) return null;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && !required && onDismiss) {
      event.preventDefault();
      onDismiss();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ) ?? [])];
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  return (
    <div className="adaptive-modal-backdrop" data-required={required ? "true" : "false"}>
      <div
        {...adaptiveDataProps({ presentationMode, fontScale, reduceMotion })}
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="adaptive-modal"
        onKeyDown={handleKeyDown}
        ref={dialogRef}
        role={required ? "alertdialog" : "dialog"}
      >
        <h2 id={titleId}>{title}</h2>
        <p id={descriptionId}>{description}</p>
        <div className="adaptive-modal-actions">{children}</div>
      </div>
    </div>
  );
}