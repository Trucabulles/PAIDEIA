import { useEffect, useMemo, useRef, useState } from "react";
import { ColorPickerField } from "../../components/color-picker/ColorPickerPopover";
import { suggestionInputValue, suggestDesignerActions, suggestDesignerConversationStarters, type DesignerActionPreview } from "./designerActionEngine";
import { DESIGNER_CAPABILITIES } from "./designerCapabilityRegistry";
import type { DesignerSlotId } from "./designerSlotRegistry";
import { normalizeDesignerText } from "./designerLanguage";
import type { DesignerHelpTranslation } from "./designerHelpRegistry";
import { suggestDesignerHelp } from './designerHelpEngine';
import { DesignerHelpText } from './DesignerHelpText';
import { DesignerSocialMediaEffect } from "./DesignerSocialMediaEffect";
import type { ResolvedDesignerSocialMediaEffect } from "./designerSocialRegistry";
import { useArionConversation, type ArionConversationSession } from "./useArionSession";
import type { ArionConversationSnapshot } from "./arionConversationSession";
import { WindowControls } from "../../components/window/WindowControls";
import type { DesignerActivityDeletionPlan } from "./designerDestructiveActions";

export type DesignerActionsPanelLabels = {
  title: string;
  open: string;
  close: string;
  catalog: string;
  catalogTitle: string;
  catalogHint: string;
  inputLabel: string;
  answerLabel: string;
  followUpLabel: string;
  placeholder: string;
  analyze: string;
  apply: string;
  cancel: string;
  undo: string;
  previewTitle: string;
  affected: string;
  noTargets: string;
  alreadyConfigured: string;
  applied: string;
  appliedPlural: string;
  undone: string;
  unknown: string;
  ambiguous: string;
  scope: string;
  colorAnswer: string;
  chooseImage: string;
};

export type DesignerActionsUsageView = {
  enabled: boolean;
  error: string;
  suggestions: Array<{ id: string; command: string }>;
  clear: () => void;
  toggle: () => void;
  remove: (id: string) => void;
};

export type DesignerActionsPanelViewModel = {
  actionsAvailable: boolean;
  busy: boolean;
  labels: DesignerActionsPanelLabels;
  preview: DesignerActionPreview | null;
  status: "idle" | "applied" | "undone";
  error: string;
  feedback: string;
  question: string;
  questionSlot: DesignerSlotId | null;
  request: string;
  questionControl: "color" | "image" | "font" | null;
  questionAnswerSuggestions?: string[];
  questionAnswerSuggestionIds?: string[];
  fontOptions: Array<{ value: string; label: string }>;
  imageAccept: string;
  translate: DesignerHelpTranslation;
  socialEffect: { effect: ResolvedDesignerSocialMediaEffect; key: number } | null;
  destructivePlan: DesignerActivityDeletionPlan | null;
  usage: DesignerActionsUsageView;
};

type Props = DesignerActionsPanelViewModel & {
  open: boolean;
  conversation: ArionConversationSession;
  onClose: () => void;
  onCancel: () => void;
  onAnalyze: (command: string, conversation: ArionConversationSnapshot) => void;
  onApply: () => void;
  onImageSelect: (file: File) => void;
  onUndo: () => void;
  onExamineDestructiveAction: () => void;
  onConfirmDestructiveAction: () => void;
  onCancelDestructiveAction: () => void;
  onUndoDestructiveAction: () => void;
  onResetConversation: () => void;
  windowControls?: {
    isMaximized: boolean;
    onMinimize: () => void;
    onToggleMaximize: () => void;
  };
};

const ARION_WELCOME_GREETINGS = [
  "Bonjour, que puis-je faire pour vous ?",
  "Bonjour, que souhaitez-vous faire ?",
  "Bonjour, en quoi puis-je vous aider ?",
  "Bonjour, sur quoi souhaitez-vous travailler ?",
  "Bonjour, par quoi souhaitez-vous commencer ?"
];
let previousWelcomeGreetingIndex = -1;

function nextWelcomeGreeting() {
  if (previousWelcomeGreetingIndex < 0) {
    previousWelcomeGreetingIndex = Math.floor(Math.random() * ARION_WELCOME_GREETINGS.length);
    return ARION_WELCOME_GREETINGS[previousWelcomeGreetingIndex];
  }
  const availableCount = ARION_WELCOME_GREETINGS.length - 1;
  let index = Math.floor(Math.random() * availableCount);
  if (index >= previousWelcomeGreetingIndex) index += 1;
  previousWelcomeGreetingIndex = index;
  return ARION_WELCOME_GREETINGS[index];
}

export function DesignerActionsPanel({
  actionsAvailable,
  open,
  busy,
  labels,
  preview,
  status,
  error,
  feedback,
  question,
  questionSlot,
  request,
  questionControl,
  questionAnswerSuggestions,
  questionAnswerSuggestionIds,
  fontOptions,
  imageAccept,
  translate,
  socialEffect,
  destructivePlan,
  conversation,
  onClose,
  onCancel,
  onAnalyze,
  onApply,
  onImageSelect,
  onUndo,
  onExamineDestructiveAction,
  onConfirmDestructiveAction,
  onCancelDestructiveAction,
  onUndoDestructiveAction,
  onResetConversation,
  usage,
  windowControls
}: Props) {
  const { command, setCommand, history, setHistory, documentationChoices, setDocumentationChoices, mode, setMode } = useArionConversation(conversation);
  const [inputFocused, setInputFocused] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState<number | null>(null);
  const [suggestionsHovered, setSuggestionsHovered] = useState(false);
  const [suggestionsInteractionVersion, setSuggestionsInteractionVersion] = useState(0);
  const [welcomeGreeting, setWelcomeGreeting] = useState(nextWelcomeGreeting);
  const inputRef = useRef<HTMLInputElement>(null);
  const conversationRef = useRef<HTMLDivElement>(null);
  const currentResponseRef = useRef<HTMLDivElement>(null);
  const followLatestRef = useRef(true);
  const suppressNextQuestionFocusRef = useRef(false);
  const previouslyOpenRef = useRef(open);
  const effectiveMode = actionsAvailable ? mode : "help";
  const suggestions = useMemo(() => {
    if (questionSlot || !command.trim()) return [];
    if (effectiveMode === "help") return suggestDesignerHelp(command, 6, translate);
    if (effectiveMode === "auto") return suggestDesignerConversationStarters(command, translate);
    const executableIds = new Set(
      DESIGNER_CAPABILITIES.filter((capability) => capability.operationKinds.length > 0).map((capability) => capability.id)
    );
    return suggestDesignerActions(command, 6, translate)
      .filter((suggestion) => executableIds.has(suggestion.id.replace(/-all$/, "")));
  }, [command, effectiveMode, questionAnswerSuggestions, questionSlot, translate]);
  const suggestionsVisible = inputFocused
    && !questionSlot
    && command.trim().length > 0
    && suggestions.length > 0
    ;
  const welcomeVisible = history.length === 0
    && !command.trim()
    && !question
    && !preview
    && !feedback
    && !error
    && !socialEffect
    && !catalogOpen
    && documentationChoices.length === 0;
  const highlightedSuggestionIndex = suggestionsVisible
    ? activeSuggestionIndex !== null && activeSuggestionIndex < suggestions.length
      ? activeSuggestionIndex
      : null
    : null;
  const destructiveChapterCount = destructivePlan ? new Set(destructivePlan.targets.map((target) => target.chapterId)).size : 0;
  const destructiveActivityLabel = destructivePlan?.targets.length === 1
    ? destructivePlan.activityLabel.replace(/^activités/, "activité")
    : destructivePlan?.activityLabel;
  const destructiveTargetsAllActivities = Boolean(destructivePlan && !destructivePlan.activityTypes?.length);
  const destructiveIntentScope = destructivePlan?.resolvedChapterTitles?.length
    ? destructivePlan.resolvedChapterTitles.length === 1
      ? ` dans le chapitre « ${destructivePlan.resolvedChapterTitles[0]} »`
      : ` dans les chapitres « ${destructivePlan.resolvedChapterTitles.join(" », « ")} »`
    : " dans cette leçon";

  useEffect(() => {
    if (open && !previouslyOpenRef.current) setWelcomeGreeting(nextWelcomeGreeting());
    previouslyOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    if (!suggestionsVisible || suggestionsHovered) return;
    const timeoutId = window.setTimeout(() => {
      setInputFocused(false);
      setActiveSuggestionIndex(null);
    }, 1500);
    return () => window.clearTimeout(timeoutId);
  }, [activeSuggestionIndex, command, suggestionsHovered, suggestionsInteractionVersion, suggestionsVisible]);

  function submitCommand(value:string, options?: { keepSuggestionsClosed?: boolean }) {
    if(busy || !value.trim())return;
    suppressNextQuestionFocusRef.current = options?.keepSuggestionsClosed === true;
    followLatestRef.current=true;
    const next=value.trim();
    const normalizedNext = normalizeDesignerText(next);
    const requestsHelpMode = /^(?:aide|aide moi|help|au secours|j ai besoin d aide|assistance|j ai besoin d une assistance|j ai besoin d assistance)(?:\b|$)/.test(normalizedNext);
    const actionModePrefix = /^(?:commande|commandes|modif|modifs|modification|modifications|masse|action de masse|actions de masse|action en masse|actions en masse|commande de masse|commandes de masse|commande en masse|commandes en masse|modification de masse|modifications de masse|modification en masse|modifications en masse)(?:\s*[:\-]\s*|$)/;
    const actionModeMatch = normalizedNext.match(actionModePrefix);
    const actionVerbPattern = /^(?:modifier|modifie|changer|change|remplacer|remplace|renommer|renomme|appliquer|applique|mettre|mets|faire|fais|regler|regle|reinitialiser|reinitialise|supprimer|supprime|retirer|retire|effacer|efface|activer|active|desactiver|desactive)\b/;
    const requestsActionMode = Boolean(actionModeMatch) || actionVerbPattern.test(normalizedNext);
    if (requestsActionMode && !actionsAvailable) {
      onCancel();
      setMode("help");
      setDocumentationChoices([]);
      setHistory((previous) => [
        ...previous,
        ...(question ? [{ role: "arion" as const, text: question }] : []),
        { role: "user" as const, text: next },
        { role: "arion" as const, text: "Ouvrez une leçon pour demander à Arion d’en modifier les paramètres ou les activités." }
      ]);
      setCommand("");
      setActiveSuggestionIndex(null);
      setInputFocused(false);
      window.requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }
    if (requestsHelpMode) setMode("help");
    if (requestsActionMode) setMode("actions");
    if(/^(?:nouvelle conversation|efface la conversation|recommencons)[.!?\s]*$/.test(normalizeDesignerText(next))){setHistory([]);setMode("auto");}
    else setHistory(previous=>[...previous,...(question?[{role:'arion' as const,text:question}]:[]),{role:'user' as const,text:next}]);
    setCommand('');setActiveSuggestionIndex(null);setInputFocused(false);
    if (
      (actionModeMatch && actionModeMatch[0].trim() === normalizedNext) ||
      (actionVerbPattern.test(normalizedNext) && !normalizedNext.includes(" "))
    ) {
      onCancel();
      setDocumentationChoices([]);
      setHistory((previous) => [...previous, { role: "arion", text: "Contexte Actions en masse activé." }]);
      window.requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }
    const analyzedCommand = actionModeMatch && /[:\-]/.test(actionModeMatch[0])
      ? normalizedNext.slice(actionModeMatch[0].length).trim()
      : /^(?:assistance|j ai besoin d une assistance|j ai besoin d assistance)(?:\b|$)/.test(normalizedNext)
        ? `aide ${normalizedNext.replace(/^(?:assistance|j ai besoin d une assistance|j ai besoin d assistance)\s*/, "")}`.trim()
        : next;
    onAnalyze(analyzedCommand || next, conversation.getSnapshot());
    // Related documentation is now returned by the conversation engine. Keeping
    // the former local lookup here duplicated choices and could contradict it.
    setDocumentationChoices([]);
  }

  function prepareWelcomeCommand(value: "Aide" | "Modifier", nextMode: "help" | "actions") {
    setMode(nextMode);
    setCommand(value);
    setActiveSuggestionIndex(null);
    setSuggestionsHovered(false);
    setInputFocused(true);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }

  useEffect(() => {
    if (open) {
      setActiveSuggestionIndex(null);
      setCatalogOpen(false);
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!question) return;
    setCommand("");
    setInputFocused(false);
    if (suppressNextQuestionFocusRef.current) {
      suppressNextQuestionFocusRef.current = false;
      return;
    }
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, [question]);

  useEffect(() => {
    if (questionSlot === "help-related") setDocumentationChoices([]);
  }, [questionSlot]);

  useEffect(() => {
    const node=conversationRef.current;
    const response=currentResponseRef.current;
    if(open && node && response && followLatestRef.current) {
      node.scrollTop=Math.max(0,node.scrollTop+response.getBoundingClientRect().top-node.getBoundingClientRect().top);
    }
  }, [open, history, question, preview, feedback, error, documentationChoices]);

  if (!open) return null;

  return (
    <aside className="designer-actions-panel" aria-label={labels.title}>
      <header className="designer-actions-header">
        <svg
          className="designer-actions-emblem"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="20 60 805 570"
          aria-hidden="true"
          role="img"
        >
          <path
            fill="currentColor"
            fillRule="evenodd"
            d="M 54,347 C 49.4,359.6 44.8,381.1 43,390 C 41.2,398.9 40,409.2 40,418 C 40,426.8 41.2,450.2 43,460 C 44.8,469.8 50.8,488.1 54,496 C 57.2,503.9 63.9,515.9 69,523 C 74.1,530.1 87.4,546.1 95,553 C 102.6,559.9 120.9,572.8 130,578 C 139.1,583.2 157.6,591.6 168,595 C 178.4,598.4 201.4,603.6 213,605 C 224.6,606.4 250.2,606.5 261,606 C 271.8,605.5 288.2,603.4 299,601 C 309.8,598.6 335.9,591.1 347,587 C 358.1,582.9 377.5,573.9 388,568 C 398.5,562.1 422.8,545.9 431,540 C 439.2,534.1 444.4,530.6 454,521 C 463.6,511.4 499.2,464.6 508,463 C 516.8,461.4 519,497.1 524,508 C 529,518.9 541.5,541.1 548,550 C 554.5,558.9 569.1,573.4 576,579 C 582.9,584.6 595,591.6 603,595 C 611,598.4 629.4,604.4 640,606 C 650.6,607.6 679.2,608.1 688,608 C 696.8,607.9 704,606.4 710,605 C 716,603.6 728.9,600.5 736,597 C 743.1,593.5 767,579.8 767,577 C 767,574.2 744,576.8 736,575 C 728,573.2 710.8,567.2 703,563 C 695.2,558.8 680,546.6 674,541 C 668,535.4 660.1,525.8 655,518 C 649.9,510.2 637.6,488.8 633,479 C 628.4,469.2 622.1,452.9 618,440 C 613.9,427.1 606.5,402.5 600,376 C 593.5,349.5 572,251.5 566,228 C 560,204.5 556.2,197.4 552,188 C 547.8,178.6 537.2,160.4 532,153 C 526.8,145.6 517.4,135.1 510,129 C 502.6,122.9 481.2,108.5 473,104 C 464.8,99.5 453.1,95.4 444,93 C 434.9,90.6 409.9,86 400,85 C 390.1,84 373.8,84.4 365,85 C 356.2,85.6 340.2,87.6 330,90 C 319.8,92.4 297,98 283,104 C 269,110 230.8,130.2 218,138 C 205.2,145.8 189.1,159.2 181,166 C 172.9,172.8 161.2,183.2 153,192 C 144.8,200.8 124.1,223.9 115,236 C 105.9,248.1 87.6,275.1 80,289 C 72.4,302.9 58.6,334.4 54,347 Z M 394,142 C 397.8,143.9 405.6,149.1 409,152 C 412.4,154.9 416.8,158.2 421,165 C 425.2,171.8 438,193.8 443,206 C 448,218.2 456.5,245.9 461,263 C 465.5,280.1 481.6,326.1 479,343 C 476.4,359.9 449.6,385.4 440,398 C 430.4,410.6 411.4,433.5 402,444 C 392.6,454.5 373.6,473.9 365,482 C 356.4,490.1 340.9,503 333,509 C 325.1,515 310,525.5 302,530 C 294,534.5 275.9,542.5 269,545 C 262.1,547.5 252,549.4 247,550 C 242,550.6 233.6,550.6 229,550 C 224.4,549.4 214.6,547 210,545 C 205.4,543 196.6,538.2 192,534 C 187.4,529.8 176.4,516.2 173,511 C 169.6,505.8 166.9,499.5 165,492 C 163.1,484.5 158.6,460.6 158,451 C 157.4,441.4 159.1,423.2 160,415 C 160.9,406.8 162.5,395 165,385 C 167.5,375 176.5,345.1 180,335 C 183.5,324.9 188.9,312.8 193,304 C 197.1,295.2 207.2,274.8 213,265 C 218.8,255.2 232.5,234.8 239,226 C 245.5,217.2 258.4,202 265,195 C 271.6,188 285,175.6 292,170 C 299,164.4 314.1,153.9 321,150 C 327.9,146.1 339.8,140.6 347,139 C 354.2,137.4 373.1,136.6 379,137 C 384.9,137.4 390.2,140.1 394,142 Z"
          />
          <path
            fill="currentColor"
            d="M 805,81 C 801.6,80.8 780.6,80.5 773,81 C 765.4,81.5 742.9,84.3 735,86 C 727.1,87.7 705.7,94.8 700,97 C 694.3,99.2 686.5,103.3 682,106 C 677.5,108.7 662.8,118.3 658,122 C 653.2,125.7 641.8,136.1 638,140 C 634.2,143.9 626.9,152.7 623,158 C 619.1,163.3 605.6,183.3 602,189 C 598.4,194.7 588.3,196.3 590,211 C 591.7,225.7 612.6,315.7 618,325 C 623.4,334.3 634.9,304 640,297 C 645.1,290 656.2,274.2 665,260 C 673.8,245.8 712.1,180.2 721,166 C 729.9,151.8 741.4,135.9 747,129 C 752.6,122.1 768.5,106.2 773,102 C 777.5,97.8 785.6,92.1 789,90 C 792.4,87.9 802.3,84 804,83 C 805.7,82 808.4,81.2 805,81 Z"
          />
        </svg>
        <div className="designer-actions-heading">
          <h2>{labels.title}</h2>
          <p>{labels.scope}</p>
        </div>
        <div className="designer-actions-header-buttons">
          <button className="designer-actions-icon-button" aria-label={translate('designerActions.newConversation', undefined, 'Nouvelle conversation')} title={translate('designerActions.newConversation', undefined, 'Nouvelle conversation')} type="button" disabled={busy} onClick={() => { onResetConversation(); setHistory([]); setCommand(''); setDocumentationChoices([]); setMode('auto'); setCatalogOpen(false); setActiveSuggestionIndex(null); inputRef.current?.focus(); }}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M13 19H8l-5 2 1-5a8 8 0 1 1 16-4v1"/><path d="M18 14.5v8m-4-4h8" strokeWidth="2.4"/></svg></button>
          {actionsAvailable && !question ? (
            <button
              aria-expanded={catalogOpen}
              className="designer-actions-icon-button"
              aria-label={labels.catalog}
              title={labels.catalog}
              onClick={() => setCatalogOpen((current) => !current)}
              type="button"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5Z"/></svg>
            </button>
          ) : null}
          {windowControls ? (
            <WindowControls
              closeLabel={labels.close}
              isMaximized={windowControls.isMaximized}
              onClose={onClose}
              onMinimize={windowControls.onMinimize}
              onToggleMaximize={windowControls.onToggleMaximize}
            />
          ) : (
            <button aria-label={labels.close} title={labels.close} className="designer-actions-close" onClick={onClose} type="button"><svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg></button>
          )}
        </div>
      </header>

      <div className="designer-actions-conversation" ref={conversationRef} onScroll={() => {
        const node=conversationRef.current;
        if(node)followLatestRef.current=node.scrollHeight-node.scrollTop-node.clientHeight<48;
      }}>
      {actionsAvailable && catalogOpen && !question ? (
        <section className="designer-actions-catalog">
          <h3>{labels.catalogTitle}</h3>
          <p>{labels.catalogHint}</p>
          <ul>
            {DESIGNER_CAPABILITIES.filter((capability) => capability.operationKinds.length > 0).map((capability) => (
              <li key={capability.id}>
                <button
                  onClick={() => {
                    setCommand(suggestionInputValue(capability));
                    setCatalogOpen(false);
                    window.requestAnimationFrame(() => inputRef.current?.focus());
                  }}
                  type="button"
                >
                  {capability.command}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {welcomeVisible ? (
        <section className="designer-actions-welcome" aria-label="Accueil d’Arion">
          <p className="designer-actions-welcome-greeting">{welcomeGreeting}</p>
          <aside className="designer-actions-welcome-tip" aria-label="Astuce">
            <strong>Astuce</strong>
            <ul>
              <li>
                Saisissez <button type="button" onClick={() => prepareWelcomeCommand("Aide", "help")}>«&nbsp;Aide&nbsp;»</button> pour obtenir de l’aide sur PAIDEIA.
              </li>
              {actionsAvailable ? (
                <li>
                  Saisissez <button type="button" onClick={() => prepareWelcomeCommand("Modifier", "actions")}>«&nbsp;Modifier&nbsp;»</button> pour demander à Arion de modifier des paramètres de votre leçon ou de ses activités.
                </li>
              ) : null}
            </ul>
          </aside>
        </section>
      ) : null}

      {history.length ? <div className="designer-actions-history" aria-label="Conversation">{history.map((entry,index)=><section className={`designer-actions-message designer-actions-message-${entry.role}`} key={index}><DesignerHelpText text={entry.text}/></section>)}</div>:null}
      <div ref={currentResponseRef}>
      {question ? (
        <section className="designer-actions-question" aria-live="polite">
          {request ? <p className="designer-actions-request">{request}</p> : null}
          {questionSlot && questionSlot !== "help-related" ? <p>{question}</p> : <DesignerHelpText text={question}/>}
          {questionControl === "color" ? (
            <div className="designer-actions-color-answer">
              <span>{labels.colorAnswer}</span>
              <ColorPickerField
                allowTransparent={questionSlot === "activity-background-color" || questionSlot === "activity-frame-background-color" || questionSlot === "header-background-color"}
                ariaLabel={labels.colorAnswer}
                onChange={(color) => {
                  setCommand(color);
                  setInputFocused(false);
                }}
                value={command.trim().toLowerCase() === "transparent" || /^#[0-9a-f]{6}$/i.test(command) ? command : "#1D7DDC"}
              />
            </div>
          ) : questionControl === "image" ? (
            <label className="designer-actions-image-picker">
              <span>{labels.chooseImage}</span>
              <input
                accept={imageAccept}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) onImageSelect(file);
                  event.target.value = "";
                }}
                type="file"
              />
            </label>
          ) : questionControl === "font" ? (
            <label className="designer-actions-font-picker">
              <select
                aria-label={question}
                onChange={(event) => {
                  setCommand(event.target.value);
                  setInputFocused(false);
                }}
                value={fontOptions.some((option) => option.label === command) ? command : ""}
              >
                <option value="">—</option>
                {fontOptions.map((option) => <option key={`${option.value}-${option.label}`} value={option.label}>{option.label}</option>)}
              </select>
            </label>
          ) : null}
          {(questionSlot === "help-related" || questionSlot === "help-activity" || questionSlot === "help-choice") && questionAnswerSuggestions?.length ? (
            <ul className={`designer-actions-related-topics${questionSlot === "help-activity" || questionSlot === "help-choice" ? " designer-actions-activity-topics" : ""}`}>
              {questionAnswerSuggestions.map((answer, index) => (
                <li key={questionAnswerSuggestionIds?.[index] || `${index}:${answer}`}>
                  <button type="button" onClick={() => submitCommand(answer, { keepSuggestionsClosed: normalizeDesignerText(answer) !== "autre sujet" })}>
                    {answer.replace(/^Aide\s*:\s*/i, "").replace(/^Aide\s+/i, "")}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
      {socialEffect ? <DesignerSocialMediaEffect effect={socialEffect.effect} effectKey={socialEffect.key} /> : null}



      {documentationChoices.length > 1 ? <section className="designer-actions-catalog">
        <p>{translate('designerActions.documentationChoices', undefined, 'Aide disponible sur ce sujet :')}</p>
        <ul>{documentationChoices.map(choice => <li key={choice.id}><button type="button" onClick={() => { submitCommand(choice.command, { keepSuggestionsClosed: true }); setDocumentationChoices([]); }}>{choice.command}</button></li>)}</ul>
      </section> : null}
      {error ? <p className="designer-actions-error" role="alert">{error}</p> : null}
      {feedback ? <p className="designer-actions-feedback" role="status">{feedback}</p> : null}

      {destructivePlan ? (
        <section className="designer-actions-destructive" aria-live="polite">
          {destructivePlan.stage === "intent" ? (
            <>
              <h3>{destructiveTargetsAllActivities ? "Suppression d’activités en masse" : `Suppression d’${destructivePlan.activityLabel}`}</h3>
              <p>
                Vous demandez la suppression de <strong>{destructivePlan.targets.length} {destructiveActivityLabel}</strong>
                {destructivePlan.excludedActivityLabels?.length ? <> sauf <strong>{destructivePlan.excludedActivityLabels.join(", ")}</strong></> : null}
                {destructiveIntentScope}. Souhaitez-vous continuer&nbsp;?
              </p>
              <div className="designer-actions-buttons">
                <button disabled={busy} onClick={onCancelDestructiveAction} type="button">Annuler</button>
                <button className="danger" disabled={busy} onClick={onExamineDestructiveAction} type="button">Examiner la suppression</button>
              </div>
            </>
          ) : destructivePlan.stage === "review" ? (
            <>
              <h3>Confirmation obligatoire</h3>
              <p><strong>{destructivePlan.targets.length} {destructiveActivityLabel}</strong> {destructivePlan.targets.length > 1 ? "seront supprimées" : "sera supprimée"} dans {destructiveChapterCount} {destructiveChapterCount > 1 ? "chapitres" : "chapitre"}.</p>
              {destructivePlan.excludedActivityLabels?.length ? (
                <p>Activités conservées&nbsp;: <strong>{destructivePlan.excludedActivityLabels.join(", ")}</strong>.</p>
              ) : null}
              {destructivePlan.resolvedChapterTitles?.length ? (
                <>
                  <p><strong>Chapitres ciblés&nbsp;:</strong></p>
                  <ul>{destructivePlan.resolvedChapterTitles.map((title, index) => {
                    const chapterId = destructivePlan.resolvedChapterIds?.[index];
                    const activityCount = chapterId ? destructivePlan.targets.filter((target) => target.chapterId === chapterId).length : 0;
                    return <li key={`${index}:${title}`}>{title} — {activityCount} {activityCount > 1 ? "activités" : "activité"}</li>;
                  })}</ul>
                </>
              ) : null}
              <p>Un point de restauration sera créé et vérifié avant la suppression.</p>
              <div className="designer-actions-buttons">
                <button disabled={busy} onClick={onCancelDestructiveAction} type="button">Annuler</button>
                <button className="danger" disabled={busy || destructivePlan.targets.length === 0} onClick={onConfirmDestructiveAction} type="button">Supprimer les {destructivePlan.targets.length} activités</button>
              </div>
            </>
          ) : (
            <>
              <h3>Suppression effectuée</h3>
              <p>{destructivePlan.targets.length} {destructivePlan.targets.length > 1 ? "activités supprimées" : "activité supprimée"}. Le point «&nbsp;{destructivePlan.snapshotLabel}&nbsp;» est disponible dans Restaurations.</p>
              <div className="designer-actions-buttons">
                <button disabled={busy} onClick={onUndoDestructiveAction} type="button">Annuler la suppression</button>
              </div>
            </>
          )}
        </section>
      ) : null}

      {preview && !destructivePlan ? (
        <section className="designer-actions-preview">
          <h3>{labels.previewTitle}</h3>
          <div className="designer-actions-counts">
            <strong>{labels.affected}: {preview.targets.length}</strong>
          </div>
          {preview.intent.resolvedChapterTitles?.length ? (
            <p><strong>Chapitres ciblés&nbsp;:</strong> {preview.intent.resolvedChapterTitles.join(" · ")}</p>
          ) : null}
          {preview.warning ? <p><strong>Attention&nbsp;:</strong> {preview.warning}</p> : null}
          {preview.targets.length ? (
            <ul>
              {preview.targets.map((target) => (
                <li key={`${target.blockId}:${target.property}`}>
                  <strong>{target.blockTitle}</strong>
                  <span>{target.chapterTitle} · {target.previousDisplayValue ?? target.previousValue} → {target.displayValue ?? target.value}</span>
                </li>
              ))}
            </ul>
          ) : <p>{preview.unchanged.length ? labels.alreadyConfigured : labels.noTargets}</p>}
          <div className="designer-actions-buttons">
            {status === "applied" ? (
              <>
                <span className="designer-actions-success" role="status">{preview.targets.length > 1 ? labels.appliedPlural : labels.applied}</span>
                <button disabled={busy} onClick={onUndo} type="button">{labels.undo}</button>
              </>
            ) : status === "undone" ? (
              <span className="designer-actions-success" role="status">{labels.undone}</span>
            ) : (
              <>
                <button className="primary" disabled={busy || preview.targets.length === 0} onClick={onApply} type="button">{labels.apply}</button>
                <button disabled={busy} onClick={onCancel} type="button">{labels.cancel}</button>
              </>
            )}
          </div>
        </section>
      ) : null}
      </div>
      </div>
      <footer className="designer-actions-composer">
      <form
        className={`designer-actions-command${suggestionsVisible ? " suggestions-open" : ""}`}
        onSubmit={(event) => {
          event.preventDefault();
          const submittedCommand = command.trim();
          if (!busy && submittedCommand) {
            submitCommand(submittedCommand);
          }
        }}
      >
        <label className="sr-only" htmlFor="designer-actions-input">
          {questionSlot ? labels.answerLabel : question ? labels.followUpLabel : labels.inputLabel}
        </label>
        <div>
          <div className="designer-actions-input-wrap">
            <input
              aria-autocomplete="list"
              aria-controls="designer-actions-suggestions"
              aria-expanded={suggestionsVisible}
              aria-activedescendant={highlightedSuggestionIndex !== null ? `designer-action-suggestion-${suggestions[highlightedSuggestionIndex].id}` : undefined}
              autoComplete="off"
              id="designer-actions-input"
              onBlur={() => setInputFocused(false)}
               onChange={(event) => {
                 setCommand(event.target.value);
                 setActiveSuggestionIndex(null);
                 setSuggestionsHovered(false);
                 setInputFocused(true);
              }}
              onFocus={() => setInputFocused(true)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  event.stopPropagation();
                  if (highlightedSuggestionIndex !== null) {
                    submitCommand(suggestionInputValue(suggestions[highlightedSuggestionIndex]));
                  } else {
                    event.currentTarget.form?.requestSubmit();
                  }
                  return;
                }
                if (!suggestionsVisible) return;
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActiveSuggestionIndex(highlightedSuggestionIndex === null ? 0 : (highlightedSuggestionIndex + 1) % suggestions.length);
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActiveSuggestionIndex(highlightedSuggestionIndex === null ? suggestions.length - 1 : (highlightedSuggestionIndex - 1 + suggestions.length) % suggestions.length);
                } else if (event.key === "Tab") {
                  event.preventDefault();
                  setActiveSuggestionIndex(highlightedSuggestionIndex === null
                    ? (event.shiftKey ? suggestions.length - 1 : 0)
                    : event.shiftKey
                      ? (highlightedSuggestionIndex - 1 + suggestions.length) % suggestions.length
                      : (highlightedSuggestionIndex + 1) % suggestions.length);
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  event.stopPropagation();
                  setInputFocused(false);
                }
              }}
              placeholder={labels.inputLabel}
              ref={inputRef}
              role="combobox"
              type="text"
              value={command}
            />
            {suggestionsVisible ? (
              <ul
                className="designer-actions-suggestions"
                id="designer-actions-suggestions"
                onMouseEnter={() => setSuggestionsHovered(true)}
                onMouseLeave={() => setSuggestionsHovered(false)}
                onScroll={() => setSuggestionsInteractionVersion((current) => current + 1)}
                role="listbox"
              >
                {suggestions.map((suggestion, index) => (
                  <li
                    aria-selected={index === highlightedSuggestionIndex}
                    className={index === highlightedSuggestionIndex ? "active" : undefined}
                    id={`designer-action-suggestion-${suggestion.id}`}
                    key={suggestion.id}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      setCommand(suggestionInputValue(suggestion));
                      setSuggestionsHovered(false);
                      setInputFocused(false);
                      inputRef.current?.focus();
                    }}
                    role="option"
                  >
                    {suggestion.command}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <button
            aria-label={labels.analyze}
            className="designer-actions-send"
            disabled={busy || !command.trim()}
            title={labels.analyze}
            type="submit"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M12 20V4M5 11l7-7 7 7" />
            </svg>
          </button>
        </div>
      </form>
      {actionsAvailable ? <details className="designer-actions-frequent">
        <summary><svg className="designer-actions-frequent-chevron" aria-hidden="true" viewBox="0 0 24 24"><path d="m8 4 8 8-8 8"/></svg><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/></svg>{translate('designerActions.frequent',undefined,'Vos actions fréquentes')}</summary>
        <div className="designer-actions-frequent-popover">
        {usage.error ? <p role="status">{usage.error}</p> : null}
        <ul>{usage.suggestions.map(item=><li key={item.id}><button type="button" onClick={()=>{setCommand(item.command);inputRef.current?.focus();}}>{item.command}</button><button type="button" aria-label={`Retirer ${item.command}`} onClick={()=>usage.remove(item.id)}>×</button></li>)}</ul>
        <div className="designer-actions-usage-settings">
          <button type="button" onClick={usage.clear}>{translate('designerActions.clearUsage',undefined,'Effacer les habitudes')}</button>
          <button type="button" onClick={usage.toggle}>{usage.enabled ? translate('designerActions.disableUsage',undefined,'Désactiver la mémorisation') : translate('designerActions.enableUsage',undefined,'Activer la mémorisation')}</button>
        </div>
        </div>
      </details> : null}
      </footer>
    </aside>
  );
}
