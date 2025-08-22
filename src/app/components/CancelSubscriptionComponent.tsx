"use client";
import { memo, useEffect, useRef, useState } from "react";
import Image from "next/image";
import React from "react";
import { Subscription, User } from "../page";
import { supabase } from "@/lib/supabase";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string;
  userDetails: User;
  subscriptionDetails: Subscription;
};

type Route =
  | "question"
  | "yes.step1"
  | "yes.step2"
  | "yes.step3"
  | "yes.done"
  | "no.step1"
  | "no.usage"
  | "no.step2"
  | "no.step3"
  | "no.done";

/* ======================= cancellation row types ======================= */

type DownsellVariant = "A" | "B";
type AppliedCount = "0" | "1-5" | "6-20" | "20+";
type EmailedCount = "0" | "1-5" | "6-20" | "20+";
type InterviewCount = "0" | "1-2" | "3-5" | "5+";

export type CancellationRow = {
  id?: string;
  user_id: string;
  subscription_id?: string | null;
  downsell_variant?: DownsellVariant | null;
  accepted_downsell?: boolean | null;
  feedback?: string | null;
  reason?: string | null;
  reason_text?: string | null;
  attributed_to_mm?: boolean | null;
  applied_count?: AppliedCount | null;
  emailed_count?: EmailedCount | null;
  interview_count?: InterviewCount | null;
  visa_has_lawyer?: boolean | null;
  visa_type?: string | null;
};

/* ======================= helpers ======================= */

function Stepper({
  active,
  total,
  showLabel = true,
}: {
  active: number;
  total: number;
  showLabel?: boolean;
}) {
  const completedColor = "bg-emerald-500";
  const currentColor = "bg-gray-400";
  const inactiveColor = "bg-gray-200";

  return (
    <div className="flex items-center gap-2 text-xs text-gray-500">
      {Array.from({ length: total }).map((_, i) => {
        const bar =
          i < active - 1
            ? completedColor
            : i === active - 1
            ? currentColor
            : inactiveColor;
        return <span key={i} className={`h-1.5 w-6 rounded-full ${bar}`} />;
      })}
      {showLabel && (
        <span>
          Step {active} of {total}
        </span>
      )}
    </div>
  );
}

function HeaderBar({
  title = "Subscription Cancellation",
  mobileTitle,
  onBack,
  showBack,
  stepActive,
  stepTotal,
  onClose,
}: {
  title?: string;
  mobileTitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  stepActive?: number;
  stepTotal?: number;
  onClose: () => void;
}) {
  return (
    <div className="relative flex items-center justify-between border-b px-4 sm:px-6 py-3">
      <div className="w-24">
        {showBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm text-gray-700 hover:underline"
          >
            <span className="text-lg">‹</span> Back
          </button>
        )}
      </div>

      <div className="flex items-center gap-4">
        <p className="text-sm font-medium text-gray-700">
          <span className="hidden sm:inline">{title}</span>
          <span className="inline sm:hidden">{mobileTitle ?? title}</span>
        </p>
        {stepActive && stepTotal ? (
          <Stepper active={stepActive} total={stepTotal} />
        ) : null}
      </div>

      <button
        onClick={onClose}
        className="w-24 text-right rounded p-2 text-gray-500 hover:bg-gray-100"
        aria-label="Close"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          stroke="currentColor"
          fill="none"
          className="inline"
        >
          <path
            strokeWidth="2"
            strokeLinecap="round"
            d="M6 6l12 12M6 18L18 6"
          />
        </svg>
      </button>
    </div>
  );
}

type ImageMode = "top-mobile-right-desktop" | "right-hide-mobile" | "none";
function SectionFrame({
  title = "Subscription Cancellation",
  mobileTitle,
  showBack,
  onBack,
  onClose,
  stepActive,
  stepTotal,
  imageMode = "right-hide-mobile",
  children,
}: {
  title?: string;
  mobileTitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  onClose: () => void;
  stepActive?: number;
  stepTotal?: number;
  imageMode?: ImageMode;
  children: React.ReactNode;
}) {
  const ImagePane = (
    <Image
      src="/empire-state-compressed.jpg"
      alt="Empire State Building"
      width={1200}
      height={800}
      className="h-48 sm:h-64 md:h-full w-full rounded-xl object-cover"
      priority
    />
  );

  return (
    <>
      <HeaderBar
        title={title}
        mobileTitle={mobileTitle}
        showBack={showBack}
        onBack={onBack}
        stepActive={stepActive}
        stepTotal={stepTotal}
        onClose={onClose}
      />
      <div className="p-4 sm:p-6 md:grid md:grid-cols-2 md:gap-6">
        {imageMode === "top-mobile-right-desktop" && (
          <>
            <div className="order-1 md:order-2 overflow-hidden rounded-xl">
              {ImagePane}
            </div>
            <div className="order-2 md:order-1">{children}</div>
          </>
        )}
        {imageMode === "right-hide-mobile" && (
          <>
            <div className="md:order-1">{children}</div>
            <div className="hidden md:block md:order-2 overflow-hidden rounded-xl">
              {ImagePane}
            </div>
          </>
        )}
        {imageMode === "none" && (
          <div className="md:col-span-2">{children}</div>
        )}
      </div>
    </>
  );
}

/* Rectangular buttons with rounded edges + keyboard arrows */
type PillOption<T extends string> = { label: string; value: T };
type PillGroupProps<T extends string> = {
  value?: T;
  onChange: (v: T) => void;
  options: PillOption<T>[];
  columns?: 2 | 3 | 4;
};
function PillGroup<T extends string>({
  value,
  onChange,
  options,
  columns = 4,
}: PillGroupProps<T>) {
  const col =
    columns === 2
      ? "grid-cols-2"
      : columns === 3
      ? "grid-cols-3"
      : "grid-cols-4";
  function onKeyDown(e: React.KeyboardEvent) {
    const idx = Math.max(
      0,
      options.findIndex((o) => o.value === value)
    );
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      onChange(options[(idx + 1) % options.length].value as T);
      e.preventDefault();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      onChange(options[(idx - 1 + options.length) % options.length].value as T);
      e.preventDefault();
    }
  }

  const base =
    "h-10 w-full rounded-lg border px-4 text-sm font-medium transition-colors " +
    "focus:outline-none focus:ring-2 focus:ring-violet-300";

  const active = "bg-[#8952fc] text-white border-[#8952fc] shadow"; // selected: purple bg, white text

  const inactive = "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"; // unselected

  return (
    <div role="radiogroup" onKeyDown={onKeyDown}>
      <div className={`grid ${col} gap-3`}>
        {options.map((o) => {
          const isActive = value === o.value;
          return (
            <button
              key={o.value}
              role="radio"
              aria-checked={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onChange(o.value as T)}
              className={`${base} ${isActive ? active : inactive}`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ======================= sections ======================= */

function CancelQuestion({
  onYes,
  onNo,
}: {
  onYes: () => void;
  onNo: () => void;
}) {
  return (
    <div>
      <h2 className="text-[28px] sm:text-[30px] font-bold leading-snug text-gray-900">
        Hey mate,
        <br /> <span>Quick one before you go.</span>
      </h2>
      <p className="mt-4 text-2xl font-semibold italic text-gray-900">
        Have you found a job yet?
      </p>
      <p className="mt-4 text-sm text-gray-600">
        Whatever your answer, we just want to help you take the next step. With
        visa support, or by hearing how we can do better.
      </p>
      <div className="mt-6 space-y-3">
        <button
          onClick={onYes}
          className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium hover:bg-gray-50"
        >
          Yes, I’ve found a job
        </button>
        <button
          onClick={onNo}
          className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium hover:bg-gray-50"
        >
          Not yet - I’m still looking
        </button>
      </div>
    </div>
  );
}

function CancelYesStep1({
  cancellationData,
  patchCancellation,
  userEmail,
  foundViaMM,
  setFoundViaMM,
  appliedCount,
  setAppliedCount,
  emailedCount,
  setEmailedCount,
  interviewsCount,
  setInterviewsCount,
  onNext,
}: {
  cancellationData: CancellationRow;
  patchCancellation: (p: Partial<CancellationRow>) => void;
  userEmail?: string;
  foundViaMM?: "yes" | "no";
  setFoundViaMM: (v: "yes" | "no") => void;
  appliedCount?: string;
  setAppliedCount: (v: string) => void;
  emailedCount?: string;
  setEmailedCount: (v: string) => void;
  interviewsCount?: string;
  setInterviewsCount: (v: string) => void;
  onNext: () => void;
}) {
  const allAnswered = Boolean(
    foundViaMM && appliedCount && emailedCount && interviewsCount
  );
  return (
    <div>
      <h2 className="mb-4 text-[26px] sm:text-[28px] font-bold text-gray-900">
        Congrats on the new role! 🎉
      </h2>

      <div className="mb-4">
        <label className="mb-1 block text-[11px] tracking-wide text-gray-600">
          Did you find this job with MigrateMate?*
        </label>
        <PillGroup
          value={foundViaMM}
          onChange={setFoundViaMM}
          options={[
            { label: "Yes", value: "yes" },
            { label: "No", value: "no" },
          ]}
          columns={2}
        />
      </div>

      <div className="mb-4">
        <label className="mb-1 block text-[11px] tracking-wide text-gray-600">
          How many roles did you <span className="underline">apply</span> for
          through Migrate Mate?*
        </label>
        <PillGroup
          value={appliedCount}
          onChange={setAppliedCount}
          columns={4}
          options={[
            { label: "0", value: "0" },
            { label: "1 – 5", value: "1-5" },
            { label: "6 – 20", value: "6-20" },
            { label: "20+", value: "20+" },
          ]}
        />
      </div>

      <div className="mb-4">
        <label className="mb-1 block text-[11px] tracking-wide text-gray-600">
          How many companies did you <span className="underline">email</span>{" "}
          directly?*
        </label>
        <PillGroup
          value={emailedCount}
          onChange={setEmailedCount}
          columns={4}
          options={[
            { label: "0", value: "0" },
            { label: "1–5", value: "1-5" },
            { label: "6–20", value: "6-20" },
            { label: "20+", value: "20+" },
          ]}
        />
      </div>

      <div className="mb-5">
        <label className="mb-1 block text-[11px] tracking-wide text-gray-600">
          How many different companies did you{" "}
          <span className="underline">interview</span> with?*
        </label>
        <PillGroup
          value={interviewsCount}
          onChange={setInterviewsCount}
          columns={4}
          options={[
            { label: "0", value: "0" },
            { label: "1–2", value: "1-2" },
            { label: "3–5", value: "3-5" },
            { label: "5+", value: "5+" },
          ]}
        />
      </div>

      <button
        disabled={!allAnswered}
        onClick={onNext}
        className={`w-full rounded-lg px-4 py-3 text-sm font-medium
          ${
            allAnswered
              ? "bg-gray-900 text-white hover:bg-black"
              : "cursor-not-allowed bg-gray-100 text-gray-400"
          }`}
      >
        Continue
      </button>
    </div>
  );
}

function CancelYesStep2({
  cancellationData,
  patchCancellation,
  feedback,
  setFeedback,
  minChars,
  onContinue,
}: {
  cancellationData: CancellationRow;
  patchCancellation: (p: Partial<CancellationRow>) => void;
  feedback: string;
  setFeedback: (v: string) => void;
  minChars: number;
  onContinue: () => void;
}) {
  const count = feedback.trim().length;
  const canContinue = count >= minChars;
  return (
    <div>
      <h2 className="mb-3 text-[26px] sm:text-[28px] font-bold text-gray-900">
        What’s one thing you wish we could’ve helped you with?
      </h2>
      <p className="mb-4 text-sm text-gray-600">
        We’re always looking to improve, your thoughts can help us make Migrate
        Mate more useful for others.*
      </p>

      <div className="relative">
        <textarea
          value={feedback}
          onChange={(e) => {
            const val = e.target.value;
            setFeedback(val);
            patchCancellation({ feedback: val });
            console.log(val);
          }}
          rows={6}
          className="w-full resize-none rounded-xl border border-gray-300 p-3 text-gray-900 outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-300"
        />
        <span className="pointer-events-none absolute bottom-2 right-3 text-xs text-gray-500">
          Min {minChars} characters ({count}/{minChars})
        </span>
      </div>

      <button
        disabled={!canContinue}
        onClick={onContinue}
        className={`mt-4 w-full rounded-lg px-4 py-3 text-sm font-medium
          ${
            canContinue
              ? "bg-gray-900 text-white hover:bg-black"
              : "cursor-not-allowed bg-gray-100 text-gray-400"
          }`}
      >
        Continue
      </button>
    </div>
  );
}

function VisaQuestionStep3({
  cancellationData,
  patchCancellation,
  foundViaMM,
  visaLawyer,
  setVisaLawyer,
  visaType,
  setVisaType,
  onComplete,
}: {
  cancellationData: CancellationRow;
  patchCancellation: (p: Partial<CancellationRow>) => void;
  foundViaMM?: "yes" | "no";
  visaLawyer?: "yes" | "no";
  setVisaLawyer: (v: "yes" | "no") => void;
  visaType: string;
  setVisaType: (v: string) => void;
  onComplete: () => void;
}) {
  const selected = visaLawyer !== undefined;
  const canSubmit = selected && visaType.trim().length > 0;

  const handlePick = (value: "yes" | "no") => {
    setVisaLawyer(value);
    setVisaType("");
  };

  const Radio = ({ label, value }: { label: string; value: "yes" | "no" }) => {
    const checked = visaLawyer === value;
    return (
      <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-gray-800">
        <input
          type="radio"
          name="visa-lawyer"
          value={value}
          checked={checked}
          onChange={() => handlePick(value)}
          className="sr-only"
        />
        <span
          className={`flex h-4 w-4 items-center justify-center rounded-full border
            ${
              checked
                ? "border-black-600 ring-4 ring-emerald-100"
                : "border-gray-400"
            }`}
          aria-hidden
        >
          <span
            className={`h-2 w-2 rounded-full ${
              checked ? "bg-black" : "bg-transparent"
            }`}
          />
        </span>
        {label}
      </label>
    );
  };

  const viaMM = foundViaMM === "yes";
  const heading = viaMM ? (
    <>
      We helped you land the job, now
      <br className="hidden sm:block" />
      let’s help you secure your visa.
    </>
  ) : (
    <>
      <span className="block">You landed the job!</span>
      <span className="block italic font-semibold">
        That’s what we live for.
      </span>
    </>
  );

  const helperBelowHeading = viaMM ? null : (
    <p className="mt-2 text-sm text-gray-600">
      Even if it wasn’t through Migrate Mate, let us help get your visa sorted.
    </p>
  );

  const labelText =
    visaLawyer === "yes"
      ? "What visa will you be applying for?*"
      : "Which visa would you like to apply for?*";

  return (
    <div>
      <h2 className="mb-1 text-[26px] sm:text-[28px] font-bold text-gray-900">
        {heading}
      </h2>

      {helperBelowHeading}

      <p className="mt-4 mb-3 text-sm text-gray-600">
        Is your company providing an immigration lawyer to help with your visa?
      </p>

      <div className="space-y-3 mb-3">
        <Radio label="Yes" value="yes" />
        <Radio label="No" value="no" />
      </div>

      {visaLawyer === "no" && (
        <p className="mb-2 text-sm text-gray-600">
          We can connect you with one of our trusted partners.
        </p>
      )}

      {selected && (
        <div className="mb-5">
          <label className="mb-1 block text-[11px] tracking-wide text-gray-600">
            {labelText}
          </label>
          <input
            type="text"
            value={visaType}
            onChange={(e) => setVisaType(e.target.value)}
            placeholder="E.g., H-1B, O-1, TN…"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                       outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-300"
          />
        </div>
      )}

      <button
        disabled={!canSubmit}
        onClick={onComplete}
        className={`mt-1 w-full rounded-lg px-4 py-3 text-sm font-medium
          ${
            canSubmit
              ? "bg-gray-900 text-white hover:bg-black"
              : "cursor-not-allowed bg-gray-100 text-gray-400"
          }`}
      >
        Complete cancellation
      </button>
    </div>
  );
}

function CancelSuccess({
  visaLawyer,
  onFinish,
  contactName = "Mihailo Basic",
  contactEmail = "mihailo@migratemate.co",
  contactAvatar = "/mihailo-profile.jpeg",
}: {
  visaLawyer?: "yes" | "no";
  onFinish: () => void;
  contactName?: string;
  contactEmail?: string;
  contactAvatar?: string;
}) {
  const showContactCard = visaLawyer === "no";
  const title = showContactCard
    ? "Your cancellation’s all sorted, mate, no more charges."
    : "All done, your cancellation’s been processed.";

  return (
    <div>
      <h2 className="mb-3 text-[26px] sm:text-[28px] font-bold text-gray-900">
        {title}
      </h2>

      {showContactCard && (
        <div className="mb-5 rounded-xl bg-gray-50 p-4 shadow-sm ring-1 ring-gray-200">
          <div className="flex items-center gap-3">
            <Image
              src={contactAvatar}
              alt={contactName}
              width={36}
              height={36}
              className="h-9 w-9 rounded-full object-cover"
            />
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {contactName}
              </p>
              <p className="text-xs text-gray-500">{contactEmail}</p>
            </div>
          </div>

          <p className="mt-3 text-sm text-gray-700">
            I’ll be reaching out soon to help with the visa side of things.
          </p>
          <p className="mt-2 text-sm text-gray-700">
            We’ve got your back, whether it’s questions, paperwork, or just
            figuring out your options.
          </p>
          <p className="mt-2 text-sm text-gray-700">
            Keep an eye on your inbox, I’ll be in touch{" "}
            <span className="underline">shortly</span>.
          </p>
        </div>
      )}

      <button
        onClick={onFinish}
        className="w-full rounded-lg px-4 py-3 text-sm font-medium bg-[#8952fc] text-white hover:bg-[#7b40fc]"
      >
        Finish
      </button>
    </div>
  );
}

/* ------------------------------------------------- Downsell flow --------------------------- */

type DownsellOffer = {
  variant: DownsellVariant;
  monthlyPrice: number;
  discountedPrice: number;
  discountLabel: string;
};

function pickDownsellVariant(): DownsellVariant {
  try {
    const c = globalThis.crypto;
    if (c && typeof c.getRandomValues === "function") {
      const buf = new Uint32Array(1);
      c.getRandomValues.call(c, buf);
      return (buf[0] & 1) === 0 ? "B" : "A";
    }
  } catch {}
  return Math.random() > 0.5 ? "A" : "B";
}

function getVariantStable(userEmail?: string): DownsellVariant {
  try {
    if (typeof window === "undefined") return pickDownsellVariant();
    const key = `mm_downsell_variant:${userEmail ?? "anon"}`;
    const saved = window.localStorage.getItem(key);
    if (saved === "A" || saved === "B") return saved;
    const v = pickDownsellVariant();
    try {
      window.localStorage.setItem(key, v);
    } catch {}
    return v;
  } catch {
    return pickDownsellVariant();
  }
}

async function getExistingCancellationRow(
  _userId: string
): Promise<CancellationRow | null> {
  await new Promise((r) => setTimeout(r, 120));
  const { data, error } = await supabase.rpc(
    "fn_get_cancellations_by_user_id",
    { p_user_id: _userId }
  );

  if (error) {
    console.error("Error fetching cancellations:", error);
    throw error;
  }

  // RPC returns SETOF → data will be an array
  if (!data || data.length === 0) {
    return null;
  }

  // Return the first row (your SQL already orders DESC by created_at)
  const row: CancellationRow = data[0];
  return row;
}

function NoDownsellFunction({
  monthlyPrice,
  variant,
  onAccept,
  onDecline,
}: {
  monthlyPrice?: number;
  variant: DownsellVariant;
  onAccept: (offer: DownsellOffer) => void;
  onDecline: (offer: DownsellOffer) => void;
}) {
  const [loading, setLoading] = useState(true);

  const safeMonthlyPrice = monthlyPrice ?? 0;

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      if (!alive) return;
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="h-7 w-72 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  const discountedPrice = Math.max(0, safeMonthlyPrice - 10);
  const offer: DownsellOffer = {
    variant,
    monthlyPrice: safeMonthlyPrice,
    discountedPrice,
    discountLabel: "$10 off",
  };

  const fmt = (n: number) =>
    `$${Number.isInteger(n) ? n.toFixed(0) : n.toFixed(2)}/month`;

  return (
    <div>
      <h2 className="text-[28px] sm:text-[30px] font-bold text-gray-900 leading-tight">
        We built this to help you land the job, this makes it a little easier.
      </h2>
      <p className="mt-2 text-gray-600">
        We’ve been there and we’re here to help you.
      </p>

      <div className="mt-5 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-center">
        <p className="text-lg font-semibold text-gray-900">
          Here’s <span className="underline">{offer.discountLabel}</span> until
          you find a job.
        </p>

        <div className="mt-2 flex items-baseline justify-center gap-3">
          <span className="text-2xl font-bold text-indigo-700">
            {fmt(offer.discountedPrice)}
          </span>
          <span className="text-sm text-gray-500 line-through">
            {fmt(offer.monthlyPrice)}
          </span>
        </div>

        <button
          onClick={() => onAccept(offer)}
          className="mt-4 w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Get $10 off
        </button>

        <p className="mt-2 text-xs text-gray-500">
          You won’t be charged until your next billing date.
        </p>
      </div>

      <button
        onClick={() => onDecline(offer)}
        className="mt-4 w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        No thanks
      </button>
    </div>
  );
}

function NoDownsellAccepted({
  discountedPrice,
  nextBillingDate,
  daysLeft,
  onBack,
  onClose,
}: {
  discountedPrice: number;
  nextBillingDate: Date;
  daysLeft: number;
  onBack: () => void;
  onClose: () => void;
}) {
  const dateStr = nextBillingDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <div className="md:order-1">
      <h2 className="text-2xl sm:text-[26px] font-extrabold text-gray-900">
        Great choice, mate!
      </h2>
      <p className="mt-2 text-xl font-semibold text-gray-900">
        You’re still on the path to your dream role.{" "}
        <span className="text-indigo-600">Let’s make it happen together!</span>
      </p>

      <p className="mt-4 text-sm text-gray-600">
        You’ve got {daysLeft} days left on your current plan.
        <br />
        Starting from {dateStr}, your monthly payment will be $
        {discountedPrice.toFixed(2)}.
      </p>
      <p className="mt-2 text-xs text-gray-400">
        You can cancel anytime before then.
      </p>

      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }}
        className="mt-4 w-full rounded-lg bg-[#8952fc] px-4 py-3 text-sm font-semibold text-white hover:bg-[#7b40fc]"
      >
        Land your dream role
      </button>
    </div>
  );
}

function OfferDeclinedUsageStep({
  cancellationData,
  patchCancellation,
  offer,
  appliedCount,
  setAppliedCount,
  emailedCount,
  setEmailedCount,
  interviewsCount,
  setInterviewsCount,
  onBack,
  onContinue,
  onAcceptOffer,
  onClose,
}: {
  cancellationData: CancellationRow;
  patchCancellation: (p: Partial<CancellationRow>) => void;
  offer?: DownsellOffer;
  appliedCount?: string;
  setAppliedCount: (v: string) => void;
  emailedCount?: string;
  setEmailedCount: (v: string) => void;
  interviewsCount?: string;
  setInterviewsCount: (v: string) => void;
  onBack: () => void;
  onContinue: () => void;
  onAcceptOffer: () => void;
  onClose: () => void;
}) {
  const allAnswered = Boolean(appliedCount && emailedCount && interviewsCount);
  const fmt = (n: number) =>
    `$${Number.isInteger(n) ? n.toFixed(0) : n.toFixed(2)}`;

  return (
    <div>
      <h2 className="text-[22px] sm:text-[24px] font-bold leading-tight text-gray-900">
        Help us understand how you
        <br className="hidden sm:block" />
        were using Migrate&nbsp;Mate.
      </h2>

      <div className="mt-4 space-y-4">
        <div>
          <label className="mb-1 block text-[11px] tracking-wide text-gray-600">
            How many roles did you <span className="underline">apply</span> for
            through Migrate Mate?*
          </label>
          <PillGroup
            value={appliedCount}
            onChange={setAppliedCount}
            columns={4}
            options={[
              { label: "0", value: "0" },
              { label: "1–5", value: "1-5" },
              { label: "6–20", value: "6-20" },
              { label: "20+", value: "20+" },
            ]}
          />
        </div>

        <div>
          <label className="mb-1 block text-[11px] tracking-wide text-gray-600">
            How many companies did you <span className="underline">email</span>{" "}
            directly?*
          </label>
          <PillGroup
            value={emailedCount}
            onChange={setEmailedCount}
            columns={4}
            options={[
              { label: "0", value: "0" },
              { label: "1–5", value: "1-5" },
              { label: "6–20", value: "6-20" },
              { label: "20+", value: "20+" },
            ]}
          />
        </div>

        <div>
          <label className="mb-1 block text-[11px] tracking-wide text-gray-600">
            How many different companies did you{" "}
            <span className="underline">interview</span> with?*
          </label>
          <PillGroup
            value={interviewsCount}
            onChange={setInterviewsCount}
            columns={4}
            options={[
              { label: "0", value: "0" },
              { label: "1–2", value: "1-2" },
              { label: "3–5", value: "3-5" },
              { label: "5+", value: "5+" },
            ]}
          />
        </div>
      </div>

      {offer && (
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onAcceptOffer();
          }}
          className="mt-5 w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm text-white hover:bg-emerald-700"
        >
          <span className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-sm sm:text-base font-normal">
            <span>{offer.discountLabel}</span>
            <span
              aria-hidden
              className="hidden sm:inline h-4 w-px bg-white/40"
            />
            <span className="tabular-nums">
              {fmt(offer.discountedPrice)}
              <span className="ml-0.5">/mo</span>
            </span>
            <span className="line-through decoration-2 decoration-white/70 opacity-90">
              {fmt(offer.monthlyPrice)}/mo
            </span>
          </span>
        </button>
      )}

      <button
        type="button"
        disabled={!allAnswered}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onContinue();
        }}
        className={`mt-3 w-full rounded-lg px-4 py-3 text-sm font-medium
          ${
            allAnswered
              ? "bg-red-600 text-white hover:bg-red-700"
              : "cursor-not-allowed bg-gray-100 text-gray-400"
          }`}
      >
        Continue
      </button>
    </div>
  );
}

function NoMainReasonStep3({
  cancellationData,
  patchCancellation,
  offer,
  reason,
  setReason,
  otherText,
  setOtherText,
  rating,
  setRating,
  onBack,
  onClose,
  onAcceptOffer,
  onComplete,
}: {
  cancellationData: CancellationRow;
  patchCancellation: (p: Partial<CancellationRow>) => void;
  offer?: DownsellOffer;
  reason?: string;
  setReason: (v: string) => void;
  otherText: string | any;
  setOtherText: (v: string | any) => void;
  rating?: number;
  setRating: (n?: number) => void;
  onBack: () => void;
  onClose: () => void;
  onAcceptOffer: () => void;
  onComplete: () => void;
}) {
  const [maxPrice, setMaxPrice] = React.useState<string>("");
  const minChars = 25;

  const REASONS = [
    "Too expensive",
    "Platform not helpful",
    "Not enough relevant jobs",
    "Decided not to move",
    "Other",
  ] as const;

  const prompts: Record<(typeof REASONS)[number], string> = {
    "Too expensive": "What would be the maximum you would be willing to pay?*",
    "Platform not helpful":
      "What can we change to make the platform more helpful?*",
    "Not enough relevant jobs":
      "In what way can we make the jobs more relevant?*",
    "Decided not to move": "What changed for you to decide to not move?*",
    Other: "What would have helped you the most?*",
  };

  const sanitizeDecimal = React.useCallback((raw: string, maxDecimals = 2) => {
    let v = (raw ?? "").replace(/[^\d.]/g, "");
    if (v.startsWith(".")) v = "0" + v;
    const i = v.indexOf(".");
    if (i !== -1) {
      v = v.slice(0, i + 1) + v.slice(i + 1).replace(/\./g, "");
      const [int, dec = ""] = v.split(".");
      v = int + "." + dec.slice(0, maxDecimals);
    }
    return v;
  }, []);

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = sanitizeDecimal(e.target.value, 2);
    if (next === "" || /^\d*(\.\d{0,2})?$/.test(next)) {
      setMaxPrice(next);
      setOtherText(next);
    }
  };

  const isExpensive = reason === "Too expensive";
  const priceOK =
    !isExpensive ||
    (maxPrice.trim() !== "" &&
      !Number.isNaN(Number(maxPrice)) &&
      Number(maxPrice) >= 0);

  const chars = otherText.length;
  const feedbackOK = isExpensive || chars >= minChars;

  const canComplete = Boolean(
    (reason && priceOK && feedbackOK) || (reason && otherText && feedbackOK)
  );

  const fmt = (n: number) =>
    `$${Number.isInteger(n) ? n.toFixed(0) : n.toFixed(2)}`;

  const RadioRow = ({ label }: { label: (typeof REASONS)[number] }) => (
    <label className="flex items-center gap-2 cursor-pointer select-none py-2 text-sm text-gray-800">
      <input
        type="radio"
        name="cancel-reason"
        className="sr-only"
        checked={reason === label}
        onChange={() => {
          setReason(label);
          patchCancellation({ reason: label }); // persist reason immediately
        }}
      />
      <span
        aria-hidden
        className={`flex h-4 w-4 items-center justify-center rounded-full border ${
          reason === label
            ? "border-gray-900 ring-4 ring-gray-200"
            : "border-gray-400"
        }`}
      >
        <span
          className={`h-2 w-2 rounded-full ${
            reason === label ? "bg-gray-900" : "bg-transparent"
          }`}
        />
      </span>
      {label}
    </label>
  );

  return (
    <div>
      <h2 className="mb-2 text-[24px] sm:text-[26px] font-bold leading-tight text-gray-900">
        What’s the main reason for cancelling?
      </h2>
      <p className="text-xs text-gray-500 mb-3">
        Please take a minute to let us know why:
      </p>

      {!reason ? (
        <div className="space-y-1 mb-2">
          {REASONS.map((r) => (
            <RadioRow key={r} label={r} />
          ))}
        </div>
      ) : (
        <div className="mb-3">
          <RadioRow label={reason as (typeof REASONS)[number]} />
        </div>
      )}

      {reason && (
        <>
          {isExpensive ? (
            <div className="mt-2">
              <label className="mb-1 block text-[11px] tracking-wide text-gray-600">
                {prompts["Too expensive"]}
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                  $
                </span>
                <input
                  id="max-price"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={otherText}
                  onChange={handlePriceChange}
                  onPaste={(e) => {
                    e.preventDefault();
                    const t = (
                      e.clipboardData || (window as any).clipboardData
                    ).getData("text");
                    setOtherText(sanitizeDecimal(t, 2));
                  }}
                  onBlur={() =>
                    setOtherText((v: string | any) => v.replace(/\.$/, ""))
                  }
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder=""
                  className="w-full rounded-lg border border-gray-300 pl-6 pr-3 py-2 text-sm outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-300"
                />
              </div>
            </div>
          ) : (
            <div className="mt-2">
              <label className="mb-1 block text-[11px] tracking-wide text-gray-600">
                {prompts[reason as keyof typeof prompts]}
              </label>
              <div className="relative">
                <textarea
                  value={otherText}
                  onChange={(e) => {
                    setOtherText(e.target.value);
                    patchCancellation({ reason_text: e.target.value }); // persist detail
                  }}
                  rows={6}
                  onKeyDown={(e) => e.stopPropagation()}
                  className="w-full resize-none rounded-xl border border-gray-300 p-3 pr-16 pb-9 text-gray-900 outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-300"
                />
                <span className="pointer-events-none absolute bottom-2 right-3 text-xs text-gray-500">
                  Min {minChars} characters ({chars}/{minChars})
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {offer && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onAcceptOffer();
          }}
          className="mt-5 w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm text-white hover:bg-emerald-700"
        >
          <span className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-sm sm:text-base font-normal">
            <span>{offer.discountLabel}</span>
            <span
              aria-hidden
              className="hidden sm:inline h-4 w-px bg-white/40"
            />
            <span className="tabular-nums">
              {fmt(offer.discountedPrice)}
              <span className="ml-0.5">/mo</span>
            </span>
            <span className="line-through decoration-2 decoration-white/70 opacity-90">
              {fmt(offer.monthlyPrice)}/mo
            </span>
          </span>
        </button>
      )}

      <button
        disabled={!canComplete}
        onClick={onComplete}
        className={`mt-3 w-full rounded-lg px-4 py-3 text-sm font-medium ${
          canComplete
            ? "bg-gray-900 text-white hover:bg-black"
            : "cursor-not-allowed bg-gray-100 text-gray-400"
        }`}
      >
        Complete cancellation
      </button>
    </div>
  );
}

function NoFlowCancelledFinal({
  endDate,
  onBack,
  onClose,
}: {
  endDate?: Date;
  onBack: () => void;
  onClose: () => void;
}) {
  const dateStr = endDate
    ? endDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "XX date";

  return (
    <div>
      <h2 className="text-[28px] sm:text-[30px] font-bold leading-snug text-gray-900">
        Sorry to see you go, mate.
      </h2>
      <p className="mt-3 text-xl font-semibold text-gray-900">
        Thanks for being with us, and you’re
        <br className="hidden sm:block" />
        always welcome back.
      </p>

      <p className="mt-4 text-sm text-gray-600">
        Your subscription is set to end on {dateStr}.<br />
        You’ll still have full access until then. No further charges after that.
      </p>
      <p className="mt-2 text-sm text-gray-600">
        Changed your mind? You can reactivate anytime before your end date.
      </p>

      <button
        onClick={onClose}
        className="mt-5 w-full rounded-lg bg-[#8952fc] px-4 py-3 text-sm font-semibold text-white hover:bg-[#7b40fc]"
      >
        Back to Jobs
      </button>
    </div>
  );
}

/* ======================= main component ======================= */

export default function CancelComponent({
  isOpen,
  onClose,
  userEmail,
  userDetails,
  subscriptionDetails,
}: Props) {
  const [route, setRoute] = useState<Route>("question");
  const dialogRef = useRef<HTMLDivElement>(null);

  // YES – Step 1 state
  const [foundViaMM, setFoundViaMM] = useState<"yes" | "no">();
  const [appliedCount, setAppliedCount] = useState<string>();
  const [emailedCount, setEmailedCount] = useState<string>();
  const [interviewsCount, setInterviewsCount] = useState<string>();

  // YES – Step 2 state
  const [feedback, setFeedback] = useState("");
  const minChars = 25;

  // YES – Step 3 state
  const [visaLawyer, setVisaLawyer] = useState<"yes" | "no">();
  const [visaType, setVisaType] = useState<string>("");

  const [downsellAccepted, setDownsellAccepted] = useState<null | {
    variant: DownsellVariant;
    originalPrice: number;
    discountedPrice: number;
    nextBillingDate: Date;
    daysLeft: number;
  }>(null);

  const [declinedOffer, setDeclinedOffer] = useState<DownsellOffer | undefined>(
    undefined
  );
  const [cancelReason, setCancelReason] = useState<string | undefined>();
  const [cancelOther, setCancelOther] = useState("");
  const [satisfaction, setSatisfaction] = useState<number | undefined>();
  const [abVariant, setAbVariant] = useState<DownsellVariant | null>(null);

  const [subscriptionData, setSubscriptionData] =
    useState<Subscription>(subscriptionDetails);

  const [cancellationData, setCancellationData] = useState<CancellationRow>({
    user_id: userDetails.id,
    subscription_id: null,
    downsell_variant: null,
    accepted_downsell: null,
    reason: null,
    attributed_to_mm: null,
    applied_count: null,
    emailed_count: null,
    interview_count: null,
    visa_has_lawyer: null,
    visa_type: null,
  });

  const patchCancellation = (patch: Partial<CancellationRow>) =>
    setCancellationData((prev) => ({
      ...prev,
      ...patch,
      updated_at: new Date().toISOString(),
    }));

  const { isNoDownsell, noTotalSteps } = React.useMemo(() => {
    const noDownsell = abVariant === "A";
    return { isNoDownsell: noDownsell, noTotalSteps: noDownsell ? 2 : 3 };
  }, [abVariant]);

  const noStepActive = React.useCallback(
    (r: Route): number | undefined => {
      if (!abVariant) return undefined;
      switch (r) {
        case "no.step1":
          return isNoDownsell ? undefined : 1;
        case "no.usage":
          return isNoDownsell ? 1 : 2;
        case "no.step3":
          return isNoDownsell ? 2 : 3;
        default:
          return undefined;
      }
    },
    [abVariant, isNoDownsell]
  );

  // reset when opening
  useEffect(() => {
    if (isOpen) {
      setRoute("question");
      setFoundViaMM(undefined);
      setAppliedCount(undefined);
      setEmailedCount(undefined);
      setInterviewsCount(undefined);
      setFeedback("");
      setCancelReason(undefined);
      setCancelOther("");
      setVisaLawyer(undefined);
      setVisaType("");
      setAbVariant(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    (async () => {
      const row = await getExistingCancellationRow(userDetails.id);
      if (!alive || !row) {
        patchCancellation({ subscription_id: subscriptionData.id });
        return;
      }
      setCancellationData(row);
      if (row.attributed_to_mm !== null && row.attributed_to_mm !== undefined) {
        setFoundViaMM(row.attributed_to_mm ? "yes" : "no");
      }
      if (row.applied_count) setAppliedCount(row.applied_count);
      if (row.emailed_count) setEmailedCount(row.emailed_count);
      if (row.interview_count) setInterviewsCount(row.interview_count);
      if (row.visa_has_lawyer !== null && row.visa_has_lawyer !== undefined) {
        setVisaLawyer(row.visa_has_lawyer ? "yes" : "no");
      }
      if (row.visa_type) setVisaType(row.visa_type);
      if (row.feedback) setFeedback(row.feedback);
      if (row.reason) setCancelReason(row.reason);
      if (row.reason_text) setCancelOther(row.reason_text);
      if (row.downsell_variant) setAbVariant(row.downsell_variant);
    })();

    return () => {
      alive = false;
    };
  }, [isOpen, userDetails.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          (t as any).isContentEditable)
      )
        return;
      if (e.key === "Escape") handlePersistAndClose();
    };
    if (isOpen) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  const handlePersistAndClose = async (persistPrice: boolean = false) => {
    try {
      console.log("Persisting Data:", {
        subscription: subscriptionData,
        cancellation: cancellationData,
      });

      // --- Upsert subscription ---
      // --- Upsert subscription ---
      if (subscriptionData) {
        // Build patch object dynamically
        const patch: any = {
          user_id: subscriptionData.userId ?? userDetails?.id,
          status: subscriptionData.status,
        };

        if (persistPrice) {
          patch.monthly_price = subscriptionData.monthlyPrice;
        }

        const { data, error } = await supabase.rpc("fn_upsert_subscription", {
          p_id: subscriptionData.id ?? null,
          p_user_id: subscriptionData.userId ?? userDetails?.id,
          p_patch: patch,
        });

        if (error) throw error;
        console.log("Subscription upsert result:", data);
        setSubscriptionData(data); // update state
      }

      // --- Upsert cancellation (all fields) ---
      if (cancellationData) {
        const { data, error } = await supabase.rpc("fn_upsert_cancellation", {
          p_id: cancellationData.id ?? null,
          p_user_id: cancellationData.user_id ?? userDetails?.id,
          p_subscription_id: cancellationData.subscription_id,
          p_patch: {
            subscription_id: cancellationData.subscription_id,
            downsell_variant: cancellationData.downsell_variant,
            accepted_downsell: cancellationData.accepted_downsell,
            feedback: cancellationData.feedback,
            reason: cancellationData.reason,
            reason_text: cancellationData.reason_text,
            attributed_to_mm: cancellationData.attributed_to_mm,
            applied_count: cancellationData.applied_count,
            emailed_count: cancellationData.emailed_count,
            interview_count: cancellationData.interview_count,
            visa_has_lawyer: cancellationData.visa_has_lawyer,
            visa_type: cancellationData.visa_type,
          },
        });

        if (error) throw error;
        console.log("Cancellation upsert result:", data);
        setCancellationData(data); // update state
      }
    } catch (err) {
      console.error("Persist error:", err);
      throw err;
    } finally {
      onClose();
    }
  };

  useEffect(() => {
    if (subscriptionData?.status === "cancelled") {
      handlePersistAndClose();
    }
  }, [subscriptionData?.status]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-2 sm:px-3"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) handlePersistAndClose();
      }}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-[420px] sm:max-w-md md:max-w-5xl rounded-2xl bg-white shadow-xl overflow-hidden"
      >
        {/* Step: Question */}
        {route === "question" && (
          <SectionFrame
            imageMode="top-mobile-right-desktop"
            onClose={handlePersistAndClose}
          >
            <CancelQuestion
              onYes={() => {
                setSubscriptionData((prev) => ({
                  ...prev,
                  status: "pending_cancellation",
                }));
                setRoute("yes.step1");
              }}
              onNo={() => {
                setSubscriptionData((prev) => ({
                  ...prev,
                  status: "pending_cancellation",
                }));
                const v =
                  abVariant != null ? abVariant : getVariantStable(userEmail);
                setAbVariant(v);
                patchCancellation({ downsell_variant: v });
                setRoute(v === "A" ? "no.usage" : "no.step1");
              }}
            />
          </SectionFrame>
        )}

        {/* YES – 1 */}
        {route === "yes.step1" && (
          <SectionFrame
            showBack
            onBack={() => setRoute("question")}
            stepActive={1}
            stepTotal={3}
            imageMode="right-hide-mobile"
            onClose={handlePersistAndClose}
          >
            <CancelYesStep1
              cancellationData={cancellationData}
              patchCancellation={patchCancellation}
              userEmail={userEmail}
              foundViaMM={foundViaMM}
              setFoundViaMM={(v) => {
                setFoundViaMM(v);
                patchCancellation({ attributed_to_mm: v === "yes" });
              }}
              appliedCount={appliedCount}
              setAppliedCount={(v) => {
                setAppliedCount(v);
                patchCancellation({ applied_count: v as AppliedCount });
              }}
              emailedCount={emailedCount}
              setEmailedCount={(v) => {
                setEmailedCount(v);
                patchCancellation({ emailed_count: v as EmailedCount });
              }}
              interviewsCount={interviewsCount}
              setInterviewsCount={(v) => {
                setInterviewsCount(v);
                patchCancellation({ interview_count: v as InterviewCount });
              }}
              onNext={() => setRoute("yes.step2")}
            />
          </SectionFrame>
        )}

        {/* YES – 2 */}
        {route === "yes.step2" && (
          <SectionFrame
            showBack
            onBack={() => setRoute("yes.step1")}
            stepActive={2}
            stepTotal={3}
            imageMode="right-hide-mobile"
            onClose={handlePersistAndClose}
          >
            <CancelYesStep2
              cancellationData={cancellationData}
              patchCancellation={patchCancellation}
              feedback={feedback}
              setFeedback={(t) => {
                setFeedback(t);
              }}
              minChars={minChars}
              onContinue={() => setRoute("yes.step3")}
            />
          </SectionFrame>
        )}

        {/* YES – 3 */}
        {route === "yes.step3" && (
          <SectionFrame
            showBack
            onBack={() => setRoute("yes.step2")}
            stepActive={3}
            stepTotal={3}
            imageMode="right-hide-mobile"
            onClose={handlePersistAndClose}
          >
            <VisaQuestionStep3
              cancellationData={cancellationData}
              patchCancellation={patchCancellation}
              foundViaMM={foundViaMM}
              visaLawyer={visaLawyer}
              setVisaLawyer={(v) => {
                setVisaLawyer(v);
                patchCancellation({ visa_has_lawyer: v === "yes" });
              }}
              visaType={visaType}
              setVisaType={(v) => {
                setVisaType(v);
                patchCancellation({ visa_type: v });
              }}
              onComplete={() => setRoute("yes.done")}
            />
          </SectionFrame>
        )}

        {/* YES – Success */}
        {route === "yes.done" && (
          <SectionFrame
            title="Subscription Cancelled"
            showBack
            onBack={() => setRoute("yes.step3")}
            imageMode="right-hide-mobile"
            onClose={handlePersistAndClose}
          >
            <CancelSuccess
              visaLawyer={visaLawyer}
              contactName="Mihailo Basic"
              contactEmail="mihailo@migratemate.co"
              contactAvatar="/mihailo-profile.jpeg"
              onFinish={() => {
                setSubscriptionData((prev) => ({
                  ...prev,
                  status: "cancelled",
                }));
                // console.log(subscriptionData);
                // handlePersistAndClose();
              }}
            />
          </SectionFrame>
        )}

        {/* NO – 1 (Variant B) */}
        {route === "no.step1" && abVariant === "B" && (
          <SectionFrame
            showBack
            onBack={() => setRoute("question")}
            stepActive={noStepActive("no.step1")}
            stepTotal={noTotalSteps}
            imageMode="right-hide-mobile"
            onClose={handlePersistAndClose}
          >
            <NoDownsellFunction
              //userEmail={userEmail}
              monthlyPrice={subscriptionData.monthlyPrice}
              variant={abVariant}
              onAccept={async (offer) => {
                patchCancellation({
                  accepted_downsell: true,
                  downsell_variant: offer.variant,
                });
                setSubscriptionData((prev) => ({
                  ...prev,
                  status: "active",
                  cancelAtPeriodEnd: false,
                  downsellAccepted: true, // optional: mirror the accepted offer in subscription state
                  //monthlyPrice: offer.discountedPrice,
                }));
                const nextBillingDate = new Date(
                  subscriptionData.currentPeriodEnd
                );
                const daysLeft = Math.max(
                  0,
                  Math.ceil(
                    (nextBillingDate.getTime() - Date.now()) /
                      (24 * 60 * 60 * 1000)
                  )
                );
                setDownsellAccepted({
                  variant: offer.variant,
                  originalPrice: offer.monthlyPrice,
                  discountedPrice: offer.discountedPrice,
                  nextBillingDate,
                  daysLeft,
                });
                setRoute("no.step2");
              }}
              onDecline={(offer) => {
                setDeclinedOffer(offer);
                setRoute("no.usage");
              }}
            />
          </SectionFrame>
        )}

        {/* NO – 2 (accepted offer) */}
        {route === "no.step2" && downsellAccepted && (
          <SectionFrame
            title="Subscription"
            mobileTitle="Subscription Continued"
            imageMode="top-mobile-right-desktop"
            onClose={handlePersistAndClose}
          >
            <NoDownsellAccepted
              discountedPrice={downsellAccepted.discountedPrice}
              nextBillingDate={downsellAccepted.nextBillingDate}
              daysLeft={downsellAccepted.daysLeft}
              onBack={() => setRoute("no.step1")}
              onClose={() => handlePersistAndClose(true)}
            />
          </SectionFrame>
        )}

        {/* NO – usage */}
        {route === "no.usage" && (
          <SectionFrame
            showBack
            onBack={() => setRoute(isNoDownsell ? "question" : "no.step1")}
            stepActive={noStepActive("no.usage")}
            stepTotal={noTotalSteps}
            imageMode="right-hide-mobile"
            onClose={handlePersistAndClose}
          >
            <OfferDeclinedUsageStep
              cancellationData={cancellationData}
              patchCancellation={patchCancellation}
              offer={declinedOffer}
              appliedCount={appliedCount}
              setAppliedCount={(v) => {
                setAppliedCount(v);
                patchCancellation({ applied_count: v as AppliedCount });
              }}
              emailedCount={emailedCount}
              setEmailedCount={(v) => {
                setEmailedCount(v);
                patchCancellation({ emailed_count: v as EmailedCount });
              }}
              interviewsCount={interviewsCount}
              setInterviewsCount={(v) => {
                setInterviewsCount(v);
                patchCancellation({ interview_count: v as InterviewCount });
              }}
              onBack={() => setRoute("no.step1")}
              onClose={handlePersistAndClose}
              onAcceptOffer={async () => {
                if (!declinedOffer) return;
                patchCancellation({
                  accepted_downsell: true,
                  downsell_variant: declinedOffer.variant,
                });
                setSubscriptionData((prev) => ({
                  ...prev,
                  status: "active",
                  //monthlyPrice: declinedOffer.discountedPrice
                }));
                const nextBillingDate = new Date(
                  subscriptionData.currentPeriodEnd
                );
                const daysLeft = Math.max(
                  0,
                  Math.ceil(
                    (nextBillingDate.getTime() - Date.now()) /
                      (24 * 60 * 60 * 1000)
                  )
                );
                setDownsellAccepted({
                  variant: declinedOffer.variant,
                  originalPrice: declinedOffer.monthlyPrice,
                  discountedPrice: declinedOffer.discountedPrice,
                  nextBillingDate,
                  daysLeft,
                });
                setRoute("no.step2");
              }}
              onContinue={() => setRoute("no.step3")}
            />
          </SectionFrame>
        )}

        {/* NO – reason */}
        {route === "no.step3" && (
          <SectionFrame
            showBack
            onBack={() => setRoute("no.usage")}
            stepActive={isNoDownsell ? 2 : 3}
            stepTotal={noTotalSteps}
            imageMode="right-hide-mobile"
            onClose={handlePersistAndClose}
          >
            <NoMainReasonStep3
              cancellationData={cancellationData}
              patchCancellation={patchCancellation}
              offer={isNoDownsell ? undefined : declinedOffer ?? undefined}
              reason={cancelReason}
              setReason={(v) => {
                setCancelReason(v);
                patchCancellation({
                  reason:
                    v === "Other"
                      ? cancelOther
                        ? `Other: ${cancelOther}`
                        : "Other"
                      : v,
                });
              }}
              otherText={cancelOther}
              setOtherText={(t) => {
                setCancelOther(t);
                patchCancellation({
                  reason:
                    cancelReason === "Other"
                      ? `Other: ${t}`
                      : cancelReason ?? null,
                });
              }}
              rating={satisfaction}
              setRating={setSatisfaction}
              onBack={() => setRoute("no.usage")}
              onClose={handlePersistAndClose}
              onAcceptOffer={async () => {
                if (!declinedOffer) return;
                patchCancellation({
                  accepted_downsell: true,
                  downsell_variant: declinedOffer.variant,
                });
                setSubscriptionData((prev) => ({
                  ...prev,
                  status: "active",
                  monthlyPrice: declinedOffer.discountedPrice,
                }));
                const nextBillingDate = new Date(
                  subscriptionData.currentPeriodEnd
                );
                const daysLeft = Math.max(
                  0,
                  Math.ceil(
                    (nextBillingDate.getTime() - Date.now()) /
                      (24 * 60 * 60 * 1000)
                  )
                );
                setDownsellAccepted({
                  variant: declinedOffer.variant,
                  originalPrice: declinedOffer.monthlyPrice,
                  discountedPrice: declinedOffer.discountedPrice,
                  nextBillingDate,
                  daysLeft,
                });
                setRoute("no.step2");
              }}
              onComplete={async () => {
                patchCancellation({
                  reason: cancelReason,
                  reason_text: cancelOther,
                });
                setRoute("no.done");
              }}
            />
          </SectionFrame>
        )}

        {/* NO – done */}
        {route === "no.done" && (
          <SectionFrame
            title="Subscription Cancelled"
            imageMode="right-hide-mobile"
            onClose={handlePersistAndClose}
          >
            <NoFlowCancelledFinal
              endDate={new Date()}
              onBack={() => setRoute("no.step3")}
              onClose={async () => {
                // First update local UI state
                setSubscriptionData((prev) => ({
                  ...prev,
                  status: "cancelled",
                }));
              }}
            />
          </SectionFrame>
        )}
      </div>
    </div>
  );
}
