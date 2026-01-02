<template>
  <div class="quantum-card">
    <!-- Main heading -->
    <h3 class="main-title">Quantum Assessment</h3>

    <!-- QTRL Section -->
    <div class="qtrl-section">
      <div class="section-header">
        <h4 class="section-title">Quantum Transition Readiness Level</h4>
        <cv-tooltip alignment="start" direction="bottom" :tip="qtrlLevelsExplanation">
          <Information16 class="help-icon" />
        </cv-tooltip>
      </div>
      <div class="qtrl-display">
        <cv-tag :label="qtrl.level !== undefined && qtrl.level !== fallback ? `Level ${qtrl.level}` : fallback" :kind="getQtrlTagKind(qtrl.level)"></cv-tag>
        <span class="qtrl-name">{{ qtrl.name || fallback }}</span>
      </div>
      <p class="qtrl-conditions">{{ qtrl.conditions || fallback }}</p>
    </div>

    <!-- Vectors Section -->
    <div class="vectors-section">
      <div class="section-header">
        <h4 class="section-title">Quantum Security Vectors</h4>
      </div>
      <p class="section-subtitle">Six quantum security vectors with dual-risk analysis.</p>

      <div class="vector-grid">
          <div class="vector" v-for="vector in vectors" :key="vector.id || vector.name">
          <div class="vector-header">
              <span class="vector-name">{{ getVectorDisplayName(vector) }}</span>
              <cv-tooltip alignment="start" direction="top" :tip="getVectorDescription(vector.id)">
              <Information16 class="help-icon-small" />
            </cv-tooltip>
            <cv-tag :label="vector.status || fallback" :kind="getStatusTagKind(vector.status)"></cv-tag>
          </div>
          <div class="vector-meta">
            <cv-tag :label="`Severity: ${vector.severity || fallback}`" :kind="getSeverityTagKind(vector.severity)"></cv-tag>
            <cv-tag :label="`Urgency: ${vector.urgency || fallback}`" :kind="getUrgencyTagKind(vector.urgency)"></cv-tag>
          </div>
          <p class="notes">{{ vector.notes || fallback }}</p>
        </div>
      </div>
      <p class="legend">
        Severity/urgency levels: critical, high, medium, low, informational.
      </p>
    </div>
  </div>
</template>

<script>
import { getQuantumSecurity, NOT_ANALYSED_TEXT, getVectorDescription, getQuantumVectorDefinitions } from "@/helpers";
import { Information16 } from "@carbon/icons-vue";

export default {
  name: "QuantumSecurityView",
  components: {
    Information16,
  },
  computed: {
    quantum() {
      return getQuantumSecurity();
    },
    qtrl() {
      return this.quantum.qtrl;
    },
    vectors() {
      return this.quantum.vectors;
    },
    fallback() {
      return NOT_ANALYSED_TEXT;
    },
    qtrlLevelsExplanation() {
      return `QTRL classifies quantum readiness into four levels:
• Level 0 (Exposed): HNDL vulnerability present
• Level 1 (Near-term safe): No HNDL; No crypto agility; Auth/KML vulnerable
• Level 2 (Transition-enabled): No HNDL; Crypto agility present; Auth/KML vulnerable
• Level 3 (Quantum-ready): All six vectors addressed`;
    },
  },
  methods: {
    getStatusTagKind(status) {
      const statusLower = status?.toLowerCase();
      if (statusLower === "vulnerable") return "purple";
      if (statusLower === "not_analysed" || status === this.fallback) return "gray";
      return "gray";
    },
    getSeverityTagKind(severity) {
      const kindMap = {
        critical: "purple",
        high: "magenta",
        medium: "cyan",
        low: "green",
        informational: "gray",
      };
      return kindMap[severity?.toLowerCase()] || "gray";
    },
    getUrgencyTagKind(urgency) {
      const kindMap = {
        critical: "purple",
        high: "magenta",
        medium: "cyan",
        low: "green",
        informational: "gray",
      };
      return kindMap[urgency?.toLowerCase()] || "gray";
    },
    getQtrlTagKind(level) {
      const kindMap = {
        0: "purple",   // Exposed - critical
        1: "magenta",  // Near-term safe
        2: "cyan",     // Transition-enabled
        3: "green",    // Quantum-ready
      };
      return kindMap[level] ?? "gray";
    },
    getVectorDescription(id) {
      return getVectorDescription(id);
    },
    getVectorDisplayName(vector) {
      const definitions = getQuantumVectorDefinitions();
      const id = vector?.id || vector?.name;
      const lowerName = (vector?.name || "").toLowerCase();

      const byId = definitions.find((v) => v.id === id);
      if (byId) return byId.name;

      const byName = definitions.find((v) => v.name.toLowerCase() === lowerName);
      if (byName) return byName.name;

      return id || "";
    },
  },
};
</script>

<style scoped>
.quantum-card {
  padding: 24px 16px 16px 16px;
  border-top: 1px solid var(--cds-border-subtle, #e0e0e0);
}

.main-title {
  margin: 0 0 16px 0;
  font-weight: 500;
  font-size: 1.25rem;
}

.qtrl-section {
  margin-bottom: 24px;
  padding: 16px;
  background: var(--cds-layer, #f4f4f4);
  border-radius: 4px;
  border: 1px solid var(--cds-border-subtle, #e0e0e0);
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.section-title {
  margin: 0;
  font-weight: 500;
  font-size: 1rem;
}

.qtrl-display {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.qtrl-name {
  font-weight: 600;
  font-size: 1rem;
}

.qtrl-conditions {
  margin: 0;
  color: var(--cds-text-secondary, #525252);
  font-size: 0.9rem;
  font-style: italic;
}

.vectors-section {
  margin-bottom: 12px;
}

.section-subtitle {
  margin: 0 0 12px 0;
  color: var(--cds-text-secondary, #525252);
  font-size: 0.9rem;
}

.vector-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 12px;
}

.vector {
  border: 1px solid var(--cds-border-subtle, #e0e0e0);
  border-radius: 4px;
  padding: 12px;
  background: var(--cds-layer, #f4f4f4);
}

.vector-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.vector-name {
  font-weight: 600;
  flex-shrink: 0;
}

.vector-meta {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}

.notes {
  margin: 0;
  color: var(--cds-text-secondary, #525252);
  font-size: 0.9rem;
}

.legend {
  margin-top: 12px;
  margin-bottom: 0;
  color: var(--cds-text-secondary, #525252);
  font-size: 0.9rem;
}

.help-icon {
  cursor: help;
  color: var(--cds-text-secondary, #525252);
}

.help-icon:hover {
  color: var(--cds-text-primary);
}

.help-icon-small {
  cursor: help;
  color: var(--cds-text-secondary, #525252);
  width: 14px;
  height: 14px;
}

.help-icon-small:hover {
  color: var(--cds-text-primary);
}
</style>

