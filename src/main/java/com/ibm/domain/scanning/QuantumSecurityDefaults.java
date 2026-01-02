/*
 * Tectonic Labs
 */
package com.ibm.domain.scanning;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.annotation.Nonnull;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/** Ensures the CBOM carries a quantumSecurity block with safe defaults. */
public final class QuantumSecurityDefaults {

    public static final String NOT_ANALYSED = "Not analysed";
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private static final List<VectorDefinition> VECTOR_DEFINITIONS =
            List.of(
                    new VectorDefinition("hndl", "Harvest-now-decrypt-later threat"),
                    new VectorDefinition("authentication", "Authentication threat"),
                    new VectorDefinition("kml", "Key management and lifecycle"),
                    new VectorDefinition("thirdParty", "Dependency on third parties"),
                    new VectorDefinition("cryptoAgility", "Cryptographic agility"),
                    new VectorDefinition("governance", "Governance and compliance"));

    private QuantumSecurityDefaults() {}

    /**
     * Insert the quantumSecurity block if missing and fill missing fields with "Not analysed".
     * Also ensures each component has cryptoProperties.quantumAssessment with defaults.
     * The returned node may be the same instance as the input.
     */
    public static JsonNode ensurePresent(JsonNode bom) {
        if (!(bom instanceof ObjectNode root)) {
            return bom;
        }

        final ObjectNode quantum =
                root.has("quantumSecurity") && root.get("quantumSecurity").isObject()
                        ? (ObjectNode) root.get("quantumSecurity")
                        : root.putObject("quantumSecurity");

        ensureQtrl(quantum);
        ensureVectors(quantum);
        ensureRiskModel(quantum);
        ensureComponentQuantumAssessments(root);

        return root;
    }

    /**
     * Ensures each component in the CBOM has a quantumAssessment block inside cryptoProperties.
     */
    private static void ensureComponentQuantumAssessments(@Nonnull ObjectNode root) {
        if (!root.has("components") || !root.get("components").isArray()) {
            return;
        }

        final ArrayNode components = (ArrayNode) root.get("components");
        components.forEach(
                node -> {
                    if (!(node instanceof ObjectNode component)) {
                        return;
                    }
                    // Only process cryptographic-asset components
                    if (!component.has("type")
                            || !"cryptographic-asset".equals(component.get("type").asText())) {
                        return;
                    }
                    // Ensure cryptoProperties exists
                    final ObjectNode cryptoProps =
                            component.has("cryptoProperties")
                                            && component.get("cryptoProperties").isObject()
                                    ? (ObjectNode) component.get("cryptoProperties")
                                    : component.putObject("cryptoProperties");

                    ensureQuantumAssessment(cryptoProps);
                });
    }

    /**
     * Ensures the quantumAssessment block exists within cryptoProperties with default values.
     */
    private static void ensureQuantumAssessment(@Nonnull ObjectNode cryptoProps) {
        final ObjectNode assessment =
                cryptoProps.has("quantumAssessment")
                                && cryptoProps.get("quantumAssessment").isObject()
                        ? (ObjectNode) cryptoProps.get("quantumAssessment")
                        : cryptoProps.putObject("quantumAssessment");

        defaultString(assessment, "vector");
        defaultString(assessment, "severity");
        defaultString(assessment, "urgency");
        defaultString(assessment, "notes");
    }

    private static void ensureQtrl(@Nonnull ObjectNode quantum) {
        final ObjectNode qtrl =
                quantum.has("qtrl") && quantum.get("qtrl").isObject()
                        ? (ObjectNode) quantum.get("qtrl")
                        : quantum.putObject("qtrl");
        defaultString(qtrl, "level");
        defaultString(qtrl, "name");
        defaultString(qtrl, "conditions");
    }

    private static void ensureVectors(@Nonnull ObjectNode quantum) {
        if (!quantum.has("vectors") || !quantum.get("vectors").isArray()) {
            quantum.set("vectors", defaultVectors());
            return;
        }

        final ArrayNode vectors = (ArrayNode) quantum.get("vectors");
        if (vectors.isEmpty()) {
            quantum.set("vectors", defaultVectors());
            return;
        }

        final Map<String, ObjectNode> merged =
                VECTOR_DEFINITIONS.stream()
                        .collect(
                                Collectors.toMap(
                                        VectorDefinition::id,
                                        def -> defaultVector(def.id(), def.name())));

        vectors.forEach(
                node -> {
                    if (!(node instanceof ObjectNode vector)) {
                        return;
                    }
                    final String id =
                            vector.has("id") && vector.get("id").isTextual()
                                    ? vector.get("id").asText()
                                    : null;
                    final ObjectNode target =
                            id != null ? merged.getOrDefault(id, vector) : vector;
                    defaultString(target, "id");
                    defaultString(target, "name");
                    defaultString(target, "status");
                    defaultString(target, "severity");
                    defaultString(target, "urgency");
                    defaultString(target, "notes");
                    merged.put(target.get("id").asText(), target);
                });

        final ArrayNode normalized = MAPPER.createArrayNode();
        merged.values().forEach(normalized::add);
        quantum.set("vectors", normalized);
    }

    private static void ensureRiskModel(@Nonnull ObjectNode quantum) {
        final ObjectNode riskModel =
                quantum.has("riskModel") && quantum.get("riskModel").isObject()
                        ? (ObjectNode) quantum.get("riskModel")
                        : quantum.putObject("riskModel");

        if (!riskModel.has("severityLevels") || !riskModel.get("severityLevels").isArray()) {
            riskModel.set("severityLevels", defaultSeverityLevels());
        }
        if (!riskModel.has("urgencyLevels") || !riskModel.get("urgencyLevels").isArray()) {
            riskModel.set("urgencyLevels", defaultUrgencyLevels());
        }
        defaultString(riskModel, "notes");
    }

    private static ArrayNode defaultVectors() {
        final ArrayNode array = MAPPER.createArrayNode();
        VECTOR_DEFINITIONS.forEach(def -> array.add(defaultVector(def.id(), def.name())));
        return array;
    }

    private static ObjectNode defaultVector(String id, String name) {
        final ObjectNode vector = MAPPER.createObjectNode();
        vector.put("id", id);
        vector.put("name", name);
        vector.put("status", NOT_ANALYSED);
        vector.put("severity", NOT_ANALYSED);
        vector.put("urgency", NOT_ANALYSED);
        vector.put("notes", NOT_ANALYSED);
        return vector;
    }

    private static ArrayNode defaultSeverityLevels() {
        final ArrayNode severityLevels = MAPPER.createArrayNode();
        severityLevels.add("critical").add("high").add("medium").add("low").add("informational");
        return severityLevels;
    }

    private static ArrayNode defaultUrgencyLevels() {
        final ArrayNode urgencyLevels = MAPPER.createArrayNode();
        urgencyLevels.add("critical").add("high").add("medium").add("low").add("informational");
        return urgencyLevels;
    }

    private static void defaultString(@Nonnull ObjectNode node, String field) {
        if (!node.has(field) || !node.get(field).isTextual()) {
            node.put(field, NOT_ANALYSED);
        }
    }

    private record VectorDefinition(String id, String name) {}
}

