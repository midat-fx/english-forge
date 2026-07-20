import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  FileAudio,
  Headphones,
  Mic2,
  Pencil,
  Repeat2,
  Save,
  ShieldCheck,
  TimerReset,
  Trash2,
  Upload,
  Volume2,
  X,
} from "lucide-react";
import { AudioRecorderPanel } from "../components/AudioRecorderPanel";
import type { LocalAudioCapture } from "../hooks/useAudioRecorder";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { FieldShell, Input, Select, Textarea } from "../components/ui/Field";
import { MarginNote } from "../components/ui/MarginNote";
import { Diff } from "../components/ui/Diff";
import { Rule } from "../components/ui/Rule";
import { Stamp } from "../components/ui/Stamp";
import { includesPhrase } from "../domain/normalization";
import { activationRecognitionLabel, redactAcceptedForms } from "../domain/practice";
import { hasQualifiedActivationThrough } from "../domain/activation";
import { DICTATION_MATCH_RATIO, dictationMatches, dictationWordScore, selectDailyListeningReference } from "../domain/listening";
import { grammarAcademyLessons } from "../data/grammarAcademy";
import { LISTENING_PROMPTS_BY_LEVEL } from "../data/listeningPromptBank";
import {
  isSpeakingEvidenceAttempt,
  speakingEvidencePhraseIds,
} from "../domain/speaking";
import { promptWithGrammarFocus, selectSpeakingGrammarFocus, stripPersistedGrammarFocus } from "../domain/speakingPrompt";
import type { CEFRLevel, Phrase, SpeakingMode } from "../domain/types";
import {
  deleteRecording,
  readRecording,
  reserveRecordingRegistration,
  writeRecording,
} from "../lib/audioStorage";
import { formatShortDate } from "../lib/utils";
import { readTranscriptFile } from "../lib/transcriptFile";
import { useForgeStore } from "../store/useForgeStore";
import { useSearchParams } from "react-router-dom";
import { useLocalToday } from "../hooks/useLocalToday";

type LabTab = "speaking" | "listening";

const DEFAULT_PROMPTS: Record<CEFRLevel, string> = {
  A2: "Describe your usual morning. What do you do first, and what helps you start the day?",
  B1: "Describe a useful habit you started or stopped. Explain why it changed your routine.",
  B2: "Describe a decision you recently reconsidered. Explain what changed your mind and what you would do next.",
  C1: "Evaluate a belief or working assumption you have revised. Explain the evidence and the wider consequences.",
};
const FLUENCY_SECONDS = [60, 45, 30] as const;
/**
 * Наглядная выборка для строкомера порога диктанта. Число совпавших слов
 * ВЫВОДИТСЯ из DICTATION_MATCH_RATIO, а не набирается литералом: порог живёт
 * в domain/listening, и показ обязан ехать за ним.
 */
const DICTATION_SAMPLE_WORDS = 20;
const DICTATION_THRESHOLD_WORDS = Math.ceil(DICTATION_SAMPLE_WORDS * DICTATION_MATCH_RATIO);

function redactSpeakingTargets(value: string, targets: readonly Phrase[]): string {
  return targets.reduce(
    (redacted, phrase) => redactAcceptedForms(redacted, phrase.canonical, phrase.acceptedForms),
    value,
  );
}

function speakingRetrievalCue(phrase: Phrase, hiddenTargets: readonly Phrase[]): string {
  const targets = hiddenTargets.some((target) => target.id === phrase.id)
    ? hiddenTargets
    : [phrase, ...hiddenTargets];
  const meaning = redactSpeakingTargets(activationRecognitionLabel(phrase), targets);
  if (/\p{L}|\p{N}/u.test(meaning)) return meaning;
  const context = redactSpeakingTargets(phrase.context, targets);
  if (/\p{L}|\p{N}/u.test(context)) return context;
  return `Вспомните сохранённое выражение уровня ${phrase.cefr}.`;
}

function contentLanguage(value: string): "ru" | "en" {
  return /\p{Script=Cyrillic}/u.test(value) ? "ru" : "en";
}

const speakingModeLabels: Record<SpeakingMode, string> = {
  targeted_response: "Ответ с целевыми фразами",
  fluency_432: "Лестница 60/45/30",
  shadowing: "Теневой повтор",
};

function localizeVoiceError(error: unknown, fallback: string): string {
  const message = typeof error === "string" ? error : error instanceof Error ? error.message : "";
  const durationLimit = message.match(/cannot exceed (\d+) seconds/u)?.[1];
  if (durationLimit) return `Эта речевая попытка не может длиться дольше ${durationLimit} секунд.`;
  const nextRound = message.match(/Round (\d+) is required next/u)?.[1];
  if (nextRound) return `Сохраняйте раунды по порядку. Следующим нужен раунд ${nextRound}.`;
  if (message.includes("Record at least one second")) return "Перед сохранением запишите хотя бы одну секунду.";
  if (message.includes("Add a recording or a transcript")) return "Перед сохранением добавьте запись или транскрипцию.";
  if (message.includes("Each 60/45/30 round")) return "Для каждого раунда 60/45/30 нужна сохранённая аудиозапись.";
  if (message.includes("Keep the same prompt and target chunks")) return "Во всех трёх раундах сохраняйте одну тему и те же целевые выражения.";
  if (message.includes("listening clip must be between 1 and 300 seconds")) return "Фрагмент для аудирования должен длиться от 1 до 300 секунд.";
  if (message.includes("Complete the listening response")) return "Перед сохранением заполните ответ по аудированию.";
  if (message.includes("Listening practice must be between 1 and 300 seconds")) return "Практика аудирования должна длиться от 1 до 300 секунд.";
  if (message.includes("Finish playing the audio")) return "Сначала прослушайте аудио до конца.";
  if (message.includes("immutable reference snapshot")) return "Для проверки совпадения нужен сохранённый текст фрагмента.";
  if (message.includes("empty recording")) return "Нельзя сохранить пустую аудиозапись.";
  if (message.includes("25 MiB")) return "Одна аудиозапись не может превышать 25 МиБ.";
  if (message.includes("already being registered")) return "Эта аудиозапись уже сохраняется.";
  if (message.includes("does not exist in this browser")) return "Аудиозапись не найдена.";
  if (message.includes("profile changed repeatedly")) return "Профиль несколько раз изменился во время сохранения. Повторите действие.";
  if (message.includes("Add at least one English word or expression")) return "Добавьте хотя бы одно английское слово или выражение.";
  return fallback;
}

function speakingMessageIsError(message: string): boolean {
  return /^(добавьте|во всех|дождитесь|для каждого|запишите|не удалось|нельзя|одна|перед сохранением|подтвердите|профиль|сначала|сохраняйте|эта)/iu.test(message);
}

function formatSegmentTime(seconds: number) {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  return `${String(minutes).padStart(2, "0")}:${(safe % 60).toFixed(1).padStart(4, "0")}`;
}

export function VoiceLabPage() {
  const [searchParams] = useSearchParams();
  const handoffSupportUsed = searchParams.get("support") === "1";
  const requestedTab: LabTab = searchParams.get("tab") === "listening" ? "listening" : "speaking";
  const [tab, setTab] = useState<LabTab>(requestedTab);
  useEffect(() => setTab(requestedTab), [requestedTab]);
  function moveTab(event: ReactKeyboardEvent<HTMLButtonElement>, current: LabTab) {
    const order: LabTab[] = ["speaking", "listening"];
    const direction = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!direction && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const next = event.key === "Home"
      ? order[0]
      : event.key === "End"
        ? order.at(-1)!
        : order[(order.indexOf(current) + direction + order.length) % order.length];
    setTab(next);
    document.getElementById(`voice-${next}-tab`)?.focus();
  }
  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-light leading-snug tracking-tight text-primary">
          Слушайте, говорите, проверяйте, повторяйте.
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-secondary">
          В историю обучения попадает только то, что вы сами подтвердили.
        </p>
      </header>
      <div
        role="tablist"
        aria-label="Раздел голосовой студии"
        aria-orientation="horizontal"
        className="grid w-full grid-cols-2 gap-px rounded-[3px] border border-border bg-border sm:inline-grid sm:w-auto"
      >
        <button
          id="voice-speaking-tab"
          role="tab"
          type="button"
          aria-selected={tab === "speaking"}
          aria-controls="voice-speaking-panel"
          tabIndex={tab === "speaking" ? 0 : -1}
          onKeyDown={(event) => moveTab(event, "speaking")}
          onClick={() => setTab("speaking")}
          className={`detent relative min-h-11 px-5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus ${tab === "speaking" ? "bg-recess text-primary shadow-[var(--bevel-down)]" : "bg-elevated text-muted hover:text-primary"}`}
        >
          <Mic2 className="mr-2 inline size-4" aria-hidden="true" />
          Говорить
          {tab === "speaking" && <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[2px] bg-rubric" />}
        </button>
        <button
          id="voice-listening-tab"
          role="tab"
          type="button"
          aria-selected={tab === "listening"}
          aria-controls="voice-listening-panel"
          tabIndex={tab === "listening" ? 0 : -1}
          onKeyDown={(event) => moveTab(event, "listening")}
          onClick={() => setTab("listening")}
          className={`detent relative min-h-11 px-5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus ${tab === "listening" ? "bg-recess text-primary shadow-[var(--bevel-down)]" : "bg-elevated text-muted hover:text-primary"}`}
        >
          <Headphones className="mr-2 inline size-4" aria-hidden="true" />
          Слушать
          {tab === "listening" && <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[2px] bg-rubric" />}
        </button>
      </div>
      {tab === "speaking" ? <div id="voice-speaking-panel" role="tabpanel" aria-labelledby="voice-speaking-tab"><SpeakingStudio targetPhraseId={searchParams.get("phrase") ?? undefined} handoffSupportUsed={handoffSupportUsed} /></div> : <div id="voice-listening-panel" role="tabpanel" aria-labelledby="voice-listening-tab"><ListeningLibrary /></div>}
    </div>
  );
}

function SpeakingStudio({ targetPhraseId, handoffSupportUsed = false }: { targetPhraseId?: string; handoffSupportUsed?: boolean }) {
  const level = useForgeStore((state) => state.preferences.currentLevel);
  const phrases = useForgeStore((state) => state.phrases);
  const skillStates = useForgeStore((state) => state.skillStates);
  const attempts = useForgeStore((state) => state.speakingAttempts);
  const grammarProgress = useForgeStore((state) => state.grammarProgress);
  const recordAttempt = useForgeStore((state) => state.recordSpeakingAttempt);
  const removeAttempt = useForgeStore((state) => state.deleteSpeakingAttempt);
  const dueSpokenIds = useMemo(() => new Set(skillStates
    .filter((state) => state.skill === "spoken_productive" && state.phase !== "suspended" && new Date(state.dueAt).getTime() <= Date.now())
    .map((state) => state.phraseId)), [skillStates]);
  const practicedIds = useMemo(() => new Set([
    ...skillStates.filter((state) => state.attempts > 0).map((state) => state.phraseId),
    ...phrases.filter((phrase) => (phrase.activationStage ?? 0) >= 6).map((phrase) => phrase.id),
  ]), [phrases, skillStates]);
  const awaitingStageSevenIds = useMemo(() => new Set(phrases
    .filter((phrase) => phrase.cefr === level
      && phrase.status !== "archived"
      && phrase.status !== "needs_enrichment"
      && (phrase.activationStage ?? 0) === 6
      && hasQualifiedActivationThrough(phrase, 6))
    .map((phrase) => phrase.id)), [level, phrases]);
  const candidates = useMemo(() => {
    const eligible = phrases.filter(
      (phrase) => phrase.status !== "archived" && phrase.status !== "needs_enrichment" && (phrase.meaning || phrase.context) && (phrase.cefr === level || phrase.id === targetPhraseId),
    );
    const requested = eligible.find((phrase) => phrase.id === targetPhraseId);
    const ordered = eligible.filter((phrase) => practicedIds.has(phrase.id)).sort((left, right) =>
      Number(awaitingStageSevenIds.has(right.id)) - Number(awaitingStageSevenIds.has(left.id))
      || Number(dueSpokenIds.has(right.id)) - Number(dueSpokenIds.has(left.id))
      || (left.activationUpdatedAt ?? left.updatedAt).localeCompare(right.activationUpdatedAt ?? right.updatedAt)
      || left.updatedAt.localeCompare(right.updatedAt));
    return requested ? [requested, ...ordered.filter((phrase) => phrase.id !== requested.id)].slice(0, 24) : ordered.slice(0, 24);
  }, [awaitingStageSevenIds, dueSpokenIds, level, phrases, practicedIds, targetPhraseId]);
  const grammarFocus = useMemo(() => selectSpeakingGrammarFocus(grammarAcademyLessons, grammarProgress, level), [grammarProgress, level]);
  const [mode, setMode] = useState<SpeakingMode>("targeted_response");
  const [prompt, setPrompt] = useState(() => DEFAULT_PROMPTS[level]);
  const [targets, setTargets] = useState<string[]>(() => {
    const requested = candidates.find((phrase) => phrase.id === targetPhraseId);
    return requested ? [requested.id] : candidates.slice(0, 2).map((phrase) => phrase.id);
  });
  const [transcript, setTranscript] = useState("");
  const [confirmed, setConfirmed] = useState<string[]>([]);
  const [clarity, setClarity] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [flow, setFlow] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [supportUsed, setSupportUsed] = useState(handoffSupportUsed);
  const [targetExposureUsedEver, setTargetExposureUsedEver] = useState(false);
  const [grammarConfirmed, setGrammarConfirmed] = useState(false);
  const [capture, setCapture] = useState<LocalAudioCapture>();
  const [round, setRound] = useState<1 | 2 | 3>(1);
  const [sessionId, setSessionId] = useState<string>(() => crypto.randomUUID());
  const [recorderKey, setRecorderKey] = useState(0);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  /* oxlint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    const requested = phrases.find((phrase) => phrase.id === targetPhraseId && phrase.status !== "archived" && phrase.status !== "needs_enrichment");
    setMode("targeted_response");
    setPrompt(DEFAULT_PROMPTS[level]);
    setTargets(requested ? [requested.id] : candidates.slice(0, 2).map((phrase) => phrase.id));
    setTranscript("");
    setConfirmed([]);
    setSupportUsed(handoffSupportUsed);
    setTargetExposureUsedEver(false);
    setGrammarConfirmed(false);
    setCapture(undefined);
    setRound(1);
    setSessionId(crypto.randomUUID());
    setRecorderKey((value) => value + 1);
    setMessage("");
  }, [targetPhraseId, level]);
  /* oxlint-enable react-hooks/exhaustive-deps */

  useEffect(() => {
    if (handoffSupportUsed) setSupportUsed(true);
  }, [handoffSupportUsed]);

  const targetPhrases = targets
    .map((id) => phrases.find((phrase) => phrase.id === id))
    .filter((phrase): phrase is Phrase => Boolean(phrase));
  const detected = targetPhrases
    .filter((phrase) =>
      includesPhrase(transcript, phrase.canonical, phrase.acceptedForms),
    )
    .map((phrase) => phrase.id);
  const visibleSupportUsesTarget = targetPhrases.some((phrase) =>
    [prompt, grammarFocus?.title ?? "", grammarFocus?.formula ?? "", grammarFocus?.example ?? ""]
      .some((value) => includesPhrase(value, phrase.canonical, phrase.acceptedForms)),
  );
  const attemptSupportUsed = supportUsed || targetExposureUsedEver || visibleSupportUsesTarget || handoffSupportUsed;
  const maxDuration = mode === "fluency_432" ? FLUENCY_SECONDS[round - 1] : 180;

  useEffect(() => {
    if (visibleSupportUsesTarget) setTargetExposureUsedEver(true);
  }, [visibleSupportUsesTarget]);

  useEffect(() => {
    if (targetPhraseId) return;
    const families = new Map<string, typeof attempts>();
    for (const attempt of attempts) {
      if (attempt.mode !== "fluency_432") continue;
      families.set(attempt.sessionId, [...(families.get(attempt.sessionId) ?? []), attempt]);
    }
    const incomplete = [...families.entries()]
      .map(([id, family]) => ({ id, family: [...family].sort((left, right) => (left.round ?? 0) - (right.round ?? 0)) }))
      .filter(({ family }) => family.length > 0 && family.length < 3 && family.every((attempt, index) => attempt.round === index + 1))
      .filter(({ family }) => family[0].targetPhraseIds.length > 0 && family[0].targetPhraseIds.every((id) => phrases.some((phrase) => phrase.id === id && phrase.cefr === level)))
      .sort((left, right) => right.family.at(-1)!.createdAt.localeCompare(left.family.at(-1)!.createdAt))[0];
    const first = incomplete?.family[0];
    if (!first || sessionId === incomplete.id) return;
    setMode("fluency_432");
    setSessionId(incomplete.id);
    setRound((incomplete.family.length + 1) as 2 | 3);
    setPrompt(stripPersistedGrammarFocus(first.prompt));
    setGrammarConfirmed(Boolean(grammarFocus && first.prompt.includes(`[Grammar focus ${grammarFocus.lessonId}; self-confirmed]`)));
    setTargets(first.targetPhraseIds);
    setSupportUsed(handoffSupportUsed || incomplete.family.some((attempt) => attempt.supportUsed));
    setMessage(`Продолжаем незавершённую лестницу 60/45/30 с раунда ${incomplete.family.length + 1}.`);
  }, [attempts, grammarFocus, handoffSupportUsed, level, phrases, sessionId, targetPhraseId]);

  function toggleTarget(id: string) {
    if (mode === "fluency_432" && round > 1) return;
    setTargets((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : current.length < 3
          ? [...current, id]
          : current,
    );
    setConfirmed((current) => current.filter((item) => item !== id));
  }

  async function saveAttempt() {
    setMessage("");
    if (!prompt.trim()) {
      setMessage("Добавьте тему перед сохранением.");
      return;
    }
    if (mode !== "shadowing" && grammarFocus && !grammarConfirmed) {
      setMessage("Подтвердите, что вы сознательно использовали указанную грамматическую модель.");
      return;
    }
    if (mode === "shadowing" && !capture) {
      setMessage("Перед сохранением теневого повтора запишите или импортируйте аудио.");
      return;
    }
    if (!capture && !transcript.trim()) {
      setMessage("Запишите попытку, импортируйте аудио или добавьте транскрипцию вручную.");
      return;
    }
    if (capture && capture.durationSeconds < 1) {
      setMessage("Дождитесь определения длительности аудио перед сохранением.");
      return;
    }
    setSaving(true);
    let recordingId: string | undefined;
    let releaseRecordingRegistration: (() => void) | undefined;
    try {
      if (capture) {
        recordingId = `voice_${crypto.randomUUID().replaceAll("-", "_")}`;
        releaseRecordingRegistration = reserveRecordingRegistration(recordingId);
        await writeRecording(recordingId, capture.blob);
      }
      const result = await recordAttempt({
        idempotencyKey: crypto.randomUUID(),
        sessionId,
        mode,
        prompt: mode !== "shadowing" && grammarFocus ? promptWithGrammarFocus(prompt.trim(), grammarFocus) : prompt.trim(),
        round: mode === "fluency_432" ? round : undefined,
        targetPhraseIds: targets,
        confirmedPhraseIds: confirmed,
        transcript,
        durationSeconds:
          capture?.durationSeconds ||
          Math.max(1, Math.round(transcript.trim().split(/\s+/).length / 2.2)),
        recordingId,
        mimeType: capture?.mimeType,
        targetFormVisible: visibleSupportUsesTarget || handoffSupportUsed,
        supportUsed: attemptSupportUsed,
        selfRating: { clarity, flow },
      });
      if (result.error) {
        const cleanupFailed = recordingId
          ? !(await deleteRecording(recordingId).then(() => true, () => false))
          : false;
        setMessage(`${localizeVoiceError(result.error, "Не удалось сохранить речевую попытку.")}${cleanupFailed ? " Лишний аудиофайл удалить не удалось; приложение повторит очистку при запуске." : ""}`);
        return;
      }
      const savedAttempt = useForgeStore
        .getState()
        .speakingAttempts.find((attempt) => attempt.id === result.id);
      const evidencePhraseIds = savedAttempt
        ? speakingEvidencePhraseIds(savedAttempt, phrases)
        : [];
      const evidenceCount = evidencePhraseIds.length;
      if (mode === "fluency_432" && round < 3) {
        setRound((round + 1) as 2 | 3);
        setMessage(
          `Раунд ${round} сохранён. Повторите ту же мысль за ${FLUENCY_SECONDS[round === 1 ? 1 : 2]} секунд; три последовательных раунда считаются одним заданием.`,
        );
      } else {
        setMessage(
          mode === "shadowing"
            ? "Теневой повтор сохранён как тренировка слуха и произношения."
            : `Попытка сохранена. ${evidenceCount ? `Засчитано выражений в живой речи: ${evidenceCount}.` : capture ? "Целевые выражения в этот раз не засчитаны." : "Попытка без аудиозаписи не засчитывается как устная речь."}`,
        );
        if (mode !== "shadowing" && !targetPhraseId && evidenceCount > 0) {
          const evidenced = new Set(evidencePhraseIds);
          const unresolvedTargets = targets.filter((id) => !evidenced.has(id));
          const targetCount = Math.max(1, Math.min(2, targets.length || 2));
          const replacements = candidates
            .filter((phrase) => !targets.includes(phrase.id))
            .slice(0, Math.max(0, targetCount - unresolvedTargets.length))
            .map((phrase) => phrase.id);
          const nextTargets = [...unresolvedTargets, ...replacements].slice(0, targetCount);
          if (replacements.length > 0 && nextTargets.length > 0) {
            setTargets(nextTargets);
            setSupportUsed(false);
            setTargetExposureUsedEver(false);
          }
        }
        setRound(1);
        setSessionId(crypto.randomUUID());
      }
      setCapture(undefined);
      setTranscript("");
      setConfirmed([]);
      setGrammarConfirmed(false);
      setRecorderKey((value) => value + 1);
    } catch (error) {
      const cleanupFailed = recordingId
        ? !(await deleteRecording(recordingId).then(() => true, () => false))
        : false;
      setMessage(
        `${localizeVoiceError(error, "Не удалось сохранить речевую попытку.")}${cleanupFailed ? " Лишний аудиофайл удалить не удалось; приложение повторит очистку при запуске." : ""}`,
      );
    } finally {
      releaseRecordingRegistration?.();
      setSaving(false);
    }
  }

  async function deleteAttempt(id: string) {
    const attempt = attempts.find((item) => item.id === id);
    if (
      !attempt ||
      !window.confirm(
        attempt.mode === "fluency_432"
          ? "Удалить всю лестницу 60/45/30 вместе с аудио?"
          : "Удалить эту попытку вместе с аудио?",
      )
    )
      return;
    try {
      const recordingIds = await removeAttempt(id);
      const cleanup = await Promise.allSettled(
        recordingIds.map((recordingId) => deleteRecording(recordingId)),
      );
      const failed = cleanup.filter(
        (result) => result.status === "rejected",
      ).length;
      setMessage(
        failed
          ? `Попытка удалена, но часть аудиофайлов удалить не удалось: ${failed}. Приложение допочистит их при запуске.`
          : "Попытка и аудио удалены.",
      );
      if (attempt.sessionId === sessionId) {
        setRound(1);
        setSessionId(crypto.randomUUID());
      }
    } catch (error) {
      setMessage(
        localizeVoiceError(error, "Не удалось удалить голосовую попытку."),
      );
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.18fr)_380px]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div>
              <p className="section-kicker">I · Задание</p>
              <h2 className="card-title">Тема и целевые выражения</h2>
            </div>
            {mode === "fluency_432" ? (
              <div className="w-36 shrink-0">
                <p className="inspector-label text-right">
                  Раунд · <span className="numeral">{maxDuration}</span> с
                </p>
                <Rule value={round} max={3} progressbar ariaLabel={`Раунд ${round} из 3`} className="mt-2" />
              </div>
            ) : (
              <Badge tone="neutral">Одна попытка</Badge>
            )}
          </CardHeader>
          <CardBody className="space-y-5">
            <fieldset>
              <legend className="text-sm font-semibold text-primary">
                Режим речи
              </legend>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <ModeChoice
                  checked={mode === "targeted_response"}
                  disabled={mode === "fluency_432" && round > 1}
                  title="Ответ с целевыми фразами"
                  detail="Используйте выбранные выражения в новом ответе."
                  onClick={() => {
                    setMode("targeted_response");
                    setRound(1);
                    setSessionId(crypto.randomUUID());
                  }}
                />
                <ModeChoice
                  checked={mode === "fluency_432"}
                  disabled={mode === "fluency_432" && round > 1}
                  title="Лестница беглости 60/45/30"
                  detail="Повторите одну мысль за 60, 45 и 30 секунд."
                  onClick={() => {
                    setMode("fluency_432");
                    setRound(1);
                    setSessionId(crypto.randomUUID());
                  }}
                />
                <ModeChoice
                  checked={mode === "shadowing"}
                  disabled={mode === "fluency_432" && round > 1}
                  title="Теневой повтор за образцом"
                  detail="Повторите образец; это тренировка, а не доказательство активной речи."
                  onClick={() => {
                    setMode("shadowing");
                    setRound(1);
                    setSessionId(crypto.randomUUID());
                  }}
                />
              </div>
            </fieldset>
            <FieldShell
              label={mode === "shadowing" ? "Текст-образец" : "Тема для ответа"}
              htmlFor="voice-prompt"
              hint={
                mode === "fluency_432" && round > 1
                  ? "Закрыто до завершения трёх раундов."
                  : undefined
              }
            >
              <Textarea
                id="voice-prompt"
                lang="en"
                disabled={mode === "fluency_432" && round > 1}
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                className="min-h-24"
              />
            </FieldShell>
            {mode !== "shadowing" && (grammarFocus ? (
              <div className="relative rounded-[3px] bg-recess p-4 pl-5 shadow-[var(--bevel-down)]">
                <span aria-hidden="true" className="absolute inset-y-4 left-0 w-[2px] bg-rubric" />
                <p className="label-caps text-rubric">
                  Грамматика из вашей практики · <span lang="en" className="reading-en">{grammarFocus.title}</span>
                </p>
                <p lang="en" className="set-text mt-2.5 font-mono text-sm leading-6 text-primary">{grammarFocus.formula}</p>
                <p className="mt-2 text-xs leading-5 text-secondary">Например: <span lang="en" className="reading-en">{grammarFocus.example}</span></p>
                <label className="mt-3 flex min-h-11 cursor-pointer items-start gap-3 rounded-[3px] border border-border bg-surface p-3 text-sm leading-5 text-secondary shadow-[var(--lift-1)]">
                  <input type="checkbox" className="mt-0.5 size-5 accent-[var(--verified)]" checked={grammarConfirmed} onChange={(event) => setGrammarConfirmed(event.target.checked)} />
                  <span>Я сознательно использовал(а) эту модель в своём ответе и проверил(а) форму.</span>
                </label>
              </div>
            ) : (
              <p className="rounded-[3px] bg-recess p-4 text-xs leading-5 text-muted shadow-[var(--bevel-down)]">Грамматическая подсказка появится после первой проверки по грамматике вашего уровня.</p>
            ))}
            <fieldset disabled={mode === "fluency_432" && round > 1}>
              <legend className="text-sm font-semibold text-primary">
                Целевые выражения{" "}
                <span className="font-normal text-muted">· до трёх</span>
              </legend>
              <div className="mt-3 flex max-h-44 flex-wrap gap-2 overflow-y-auto rounded-[3px] bg-recess p-3 shadow-[var(--bevel-down)]">
                {candidates.map((phrase) => {
                  const checked = targets.includes(phrase.id);
                  const cue = speakingRetrievalCue(phrase, candidates);
                  const cueLang = contentLanguage(cue);
                  return (
                    <button
                      key={phrase.id}
                      type="button"
                      aria-pressed={checked}
                      onClick={() => toggleTarget(phrase.id)}
                      className={`detent relative min-h-11 rounded-[3px] border px-3 pl-3.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-45 ${checked ? "border-border-strong bg-surface text-primary shadow-[var(--lift-1)]" : "border-border bg-elevated text-secondary hover:border-border-strong"}`}
                    >
                      {checked && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-[2px] bg-rubric" />}
                      <span lang={cueLang} className={cueLang === "en" ? "reading-en" : undefined}>{cue}</span>
                      <span className="ml-1 text-muted">· {phrase.cefr} · вспомните форму</span>
                      {dueSpokenIds.has(phrase.id) && <span className="ml-1 text-muted">· по расписанию</span>}
                      {awaitingStageSevenIds.has(phrase.id) && <span className="ml-1 text-muted">· готово к шагу 7</span>}
                    </button>
                  );
                })}
                {!candidates.length && <p className="text-xs leading-5 text-muted">Пока нет отработанных выражений. Попытка всё равно сохранится как тренировка.</p>}
              </div>
            </fieldset>
          </CardBody>
        </Card>
        <AudioRecorderPanel
          key={recorderKey}
          kicker="II · Запись"
          maxDurationSeconds={maxDuration}
          title={
            mode === "fluency_432"
              ? `Запишите раунд ${round} · цель ${maxDuration} секунд`
              : mode === "shadowing"
                ? "Запишите теневой повтор"
                : "Запишите свой ответ"
          }
          description={mode === "shadowing" ? "Прослушайте образец, повторите те же смысловые группы, затем сами сравните ритм и ясность." : "Ответьте на тему, затем прослушайте запись перед ручной транскрипцией и подтверждением."}
          onAudioReady={setCapture}
          onClear={() => setCapture(undefined)}
        />
        <Card>
          <CardHeader>
            <div>
              <p className="section-kicker">III · Разбор</p>
              <h2 className="card-title">Транскрипция и самопроверка</h2>
            </div>
            <Badge tone="amber">Проверяет пользователь</Badge>
          </CardHeader>
          <CardBody className="space-y-5">
            <FieldShell
              label="Редактируемая транскрипция"
              htmlFor="voice-transcript"
              hint="Запишите то, что реально сказали."
            >
              <Textarea
                id="voice-transcript"
                lang="en"
                value={transcript}
                onChange={(event) => {
                  setTranscript(event.target.value);
                  setConfirmed((current) =>
                    current.filter((id) => detected.includes(id)),
                  );
                }}
                className="min-h-36"
              />
            </FieldShell>
            {targetPhrases.length > 0 && (
              <fieldset>
                <legend className="text-sm font-semibold text-primary">
                  Подтвердите выражения, которые действительно использовали
                </legend>
                <div className="mt-3 space-y-2">
                  {targetPhrases.map((phrase, index) => {
                    const found = detected.includes(phrase.id);
                    const checked = confirmed.includes(phrase.id);
                    const cue = speakingRetrievalCue(phrase, candidates);
                    const cueLang = contentLanguage(cue);
                    return (
                      <label
                        key={phrase.id}
                        className={`relative flex min-h-11 items-center gap-3 rounded-[3px] p-3 pl-4 ${found ? "bg-surface shadow-[var(--lift-1)]" : "hatched bg-recess"}`}
                      >
                        {found && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-[2px] bg-verified" />}
                        <input
                          type="checkbox"
                          disabled={!found}
                          checked={checked}
                          onChange={() =>
                            setConfirmed((current) =>
                              checked
                                ? current.filter((id) => id !== phrase.id)
                                : [...current, phrase.id],
                            )
                          }
                          className="size-5 accent-[var(--verified)]"
                        />
                        <span className="flex-1 text-sm font-semibold text-primary">
                          Цель <span className="numeral">{index + 1}</span>: <span lang={cueLang} className={cueLang === "en" ? "reading-en" : undefined}>{cue}</span>
                        </span>
                        <Badge tone={found ? "positive" : "neutral"}>
                          {found ? "найдено в тексте" : "не найдено"}
                        </Badge>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Rating label="Ясность" value={clarity} onChange={setClarity} />
              <Rating label="Плавность" value={flow} onChange={setFlow} />
            </div>
            <label className="flex items-start gap-3 rounded-[3px] bg-recess p-4 shadow-[var(--bevel-down)]">
              <input
                type="checkbox"
                checked={attemptSupportUsed}
                disabled={targetExposureUsedEver || visibleSupportUsesTarget || handoffSupportUsed}
                onChange={(event) => setSupportUsed(event.target.checked)}
                className="mt-1 size-5 accent-[var(--verified)]"
              />
              <span>
                <span className="block text-sm font-semibold text-primary">
                  {handoffSupportUsed
                    ? "Целевая формулировка была видна перед переходом — попытка отмечена как выполненная с опорой"
                    : targetExposureUsedEver || visibleSupportUsesTarget
                    ? "Тема или грамматическая подсказка показывала целевую формулировку — попытка отмечена как выполненная с опорой"
                    : "Я читал(а) заметки или целевую формулировку во время ответа"}
                </span>
                <span className="mt-1 block text-xs leading-5 text-muted">
                  Запись сохранится, но не засчитается как самостоятельная речь.
                </span>
              </span>
            </label>
            <div className="rule-double" />
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <p
                role="status"
                aria-live="polite"
                className={`text-sm leading-6 ${speakingMessageIsError(message) ? "text-amber" : "text-secondary"}`}
              >
                {message && !speakingMessageIsError(message) && <Check aria-hidden="true" className="mr-1.5 inline size-4 text-verified" />}
                {message || "Ничего не засчитывается, пока вы не нажмёте «Сохранить попытку»."}
              </p>
              <Button onClick={() => void saveAttempt()} disabled={saving}>
                <Save className="size-4" />
                {saving ? "Сохраняем…" : "Сохранить попытку"}
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
      <aside className="space-y-6 xl:sticky xl:top-[104px] xl:self-start">
        <Card>
          <CardHeader>
            <div>
              <p className="section-kicker">Правила учёта</p>
              <h2 className="card-title">Что система засчитывает</h2>
            </div>
            <ShieldCheck className="size-5 shrink-0 text-verified" aria-hidden="true" />
          </CardHeader>
          <details className="group">
            <summary className="detent min-h-11 cursor-pointer list-none px-5 py-3 text-sm font-semibold text-primary hover:bg-recess [&::-webkit-details-marker]:hidden">Семь правил зачёта</summary>
            <CardBody className="space-y-3 text-sm leading-6 text-secondary">
            <Clause folio="i">
              Чтобы попытка засчиталась как устная речь, нужна сохранённая аудиозапись; текст без аудио — лишь заметка о практике.
            </Clause>
            <Clause folio="ii">
              Выражение должно появиться в вашей записи ответа, и вы должны его подтвердить.
            </Clause>
            <Clause folio="iii">
              Нужен контекстный ответ не короче пяти секунд и семи слов, включая минимум три слова помимо целевых фраз. Один повтор фразы остаётся тренировкой.
            </Clause>
            <Clause folio="iv">
              Чтение с опорой не повышает оценку активной речи.
            </Clause>
            <Clause folio="v">
              Теневой повтор сохраняется как тренировка слуха и произношения, а не как свободная речь.
            </Clause>
            <Clause folio="vi">
              Три раунда 60/45/30 считаются одним заданием; только финальный раунд планирует повторение.
            </Clause>
            <Clause folio="vii">
              Приложение не выдумывает оценку акцента, беглости, понимания или произношения.
            </Clause>
            </CardBody>
          </details>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <p className="section-kicker">Недавняя голосовая работа</p>
              <h2 className="card-title">История попыток</h2>
            </div>
            <span className="numeral shrink-0 text-lg text-secondary">{attempts.length}</span>
          </CardHeader>
          <CardBody className="space-y-2">
            {attempts.slice(0, 6).map((attempt) => (
              <div
                key={attempt.id}
                className="rounded-[3px] bg-recess p-3 shadow-[var(--bevel-down)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-xs font-semibold text-primary">
                      {speakingModeLabels[attempt.mode]}
                    </span>
                    <Badge
                      tone={
                        isSpeakingEvidenceAttempt(attempt, phrases)
                          ? "positive"
                          : "neutral"
                      }
                    >
                      {isSpeakingEvidenceAttempt(attempt, phrases)
                        ? "Засчитано"
                        : "Практика"}
                    </Badge>
                  </div>
                  <button
                    type="button"
                    onClick={() => void deleteAttempt(attempt.id)}
                    aria-label={`Удалить голосовую попытку от ${formatShortDate(attempt.createdAt)}`}
                    className="detent grid size-11 shrink-0 place-items-center rounded-[3px] text-muted hover:bg-rubric-soft hover:text-rubric"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
                <p lang="en" className="reading-en mt-2 line-clamp-2 text-xs leading-5 text-secondary">
                  {redactSpeakingTargets(attempt.transcript || attempt.prompt, candidates)}
                </p>
                <p className="mt-2 text-[11px] text-muted">
                  {formatShortDate(attempt.createdAt)} ·{" "}
                  <span className="numeral">{attempt.durationSeconds}</span> с ·{" "}
                  засчитано выражений:{" "}
                  <span className="numeral">{speakingEvidencePhraseIds(attempt, phrases).length}</span>
                </p>
              </div>
            ))}
            {!attempts.length && (
              <div className="empty-state py-8">
                <Mic2 className="size-6" aria-hidden="true" />
                <p>Здесь появится первая сохранённая попытка.</p>
              </div>
            )}
          </CardBody>
        </Card>
      </aside>
    </div>
  );
}

function DailyListeningChallenge() {
  const level = useForgeStore((state) => state.preferences.currentLevel);
  const englishVariant = useForgeStore((state) => state.preferences.englishVariant);
  const phrases = useForgeStore((state) => state.phrases);
  const recordAttempt = useForgeStore((state) => state.recordListeningAttempt);
  const now = useLocalToday();
  const dayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const promptBank = LISTENING_PROMPTS_BY_LEVEL[level];
  // «Ещё фраза»: каждый следующий раунд подмешивает счётчик в ключ выбора —
  // та же детерминированная функция отдаёт другую фразу. Нагрузку выбирает
  // пользователь, а не расписание.
  const [dictationRound, setDictationRound] = useState(0);
  const selectionKey = dictationRound === 0 ? dayKey : `${dayKey}·${dictationRound}`;
  const selectedPrompt = selectDailyListeningReference(phrases, level, selectionKey, promptBank);
  const selectedPhrase = selectedPrompt.phraseId ? phrases.find((phrase) => phrase.id === selectedPrompt.phraseId) : undefined;
  const distractorMeanings = selectedPhrase ? [...new Set(phrases
    .filter((phrase) => phrase.id !== selectedPhrase.id && phrase.cefr === level && phrase.meaning.trim())
    .map(activationRecognitionLabel)
    .filter((meaning) => meaning && meaning !== activationRecognitionLabel(selectedPhrase)))].slice(0, 2) : [];
  const fallbackPrompt = selectDailyListeningReference([], level, selectionKey, promptBank);
  const prompt = selectedPhrase && distractorMeanings.length === 2
    ? (() => {
      const answer = activationRecognitionLabel(selectedPhrase);
      const base = [answer, ...distractorMeanings] as [string, string, string];
      const offset = [...selectedPhrase.id].reduce((sum, character) => sum + character.codePointAt(0)!, 0) % 3;
      const choices = [...base.slice(offset), ...base.slice(0, offset)] as [string, string, string];
      return { ...selectedPrompt, question: "Какое значение целевого выражения подходит к услышанному контексту?", choices, answerIndex: choices.indexOf(answer) as 0 | 1 | 2 };
    })()
    : selectedPhrase ? fallbackPrompt : selectedPrompt;
  const reference = prompt.text;
  const [response, setResponse] = useState("");
  const [comprehensionAnswer, setComprehensionAnswer] = useState<number>();
  const [lastScore, setLastScore] = useState<{ matched: number; total: number; needed: number; dictationOk: boolean; comprehensionOk: boolean } | null>(null);
  const [played, setPlayed] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const playbackTokenRef = useRef(0);
  const challengeKey = `${level}:${dayKey}:${prompt.id}`;

  useEffect(() => {
    playbackTokenRef.current += 1;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setResponse("");
    setComprehensionAnswer(undefined);
    setPlayed(false);
    setRevealed(false);
    setLastScore(null);
    setMessage("");
    return () => {
      playbackTokenRef.current += 1;
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, [challengeKey]);

  function playPrompt() {
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
      setMessage("Озвучка недоступна в этой среде. Можно работать со своим фрагментом ниже.");
      return;
    }
    window.speechSynthesis.cancel();
    setPlayed(false);
    const playbackToken = ++playbackTokenRef.current;
    const utterance = new SpeechSynthesisUtterance(reference);
    utterance.lang = englishVariant === "US" ? "en-US" : englishVariant === "UK" ? "en-GB" : "en";
    utterance.rate = 0.9;
    utterance.onend = () => {
      if (playbackToken !== playbackTokenRef.current) return;
      setPlayed(true);
      setMessage("Фраза воспроизведена. Запишите её и ответьте на вопрос по смыслу.");
    };
    utterance.onerror = () => {
      if (playbackToken !== playbackTokenRef.current) return;
      setPlayed(false);
      setMessage("Озвучка не сработала. Попробуйте ещё раз или используйте свой фрагмент ниже.");
    };
    window.speechSynthesis.speak(utterance);
    setMessage("Прослушайте фразу и запишите её без открытия текста.");
  }

  async function check() {
    if (!played) {
      setMessage("Сначала прослушайте фразу хотя бы один раз.");
      return;
    }
    if (!response.trim()) {
      setMessage("Запишите услышанную фразу перед проверкой.");
      return;
    }
    if (comprehensionAnswer === undefined || !prompt.choices || prompt.answerIndex === undefined || !prompt.question) {
      setMessage("Ответьте на короткий вопрос по смыслу перед сохранением.");
      return;
    }
    const dictationMatched = dictationMatches(response, reference);
    const comprehensionMatched = comprehensionAnswer === prompt.answerIndex;
    setLastScore({ ...dictationWordScore(response, reference), dictationOk: dictationMatched, comprehensionOk: comprehensionMatched });
    const matched = dictationMatched && comprehensionMatched;
    setSaving(true);
    try {
      await recordAttempt({
        sourceId: `daily-local-${level}-${dayKey}-${prompt.id}${dictationRound ? `-r${dictationRound}` : ""}`,
        mode: "dictation",
        response,
        answerMatched: matched,
        revealUsed: revealed,
        playbackCompleted: true,
        referenceTranscript: reference,
        comprehensionQuestion: prompt.question,
        comprehensionResponse: prompt.choices[comprehensionAnswer],
        comprehensionExpectedResponse: prompt.choices[prompt.answerIndex],
        comprehensionMatched,
        durationSeconds: Math.min(300, Math.max(1, Math.round(reference.split(/\s+/u).length / 2))),
      });
      setMessage(matched && !revealed
        ? "Диктант и ответ по смыслу совпали. Шаг аудирования на сегодня сохранён."
        : matched
          ? "Оба ответа совпали, но текст уже был открыт: попытка сохранена как тренировка."
          : !dictationMatched && !comprehensionMatched
            ? "Есть расхождения и в диктанте, и в ответе по смыслу. Попытка сохранена для разбора."
            : !dictationMatched
              ? "Ответ по смыслу верный, но в диктанте есть расхождения."
              : "Диктант совпал, но ответ по смыслу пока неверный.");
    } catch (error) {
      setMessage(localizeVoiceError(error, "Не удалось сохранить попытку аудирования."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div><p className="section-kicker">Аудирование на сегодня · {level}</p><h2 className="card-title">Короткий диктант</h2></div>
      </CardHeader>
      <CardBody className="space-y-4">
        <p className="text-sm leading-6 text-secondary">Прослушайте фразу без текста и запишите её целиком. {prompt.phraseId ? 'Сегодня озвучено выражение из ваших слов.' : 'Пока своих отработанных слов мало, звучит фраза вашего уровня.'}</p>
        <div className="rounded-[3px] bg-recess p-3 shadow-[var(--bevel-down)]">
          <p className="inspector-label">
            Порог зачёта · слов из <span className="numeral">{DICTATION_SAMPLE_WORDS}</span>
          </p>
          <Rule value={DICTATION_THRESHOLD_WORDS} max={DICTATION_SAMPLE_WORDS} className="mt-2" />
          <MarginNote className="xl:max-w-none xl:[transform:none]">
            Например: в фразе из <span className="numeral">{DICTATION_SAMPLE_WORDS}</span> слов на местах должны стоять не меньше{" "}
            <span className="numeral">{DICTATION_THRESHOLD_WORDS}</span>. Для короткой фразы порог ниже — точные числа появятся после проверки.
          </MarginNote>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={playPrompt}><Volume2 className="size-4" /> {played ? "Прослушать ещё раз" : "Прослушать фразу"}</Button>
          <Button type="button" variant="ghost" onClick={() => setRevealed(true)} disabled={revealed || !response.trim() || comprehensionAnswer === undefined}><Eye className="size-4" /> {revealed ? "Разбор открыт" : lastScore ? "Показать разбор" : "Открыть только после попытки"}</Button>
        </div>
        {revealed && <div className="relative rounded-[3px] border border-amber/30 bg-amber/5 p-3 pl-4"><span aria-hidden="true" className="absolute inset-y-3 left-0 w-[2px] bg-amber" /><p className="inspector-label">Текст фразы</p><p lang="en" className="set-text reading-en mt-2 text-sm leading-6 text-primary">{reference}</p>{prompt.phraseId && <p className="mt-2 text-xs text-teal">Из ваших слов: <span lang="en" className="reading-en">{phrases.find((phrase) => phrase.id === prompt.phraseId)?.canonical}</span></p>}<p className="mt-2 text-xs leading-5 text-muted">После открытия текста попытка считается тренировкой.</p>{lastScore && <div className="mt-3"><p className="inspector-label">Пословное сравнение · зачёркнуто — не расслышано · подчёркнуто — лишнее или заменённое</p><Diff before={reference} after={response} className="mt-2" /></div>}</div>}
        <FieldShell label="Что вы услышали" htmlFor="daily-listening-response" hint="Ответ сохраняется после нажатия «Проверить и сохранить».">
          <Textarea id="daily-listening-response" lang="en" value={response} onChange={(event) => setResponse(event.target.value)} className="min-h-24" />
        </FieldShell>
        {prompt.question && prompt.choices && (() => {
          // Язык вопроса и вариантов один и тот же: русский для повторно
          // использованного выражения, английский — для фразы из банка.
          // Английский набирается антиквой (.reading-en).
          const choiceLang = prompt.phraseId ? "ru" : "en";
          const choiceType = choiceLang === "en" ? "reading-en" : "";
          return (
            <fieldset>
              <legend className="text-sm font-semibold leading-6 text-primary">
                Короткий вопрос по смыслу: <span lang={choiceLang} className={choiceType}>{prompt.question}</span>
              </legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {prompt.choices.map((choice, index) => (
                  <button
                    key={choice}
                    type="button"
                    lang={choiceLang}
                    aria-pressed={comprehensionAnswer === index}
                    onClick={() => setComprehensionAnswer(index)}
                    className={`detent relative min-h-11 rounded-[3px] border p-3 pl-4 text-left text-sm ${choiceType} ${comprehensionAnswer === index ? "border-border-strong bg-recess text-primary shadow-[var(--bevel-down)]" : "border-border bg-elevated text-secondary shadow-[var(--lift-1)] hover:border-border-strong"}`}
                  >
                    {/*
                      Скоба выбранного варианта НЕЙТРАЛЬНАЯ (border-strong), а не
                      рубричная: это ответ пользователя, который после «Проверить»
                      может оказаться неверным. Рубрика ошибку не маркирует.
                    */}
                    {comprehensionAnswer === index && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-[2px] bg-border-strong" />}
                    {choice}
                  </button>
                ))}
              </div>
            </fieldset>
          );
        })()}
        {lastScore && (
          <div className="rounded-[3px] bg-recess p-4 shadow-[var(--bevel-down)]">
            {lastScore.dictationOk && lastScore.comprehensionOk
              ? <p><span className="dialog-in label-caps inline-block rounded-[2px] border border-verified/60 px-2.5 py-1 text-verified [transform:rotate(-2deg)]">Зачёт ✓</span></p>
              : <p className="text-base font-semibold text-amber">Пока не зачёт</p>}
            <p className="numeral mt-1 text-sm text-secondary">Слова на местах: {lastScore.matched} из {lastScore.total} · для зачёта нужно не меньше {lastScore.needed}</p>
            <p className="mt-1 text-sm text-secondary">Вопрос по смыслу: {lastScore.comprehensionOk ? "верно" : "пока неверно"}</p>
            {!revealed && <p className="mt-2 text-xs leading-5 text-muted">Кнопка «Показать разбор» откроет текст фразы и пословное сравнение.</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={() => { setResponse(""); setComprehensionAnswer(undefined); setLastScore(null); setRevealed(false); setMessage("Ещё попытка: прослушайте и запишите фразу заново."); }}>Повторить эту фразу</Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => setDictationRound((value) => value + 1)}>Новая фраза <ArrowRight className="size-4" /></Button>
            </div>
          </div>
        )}
        <div className="rule-double" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p role="status" aria-live="polite" className="text-xs leading-5 text-muted">{message || "Засчитывается только ответ, совпавший без подсказки."}</p>
          <Button type="button" onClick={() => void check()} disabled={saving || !response.trim() || comprehensionAnswer === undefined}><CheckCircle2 className="size-4" /> {saving ? "Сохраняем…" : "Проверить и сохранить"}</Button>
        </div>
      </CardBody>
    </Card>
  );
}

function ListeningLibrary() {
  const clips = useForgeStore((state) => state.listeningClips);
  const addClip = useForgeStore((state) => state.addListeningClip);
  const updateClip = useForgeStore((state) => state.updateListeningClip);
  const removeClip = useForgeStore((state) => state.deleteListeningClip);
  const [capture, setCapture] = useState<LocalAudioCapture>();
  const [title, setTitle] = useState("");
  const [source, setSource] = useState("");
  const [transcript, setTranscript] = useState("");
  const [recorderKey, setRecorderKey] = useState(0);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const transcriptFileRef = useRef<HTMLInputElement>(null);

  async function importTranscript(file?: File) {
    if (!file) return;
    try {
      setTranscript(await readTranscriptFile(file));
      setMessage(`Текст «${file.name}» импортирован. Проверьте его перед сохранением.`);
    } catch (error) {
      setMessage(localizeVoiceError(error, error instanceof Error ? error.message : "Не удалось прочитать текст."));
    } finally {
      if (transcriptFileRef.current) transcriptFileRef.current.value = "";
    }
  }

  async function saveClip() {
    if (!capture) {
      setMessage("Сначала запишите или импортируйте аудиофрагмент.");
      return;
    }
    if (capture.durationSeconds < 1) {
      setMessage("Дождитесь определения длительности перед сохранением.");
      return;
    }
    setSaving(true);
    const recordingId = `listen_${crypto.randomUUID().replaceAll("-", "_")}`;
    const releaseRecordingRegistration = reserveRecordingRegistration(recordingId);
    try {
      await writeRecording(recordingId, capture.blob);
      await addClip({
        title: title.trim() || capture.fileName || "Фрагмент для аудирования",
        source: source.trim(),
        transcript: transcript.trim(),
        recordingId,
        mimeType: capture.mimeType,
        durationSeconds: capture.durationSeconds,
      });
      setCapture(undefined);
      setTitle("");
      setSource("");
      setTranscript("");
      setRecorderKey((value) => value + 1);
      setMessage("Фрагмент сохранён. Сначала прослушайте его без текста и только потом откройте текст.");
    } catch (error) {
      const cleanupFailed = !(await deleteRecording(recordingId).then(() => true, () => false));
      setMessage(
        `${localizeVoiceError(error, "Не удалось сохранить фрагмент.")}${cleanupFailed ? " Лишний аудиофайл удалить не удалось; приложение повторит очистку при запуске." : ""}`,
      );
    } finally {
      releaseRecordingRegistration();
      setSaving(false);
    }
  }

  async function deleteClip(id: string) {
    const clip = clips.find((item) => item.id === id);
    if (!clip || !window.confirm(`Удалить «${clip.title}» вместе с аудио?`))
      return;
    try {
      const recordingId = await removeClip(id);
      if (recordingId) {
        try {
          await deleteRecording(recordingId);
          setMessage("Фрагмент и аудио удалены.");
        } catch {
          setMessage("Фрагмент удалён, но аудиофайл удалить не удалось. Приложение допочистит его при запуске.");
        }
      }
    } catch (error) {
      setMessage(localizeVoiceError(error, "Не удалось удалить фрагмент."));
    }
  }

  return (
    <div className="space-y-6">
      <DailyListeningChallenge />
      <Card>
        <CardHeader>
          <div>
            <p className="section-kicker">Аудирование без текста</p>
            <h2 className="card-title">Сначала повтор, затем текст</h2>
          </div>
          <p className="inspector-label shrink-0">
            фрагментов: <span className="numeral text-secondary">{clips.length}</span>
          </p>
        </CardHeader>
        <CardBody className="grid gap-4 lg:grid-cols-2">
          {clips.map((clip) => (
            <ListeningClipCard
              key={clip.id}
              clip={clip}
              onDelete={() => void deleteClip(clip.id)}
              onSave={(patch) => updateClip(clip.id, patch)}
            />
          ))}
          {!clips.length && (
            <div className="empty-state col-span-full py-12">
              <Headphones className="size-7" />
              <div>
                <p className="font-semibold text-primary">
                  Фрагментов для аудирования пока нет.
                </p>
                <p className="mt-1">
                  Добавьте свой материал ниже — подкаст, лекцию или свою запись.
                </p>
              </div>
            </div>
          )}
        </CardBody>
      </Card>
      <details className="rounded-[3px] border border-border bg-elevated shadow-[var(--lift-1)]">
        <summary className="detent min-h-11 cursor-pointer rounded-[3px] px-4 py-3 text-sm font-semibold text-primary hover:bg-recess">
          Добавить свой материал (подкаст, лекция — по желанию)
        </summary>
        <section className="grid gap-6 border-t border-border p-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <AudioRecorderPanel
            key={recorderKey}
            allowSystemAudio
            title="Добавьте фрагмент для аудирования"
            description="Импортируйте файл, запишите с микрофона или со звука экрана — до пяти минут."
            maxDurationSeconds={300}
            onAudioReady={(next) => {
              setCapture(next);
              if (!title && next.fileName)
                setTitle(next.fileName.replace(/\.[^.]+$/, ""));
            }}
            onClear={() => setCapture(undefined)}
          />
          <Card>
            <CardHeader>
              <div>
                <p className="section-kicker">Данные фрагмента</p>
                <h2 className="card-title">Подготовьте аудирование без текста</h2>
                <ol className="mt-2 space-y-1 text-xs leading-5 text-muted">
                  <li><span className="numeral">1.</span> Запишите или импортируйте до пяти минут звука: подкаст, лекция, свой голос.</li>
                  <li><span className="numeral">2.</span> По желанию вставьте текст фрагмента — тогда после прослушивания будет диктант с проверкой.</li>
                  <li><span className="numeral">3.</span> Нажмите «Сохранить в библиотеку» — фрагмент появится выше, в «Аудирование без текста».</li>
                </ol>
              </div>
              <FileAudio className="size-5 shrink-0 text-verified" aria-hidden="true" />
            </CardHeader>
            <CardBody className="space-y-4">
              <FieldShell label="Название" htmlFor="clip-title">
                <Input
                  id="clip-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Фрагмент подкаста · принятие решений"
                />
              </FieldShell>
              <FieldShell label="Источник" htmlFor="clip-source">
                <Input
                  id="clip-source"
                  value={source}
                  onChange={(event) => setSource(event.target.value)}
                  placeholder="Файл, лекция, встреча…"
                />
              </FieldShell>
              <FieldShell
                label="Текст фрагмента (по желанию)"
                htmlFor="clip-transcript"
                hint="Введите текст или импортируйте файл TXT, SRT или VTT."
              >
                <Textarea
                  id="clip-transcript"
                  lang="en"
                  value={transcript}
                  onChange={(event) => setTranscript(event.target.value)}
                  className="min-h-28"
                />
              </FieldShell>
              <input
                ref={transcriptFileRef}
                type="file"
                accept=".txt,.srt,.vtt,text/plain,application/x-subrip,text/vtt"
                className="sr-only"
                tabIndex={-1}
                onChange={(event) => void importTranscript(event.target.files?.[0])}
              />
              <Button type="button" variant="secondary" onClick={() => transcriptFileRef.current?.click()}>
                <Upload className="size-4" /> Импортировать TXT / SRT / VTT
              </Button>
              <div className="flex flex-col gap-3 border-t border-border pt-4">
                <p
                  role="status"
                  aria-live="polite"
                  className="text-xs leading-5 text-muted"
                >
                  {message ||
                    "Фрагмент появится выше, в «Аудирование без текста»."}
                </p>
                <Button
                  onClick={() => void saveClip()}
                  disabled={!capture || saving}
                >
                  <Save className="size-4" />
                  {saving ? "Сохраняем…" : "Сохранить в библиотеку"}
                </Button>
              </div>
            </CardBody>
          </Card>
        </section>
      </details>
    </div>
  );
}

function ListeningClipCard({
  clip,
  onDelete,
  onSave,
}: {
  clip: ReturnType<typeof useForgeStore.getState>["listeningClips"][number];
  onDelete: () => void;
  onSave: (patch: { title?: string; source?: string; transcript?: string }) => Promise<void>;
}) {
  const recordAttempt = useForgeStore((state) => state.recordListeningAttempt);
  const addPhrase = useForgeStore((state) => state.addPhrase);
  const level = useForgeStore((state) => state.preferences.currentLevel);
  const audioRef = useRef<HTMLAudioElement>(null);
  // Honest-playback tracking: sum of genuinely played time + whether the end was
  // reached through playback (not a scrub), so "finished playing" cannot be faked
  // by dragging the scrubber to the end.
  const lastTimeRef = useRef(0);
  const [audioUrl, setAudioUrl] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [revealUsedEver, setRevealUsedEver] = useState(false);
  const [playbackCompleted, setPlaybackCompleted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [rate, setRate] = useState(1);
  const [loopStart, setLoopStart] = useState(0);
  const [loopEnd, setLoopEnd] = useState(Math.max(1, clip.durationSeconds));
  const [looping, setLooping] = useState(false);
  const [dictation, setDictation] = useState("");
  const [practiceMessage, setPracticeMessage] = useState("");
  const [savingPractice, setSavingPractice] = useState(false);
  const [unknownExpression, setUnknownExpression] = useState("");
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(clip.title);
  const [editSource, setEditSource] = useState(clip.source);
  const [editTranscript, setEditTranscript] = useState(clip.transcript);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setRevealed(false);
    setPlaybackCompleted(false);
    lastTimeRef.current = 0;
    setDictation("");
    setPracticeMessage("");
  }, [clip.updatedAt]);
  useEffect(
    () => () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    },
    [audioUrl],
  );
  async function load() {
    if (audioUrl) return;
    setLoading(true);
    setError("");
    try {
      setAudioUrl(
        URL.createObjectURL(
          await readRecording(clip.recordingId, clip.mimeType),
        ),
      );
    } catch (caught) {
      setError(localizeVoiceError(caught, "Аудио недоступно."));
    } finally {
      setLoading(false);
    }
  }
  function markLoopStart() {
    const next = audioRef.current?.currentTime ?? 0;
    setLoopStart(next);
    if (loopEnd <= next + 0.25) setLoopEnd(Math.min(clip.durationSeconds, next + 3));
  }
  function markLoopEnd() {
    const next = audioRef.current?.currentTime ?? 0;
    if (next <= loopStart + 0.25) {
      setError("Перед установкой точки B воспроизведите фрагмент дальше точки A.");
      return;
    }
    setError("");
    setLoopEnd(next);
  }
  function resetLoop() {
    setLoopStart(0);
    setLoopEnd(Math.max(1, clip.durationSeconds));
    setLooping(false);
  }
  async function saveMetadata() {
    setSaving(true);
    setError("");
    try {
      await onSave({ title: editTitle, source: editSource, transcript: editTranscript });
      setEditing(false);
    } catch (caught) {
      setError(localizeVoiceError(caught, "Не удалось сохранить данные фрагмента."));
    } finally {
      setSaving(false);
    }
  }
  async function saveListeningPractice() {
    if (!playbackCompleted) {
      setPracticeMessage("Сначала прослушайте фрагмент до конца.");
      return;
    }
    if (!dictation.trim()) {
      setPracticeMessage("Сначала запишите услышанное или кратко сформулируйте общий смысл.");
      return;
    }
    const matched = Boolean(clip.transcript.trim()) && dictationMatches(dictation, clip.transcript);
    const score = clip.transcript.trim() ? dictationWordScore(dictation, clip.transcript) : undefined;
    setSavingPractice(true);
    try {
      await recordAttempt({
        sourceId: clip.id,
        mode: clip.transcript.trim() ? "dictation" : "blind_listen",
        response: dictation,
        answerMatched: matched,
        revealUsed: revealUsedEver,
        playbackCompleted: true,
        referenceTranscript: clip.transcript,
        sourceUpdatedAt: clip.updatedAt,
        durationSeconds: Math.min(300, Math.max(1, audioRef.current?.currentTime || clip.durationSeconds)),
      });
      setPracticeMessage(matched && !revealUsedEver
        ? `Диктант совпал: шаг аудирования сохранён.${score ? ` Слова на местах: ${score.matched} из ${score.total}.` : ""}`
        : clip.transcript.trim()
          ? `Попытка сохранена как тренировка.${score ? ` Слова на местах: ${score.matched} из ${score.total}, для зачёта нужно не меньше ${score.needed}.` : ""} Исправьте расхождения и попробуйте без открытого текста.`
          : "Заметка сохранена. Без текста фрагмента совпадение не проверяется.");
    } catch (caught) {
      setPracticeMessage(localizeVoiceError(caught, "Не удалось сохранить попытку аудирования."));
    } finally {
      setSavingPractice(false);
    }
  }
  function saveUnknownExpression() {
    const canonical = unknownExpression.trim();
    if (!canonical) return;
    const result = addPhrase({
      canonical,
      meaning: "",
      context: clip.transcript,
      source: clip.source || clip.title,
      kind: canonical.includes(" ") ? "collocation" : "word",
      cefr: level,
      register: ["neutral"],
      tags: ["listening"],
      note: `Найдено во фрагменте «${clip.title}». Добавьте значение и собственный пример.`,
    });
    if (result.error) setPracticeMessage(localizeVoiceError(result.error, "Не удалось сохранить выражение."));
    else if (result.duplicateId) setPracticeMessage("Это выражение уже есть в «Моих словах».");
    else {
      setUnknownExpression("");
      setPracticeMessage("Выражение сохранено в «Моих словах» и помечено для обогащения.");
    }
  }
  return (
    <article className="rounded-[3px] border border-border bg-surface p-4 shadow-[var(--lift-1)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-primary">{clip.title}</h3>
          <p className="mt-1 text-xs text-muted">
            {clip.source || "Личная библиотека аудирования"} ·{" "}
            <span className="numeral">
              {clip.quarantine?.originalDurationSeconds ?? clip.durationSeconds}
            </span>{" "}
            с
          </p>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setEditing((value) => { if (!value && clip.transcript.trim()) setRevealUsedEver(true); return !value })}
            aria-label={`Изменить ${clip.title}`}
            className="detent grid size-11 shrink-0 place-items-center rounded-[3px] text-muted hover:bg-recess hover:text-primary"
          >
            {editing ? <X className="size-4" /> : <Pencil className="size-4" />}
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Удалить ${clip.title}`}
            className="detent grid size-11 shrink-0 place-items-center rounded-[3px] text-muted hover:bg-rubric-soft hover:text-rubric"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
      {editing && (
        <div className="mt-4 space-y-3 rounded-[3px] bg-recess p-3 shadow-[var(--bevel-down)]">
          <FieldShell label="Название" htmlFor={`edit-title-${clip.id}`}>
            <Input id={`edit-title-${clip.id}`} value={editTitle} onChange={(event) => setEditTitle(event.target.value)} />
          </FieldShell>
          <FieldShell label="Источник" htmlFor={`edit-source-${clip.id}`}>
            <Input id={`edit-source-${clip.id}`} value={editSource} onChange={(event) => setEditSource(event.target.value)} />
          </FieldShell>
          <FieldShell label="Текст фрагмента" htmlFor={`edit-transcript-${clip.id}`}>
            <Textarea id={`edit-transcript-${clip.id}`} lang="en" value={editTranscript} onChange={(event) => { setEditTranscript(event.target.value); if (event.target.value.trim()) setRevealUsedEver(true) }} className="min-h-28" />
          </FieldShell>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setEditTitle(clip.title); setEditSource(clip.source); setEditTranscript(clip.transcript); setEditing(false); }}>Отмена</Button>
            <Button size="sm" disabled={saving || !editTitle.trim()} onClick={() => void saveMetadata()}><Save className="size-4" />{saving ? "Сохраняем…" : "Сохранить"}</Button>
          </div>
        </div>
      )}
      {clip.quarantine ? (
        <div role="alert" className="mt-4">
          <Stamp caption="слишком длинный фрагмент">
            <p className="text-xs leading-5">
              Фрагмент длиннее пяти минут сохранён, но исключён из практики. Обрежьте исходник до пяти минут и добавьте его заново; этот можно переименовать или удалить.
            </p>
          </Stamp>
        </div>
      ) : <>{audioUrl ? (
        <div className="mt-4">
          <audio
            ref={audioRef}
            controls
            preload="metadata"
            src={audioUrl}
            onLoadedMetadata={(event) => setLoopEnd(event.currentTarget.duration || clip.durationSeconds)}
            onPlay={(event) => {
              event.currentTarget.playbackRate = rate;
            }}
            onSeeked={(event) => {
              lastTimeRef.current = event.currentTarget.currentTime;
            }}
            onTimeUpdate={(event) => {
              const el = event.currentTarget;
              const current = el.currentTime;
              lastTimeRef.current = current;
              if (looping && loopEnd > loopStart && current >= loopEnd) {
                el.currentTime = loopStart;
                lastTimeRef.current = loopStart;
              }
            }}
            // The gate is plain `ended`, as it has always been. A play-time
            // accounting gate was tried here and is wrong: MediaRecorder webm blobs
            // report `duration === Infinity` until they are seeked, and Infinity is
            // truthy, so the `|| clip.durationSeconds` fallback never fires and the
            // threshold can never be met — the save button locks forever.
            onEnded={() => setPlaybackCompleted(true)}
            className="h-11 w-full"
            aria-label={`Воспроизвести ${clip.title}`}
          />
          <label className="mt-3 flex flex-wrap items-center gap-2 text-xs text-secondary">
            Скорость{" "}
            <Select
              value={rate}
              onChange={(event) => {
                const nextRate = Number(event.target.value);
                setRate(nextRate);
                if (audioRef.current) audioRef.current.playbackRate = nextRate;
              }}
              className="numeral w-auto text-xs"
            >
              <option value={0.75}>0.75×</option>
              <option value={0.9}>0.9×</option>
              <option value={1}>1.0×</option>
              <option value={1.1}>1.1×</option>
              <option value={1.25}>1.25×</option>
            </Select>
          </label>
          <div className="mt-4 rounded-[3px] bg-recess p-3 shadow-[var(--bevel-down)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><p className="inspector-label">A/B-повтор</p><p className="numeral mt-1 text-[11px] text-muted">A {formatSegmentTime(loopStart)} · B {formatSegmentTime(loopEnd)}</p></div>
              <button type="button" onClick={resetLoop} className="detent inline-flex min-h-11 items-center gap-2 rounded-[3px] px-3 text-xs font-semibold text-muted hover:bg-elevated hover:text-primary"><TimerReset className="size-4" aria-hidden="true" /> Сбросить</button>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <Button type="button" size="sm" variant="secondary" onClick={markLoopStart}>Поставить A на позиции</Button>
              <Button type="button" size="sm" variant="secondary" onClick={markLoopEnd}>Поставить B на позиции</Button>
              <Button type="button" size="sm" variant={looping ? "primary" : "secondary"} aria-pressed={looping} disabled={loopEnd <= loopStart + 0.25} onClick={() => setLooping((value) => !value)}><Repeat2 className="size-4" aria-hidden="true" /> {looping ? "Повтор включён" : "Повторять A–B"}</Button>
            </div>
            <p className="mt-3 text-xs leading-5 text-muted">Запустите фрагмент, отметьте начало и конец одной фразы, затем повторяйте её для диктанта или теневого повтора.</p>
          </div>
        </div>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          className="mt-4"
          onClick={() => void load()}
          disabled={loading}
        >
          <Headphones className="size-4" />
          {loading ? "Загружаем аудио…" : "Загрузить аудио"}
        </Button>
      )}
      {error && (
        <p role="alert" className="mt-3 text-xs leading-5 text-amber">
          {error}
        </p>
      )}
      <div className="mt-4 border-t border-border pt-4">
        <FieldShell label="Ваш диктант или краткие заметки" htmlFor={`dictation-${clip.id}`} hint="Не сохраняются автоматически: подтвердите попытку кнопкой ниже.">
          <Textarea id={`dictation-${clip.id}`} lang="en" value={dictation} onChange={(event) => setDictation(event.target.value)} className="min-h-24" />
        </FieldShell>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p role="status" aria-live="polite" className="text-xs leading-5 text-muted">{practiceMessage || "Совпадение проверяется, только если у фрагмента есть текст."}</p>
          <Button type="button" size="sm" onClick={() => void saveListeningPractice()} disabled={savingPractice || !dictation.trim() || !playbackCompleted}><CheckCircle2 className="size-4" /> {savingPractice ? "Сохраняем…" : "Проверить и сохранить"}</Button>
        </div>
      </div>
      <div className="mt-4 border-t border-border pt-4">
        {revealed ? (
          <div>
            <p className="inspector-label">Текст фрагмента</p>
            {clip.transcript ? <p lang="en" className="reading-en mt-2 whitespace-pre-wrap text-sm leading-6 text-secondary">{clip.transcript}</p> : <p className="mt-2 text-sm leading-6 text-secondary">Для этого фрагмента текст не сохранён.</p>}
            {clip.transcript && <p className="mt-3 rounded-[3px] bg-recess p-3 text-xs leading-5 text-secondary shadow-[var(--bevel-down)]"><strong className="text-primary">Теневой повтор:</strong> зациклите одну фразу, прослушайте, повторите без текста, затем откройте и сравните. Запишите попытку на вкладке «Говорить», если хотите её засчитать.</p>}
            {clip.transcript && <div className="mt-3 rounded-[3px] bg-recess p-3 shadow-[var(--bevel-down)]"><FieldShell label="Незнакомое слово или выражение" htmlFor={`unknown-${clip.id}`} hint="Сохранится с текстом фрагмента как контекстом; значение можно дополнить в «Моих словах»."><div className="flex flex-col gap-2 sm:flex-row"><Input id={`unknown-${clip.id}`} lang="en" className="reading-en" value={unknownExpression} onChange={(event) => setUnknownExpression(event.target.value)} placeholder="make up for" /><Button type="button" size="sm" variant="secondary" onClick={saveUnknownExpression} disabled={!unknownExpression.trim()}><Save className="size-4" /> В «Мои слова»</Button></div></FieldShell></div>}
          </div>
        ) : (
          <p className="text-xs leading-5 text-muted">
            Сначала прослушайте без текста: запишите общий смысл и непонятные звуковые группы, а уже потом откройте текст.
          </p>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="mt-3"
          onClick={() => setRevealed((value) => { if (!value) setRevealUsedEver(true); return !value })}
        >
          <Eye className="size-4" />
          {revealed ? "Скрыть текст" : "Открыть текст"}
        </Button>
      </div></>}
    </article>
  );
}

function ModeChoice({
  checked,
  disabled = false,
  title,
  detail,
  onClick,
}: {
  checked: boolean;
  disabled?: boolean;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={checked}
      onClick={onClick}
      className={`detent lamp relative min-h-20 rounded-[3px] border p-4 pl-5 text-left disabled:cursor-not-allowed disabled:opacity-45 ${checked ? "border-border-strong bg-recess shadow-[var(--bevel-down)]" : "border-border bg-elevated shadow-[var(--lift-1)] hover:border-border-strong"}`}
    >
      {checked && <span aria-hidden="true" className="absolute inset-y-3 left-0 w-[2px] bg-rubric" />}
      <span
        className={`block text-sm font-bold ${checked ? "text-primary" : "text-secondary"}`}
      >
        {title}
      </span>
      <span className="mt-1 block text-xs leading-5 text-muted">{detail}</span>
    </button>
  );
}

function Rating({
  label,
  value,
  onChange,
}: {
  label: string;
  value: 1 | 2 | 3 | 4 | 5;
  onChange: (value: 1 | 2 | 3 | 4 | 5) => void;
}) {
  return (
    <div className="rounded-[3px] bg-recess p-3 shadow-[var(--bevel-down)]">
      {/*
        Дробь самооценки печатает строкомер, а не подпись поля: `FieldShell`
        принимает label строкой, а по правилу 7 «{value}/5» обязано быть
        моноширинным. Отдавать дробь Rule дешевле, чем разрешать JSX в label.
      */}
      <FieldShell
        label={label}
        htmlFor={`rating-${label.toLowerCase()}`}
      >
        <input
          id={`rating-${label.toLowerCase()}`}
          type="range"
          min={1}
          max={5}
          step={1}
          value={value}
          onChange={(event) =>
            onChange(Number(event.target.value) as 1 | 2 | 3 | 4 | 5)
          }
          className="h-11 w-full accent-[var(--verified)]"
        />
        <Rule value={value} max={5} className="mt-1" />
      </FieldShell>
    </div>
  );
}

/**
 * Пункт свода правил учёта. Нумерованная клауза издания, а не «булит с галочкой»:
 * колонцифра слева на поле, текст в колонке. Название `Clause`, а не `Rule` —
 * `Rule` занят строкомером из ui/Rule.
 */
function Clause({ folio, children }: { folio: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 border-t border-border pt-3 first:border-t-0 first:pt-0">
      <span className="numeral mt-0.5 w-6 shrink-0 text-xs text-muted" aria-hidden="true">
        {folio}
      </span>
      <p className="min-w-0">{children}</p>
    </div>
  );
}
