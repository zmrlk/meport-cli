<script lang="ts">
  import { getRuleCompiler, type PlatformId } from "@meport/core/compiler";
  import type { ExportResult } from "@meport/core/types";
  import { getProfile, goTo, hasApiKey, getApiKey, getApiProvider } from "../lib/stores/app.svelte.js";
  import { platforms } from "../lib/platforms.js";
  import { AIEnricher, type RuleValidationResult } from "@meport/core/enricher";
  import { createAIClient } from "@meport/core/client";
  import { getLocale } from "../lib/i18n.svelte.js";
  import PlatformCard from "../components/PlatformCard.svelte";
  import ExportPreview from "../components/ExportPreview.svelte";
  import Icon from "../components/Icon.svelte";
  import Button from "../components/Button.svelte";
  import StatPill from "../components/StatPill.svelte";
  import SectionLabel from "../components/SectionLabel.svelte";
  import { t } from "../lib/i18n.svelte.js";

  let profile = $derived(getProfile());
  let selectedPlatform = $state("chatgpt");
  let exportResult = $state<ExportResult | null>(null);
  let apiConfigured = $derived(hasApiKey());

  // AI compilation toggle — persisted in localStorage
  let aiCompile = $state(localStorage.getItem("meport:ai-compile") === "true");
  let aiCompiling = $state(false);
  let aiCompiledContent = $state("");

  // Rule validation
  let ruleValidation = $state<RuleValidationResult | null>(null);
  let ruleValidating = $state(false);

  function toggleAiCompile() {
    aiCompile = !aiCompile;
    localStorage.setItem("meport:ai-compile", String(aiCompile));
    // Reset AI content when toggling off
    if (!aiCompile) aiCompiledContent = "";
  }

  $effect(() => {
    if (!profile) return;
    // Always compute rule-based result
    try {
      const compiler = getRuleCompiler(selectedPlatform as PlatformId);
      exportResult = compiler.compile(profile);
    } catch (e) {
      exportResult = null;
    }

    // If AI compile is on, trigger AI compilation
    if (aiCompile && apiConfigured) {
      aiCompiledContent = "";
      aiCompiling = true;
      const apiKey = getApiKey();
      const provider = getApiProvider();
      const clientProvider = provider === "anthropic" ? "claude" : provider;
      const client = createAIClient({
        provider: clientProvider as "claude" | "openai" | "ollama",
        apiKey,
      });
      const enricher = new AIEnricher(client, getLocale());
      enricher.compileForPlatform(profile, selectedPlatform).then(result => {
        if (result) aiCompiledContent = result;
      }).catch(() => {}).finally(() => {
        aiCompiling = false;
      });
    } else {
      aiCompiledContent = "";
    }
  });

  let selectedMeta = $derived(platforms.find(p => p.id === selectedPlatform));
  let completeness = $derived(profile?.completeness ?? 0);
  let dimensionCount = $derived(profile ?
    Object.keys(profile.explicit).length +
    Object.keys(profile.inferred).length +
    Object.keys(profile.compound).length : 0);

  async function validateRules() {
    if (!profile || !apiConfigured || ruleValidating) return;
    const rules = profile.synthesis?.exportRules ?? [];
    if (rules.length === 0) return;

    ruleValidating = true;
    ruleValidation = null;
    try {
      const apiKey = getApiKey();
      const provider = getApiProvider();
      const clientProvider = provider === "anthropic" ? "claude" : provider;
      const client = createAIClient({
        provider: clientProvider as "claude" | "openai" | "ollama",
        apiKey,
      });
      const enricher = new AIEnricher(client, getLocale());
      ruleValidation = await enricher.validateExportRules(rules);
    } catch {
      ruleValidation = null;
    } finally {
      ruleValidating = false;
    }
  }

  async function downloadAll() {
    if (!profile) return;
    for (const p of platforms) {
      try {
        const compiler = getRuleCompiler(p.id as PlatformId);
        const result = compiler.compile(profile);
        const blob = new Blob([result.content], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = result.filename;
        a.click();
        URL.revokeObjectURL(url);
        await new Promise(r => setTimeout(r, 200));
      } catch { /* skip failed */ }
    }
  }
</script>

<div class="screen">
  {#if profile}
    <!-- Header -->
    <div class="header animate-fade-up" style="--delay: 0ms">
      <div class="header-top">
        <h1 class="header-title">{t("export.profile_ready")}</h1>
        <div class="header-stats">
          <StatPill value={dimensionCount} label={t("home.dimensions")} />
          <StatPill value="{completeness}%" label={t("home.complete")} />
        </div>
      </div>
    </div>

    <div class="main">
      <!-- Platform selector -->
      <div class="platforms animate-fade-up" style="--delay: 200ms">
        <SectionLabel>{t("export.export_to")}</SectionLabel>
        <div class="platform-grid">
          {#each platforms as platform, i}
            <div class="animate-fade-up" style="--delay: {300 + i * 40}ms">
              <PlatformCard
                {platform}
                selected={selectedPlatform === platform.id}
                onclick={() => { selectedPlatform = platform.id; }}
              />
            </div>
          {/each}
        </div>
        <Button variant="secondary" size="sm" onclick={downloadAll}>
          <Icon name="download" size={14} />
          {t("export.download_all")}
        </Button>
      </div>

      <!-- AI Compile Toggle -->
      {#if apiConfigured}
        <div class="ai-toggle-row animate-fade-up" style="--delay: 350ms">
          <button class="ai-toggle" class:active={aiCompile} onclick={toggleAiCompile}>
            <Icon name="sparkle" size={14} />
            {t("export.ai_compile")}
          </button>
          {#if aiCompile}
            <span class="ai-toggle-sub">{t("export.ai_compile_sub")}</span>
          {/if}
        </div>
      {/if}

      <!-- Preview -->
      <div class="preview-area animate-fade-up" style="--delay: 400ms">
        {#if aiCompiling}
          <div class="ai-compiling-state">
            <div class="scan-ring"></div>
            <p>{t("export.compiling")}</p>
          </div>
        {:else if aiCompiledContent && aiCompile}
          <ExportPreview
            content={aiCompiledContent}
            filename={exportResult?.filename ?? "meport-profile.md"}
            instructions={exportResult?.instructions ?? ""}
            dimensionsCovered={exportResult?.dimensionsCovered ?? 0}
            dimensionsOmitted={exportResult?.dimensionsOmitted ?? 0}
            confidence_floor={exportResult?.confidence_floor ?? 0}
          />
        {:else if exportResult}
          <ExportPreview
            content={exportResult.content}
            filename={exportResult.filename}
            instructions={exportResult.instructions}
            dimensionsCovered={exportResult.dimensionsCovered}
            dimensionsOmitted={exportResult.dimensionsOmitted}
            confidence_floor={exportResult.confidence_floor}
          />
        {:else}
          <div class="no-preview glass">
            <p>{t("export.select_platform")}</p>
          </div>
        {/if}

        {#if exportResult && selectedMeta?.settingsUrl}
          <Button variant="primary" size="md" href={selectedMeta.settingsUrl} class="settings-link">
            <Icon name="external" size={14} />
            {t("export.open_settings")} {selectedMeta.name}
          </Button>
        {/if}

        <!-- Rule Validation -->
        {#if apiConfigured && profile?.synthesis?.exportRules?.length}
          <div class="rule-validation-section">
            {#if !ruleValidation && !ruleValidating}
              <button class="validate-btn" onclick={validateRules}>
                <Icon name="check-circle" size={14} />
                Validate export rules
              </button>
            {:else if ruleValidating}
              <div class="ai-compiling-state">
                <div class="scan-ring"></div>
                <p>Validating rules...</p>
              </div>
            {:else if ruleValidation}
              <div class="validation-results">
                <div class="validation-summary">
                  <span class="quality-pill high">{ruleValidation.qualityBreakdown.high} high</span>
                  <span class="quality-pill medium">{ruleValidation.qualityBreakdown.medium} medium</span>
                  {#if ruleValidation.qualityBreakdown.low > 0}
                    <span class="quality-pill low">{ruleValidation.qualityBreakdown.low} weak</span>
                  {/if}
                </div>
                {#if ruleValidation.weakRules.length > 0}
                  <div class="weak-rules">
                    <SectionLabel>Rules to improve</SectionLabel>
                    {#each ruleValidation.weakRules as weak}
                      <div class="weak-rule-item">
                        <p class="weak-rule-original">{weak.rule}</p>
                        <p class="weak-rule-problem">{weak.problem}</p>
                        <p class="weak-rule-fix">{weak.improvement}</p>
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  {:else}
    <!-- Empty state -->
    <div class="empty-state">
      <div class="empty-icon animate-fade-up" style="--delay: 0ms">
        <Icon name="download" size={40} />
      </div>
      <h1 class="empty-title animate-fade-up" style="--delay: 150ms">{t("export.no_profile")}</h1>
      <p class="empty-desc animate-fade-up" style="--delay: 300ms">{t("export.no_profile_desc")}</p>
      <div class="animate-fade-up" style="--delay: 450ms">
        <Button variant="primary" size="lg" onclick={() => goTo("home")}>
          {t("export.create_profile")}
          <Icon name="arrow-right" size={16} />
        </Button>
      </div>
    </div>
  {/if}
</div>

<style>
  .screen {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .header {
    padding: var(--sp-4) var(--sp-6);
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  .header-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-4);
  }

  .header-title {
    font-size: var(--text-lg);
    font-weight: 500;
    margin: 0;
    color: var(--color-text);
  }

  .header-stats {
    display: flex;
    gap: var(--sp-2);
  }

  .main {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  .platforms {
    width: 260px;
    flex-shrink: 0;
    padding: var(--sp-4);
    border-right: 1px solid var(--color-border);
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
  }

  .platform-grid {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .preview-area {
    flex: 1;
    padding: var(--sp-4);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
  }

  .no-preview {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-lg);
    color: var(--color-text-muted);
    font-size: var(--text-base);
  }

  :global(.settings-link) {
    width: 100%;
  }

  /* ─── Empty state ─── */
  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: var(--sp-8);
  }

  .empty-icon {
    margin-bottom: var(--sp-4);
    color: var(--color-text-ghost);
  }

  .empty-title {
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--color-text);
    margin: 0;
  }

  .empty-desc {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    margin: var(--sp-2) 0 0 0;
    max-width: 300px;
    line-height: 1.5;
  }

  @media (max-width: 768px) {
    .main {
      flex-direction: column;
    }

    .platforms {
      width: 100%;
      border-right: none;
      border-bottom: 1px solid var(--color-border);
      max-height: 240px;
    }

    .platform-grid {
      flex-direction: row;
      flex-wrap: wrap;
      gap: 6px;
    }
  }

  /* AI Compile Toggle */
  .ai-toggle-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0 1rem;
  }

  .ai-toggle {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.4rem 0.85rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-full);
    background: transparent;
    color: var(--color-text-muted);
    font-size: var(--text-xs);
    cursor: pointer;
    transition: all 0.2s;
  }

  .ai-toggle.active {
    background: oklch(from var(--color-accent) l c h / 0.15);
    border-color: var(--color-accent);
    color: var(--color-accent);
  }

  .ai-toggle-sub {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    opacity: 0.7;
  }

  .ai-compiling-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 3rem 2rem;
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }

  .scan-ring {
    width: 32px;
    height: 32px;
    border: 2px solid oklch(from var(--color-accent) l c h / 0.3);
    border-top-color: var(--color-accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Rule Validation */
  .rule-validation-section {
    padding-top: var(--sp-2);
  }

  .validate-btn {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 1rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--color-text-muted);
    font-size: var(--text-xs);
    cursor: pointer;
    transition: all 0.2s;
  }

  .validate-btn:hover {
    border-color: var(--color-accent);
    color: var(--color-accent);
  }

  .validation-results {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .validation-summary {
    display: flex;
    gap: 0.5rem;
  }

  .quality-pill {
    padding: 0.2rem 0.6rem;
    border-radius: var(--radius-full);
    font-size: var(--text-xs);
    font-weight: 500;
  }

  .quality-pill.high {
    background: oklch(0.45 0.15 145 / 0.15);
    color: oklch(0.45 0.15 145);
  }

  .quality-pill.medium {
    background: oklch(0.65 0.15 85 / 0.15);
    color: oklch(0.65 0.15 85);
  }

  .quality-pill.low {
    background: oklch(0.55 0.2 25 / 0.15);
    color: oklch(0.55 0.2 25);
  }

  .weak-rules {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .weak-rule-item {
    padding: 0.75rem;
    border: 1px solid oklch(from var(--color-text) l c h / 0.08);
    border-radius: var(--radius-md);
    font-size: var(--text-xs);
  }

  .weak-rule-original {
    margin: 0 0 0.25rem;
    color: var(--color-text-muted);
    text-decoration: line-through;
    opacity: 0.6;
  }

  .weak-rule-problem {
    margin: 0 0 0.25rem;
    color: oklch(0.55 0.2 25);
  }

  .weak-rule-fix {
    margin: 0;
    color: oklch(0.45 0.15 145);
    font-weight: 500;
  }
</style>
