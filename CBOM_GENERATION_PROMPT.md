# CBOM Generation Prompt for Cursor

Use this prompt in Cursor (or any AI assistant) to generate CBOM (Cryptography Bill of Materials) JSON files that are compatible with CBOMkit.

## Full Prompt

```
Generate a CBOM (Cryptography Bill of Materials) JSON file in CycloneDX format that is compatible with CBOMkit (https://github.com/cbomkit/cbomkit). The output must be valid JSON that can be uploaded to the CBOMkit platform.

**Quantum Transition Readiness Framework:**

The quantum security assessment follows a structured framework organized around six quantum security vectors, a readiness level (QTRL), and a dual-risk model.

**The Six Quantum Security Vectors:**

1. **HNDL (Harvest-now-decrypt-later threat)** (`hndl`): Analyses storage exposure in data at rest (archives, backups, database encryption), traffic analysis exposure (VPNs, TLS endpoints), and long-term data retention policies (certificates, static keys, third-party access to sensitive encrypted data).

2. **Authentication threat** (`authentication`): Analyses digital signatures being used (code signing, email, documents, protocol level), the certificate management system, and multi-factor authentication.

3. **Key management and lifecycle** (`kml`): Analyses the quantum robustness of key storage, key rotation and destruction procedures, and key escrow policies. Focus is limited to post-quantum aspects.

4. **Dependency on third parties** (`thirdParty`): Analyses vendor's quantum readiness, library dependencies, API security, and supply chain risks.

5. **Cryptographic agility** (`cryptoAgility`): Analyses cryptographic abstraction layers and modular libraries, protocol flexibility to swap algorithms without system redesign, update and fallback mechanisms, and hybrid cryptographic algorithms being used.

6. **Governance and compliance** (`governance`): Analyses cryptographic suite compliance with NIST, CNSA 2.0, ETSI, and ISO/IEC standards, and processes to monitor and detect anomalies/security breaches in post-quantum algorithms.

**Quantum Transition Readiness Level (QTRL):**

QTRL is an overall project-level metric that classifies quantum readiness into four levels:

| QTRL | Name | Conditions |
|------|------|------------|
| 0 | Exposed | HNDL vulnerability present |
| 1 | Near-term safe | No HNDL vulnerability; No cryptographic agility; Authentication and/or KML vulnerability present |
| 2 | Transition-enabled | No HNDL vulnerability; Cryptographic agility present; Authentication and/or KML vulnerability present |
| 3 | Quantum-ready | All six vectors are addressed and meet quantum security requirements |

**Dual-Risk Model (Severity + Urgency):**

Each identified security issue is rated using a two-axis risk model:

- **Severity** (impact of a cryptographically relevant quantum computer attack):
  - `critical`: Immediate catastrophic impact on data sensitivity, secrecy lifetime, or system criticality (e.g., payments, medical devices, identity systems)
  - `high`: Significant impact requiring priority attention
  - `medium`: Moderate impact with manageable consequences
  - `low`: Minor impact with limited consequences
  - `informational`: No direct security impact, advisory only

- **Urgency** (effort required to migrate from classical to post-quantum solutions):
  - `critical`: Immediate action required
  - `high`: Action required in short term (6-18 months)
  - `medium`: Migration required before 2030-35 timeline set by regulatory agencies
  - `low`: Monitor with long-term plan
  - `informational`: No migration action needed

This dual model ensures risks are prioritized not only by impact but also by time sensitivity and migration complexity.

**Compliance Standards:**

When performing quantum security analysis, check compliance against the following standards:

**CNSA 2.0 Cryptography Requirements:**

- **Asymmetric Key Establishment:**
  - Required: CRYSTALS-Kyber-1024 (also called ML-KEM-1024) only

- **Digital Signatures:**
  - Approved Post-Quantum:
    - ML-DSA-87 only
    - SLH-DSA (SPHINCS+)
  - Approved Stateful Hash-Based:
    - XMSS (RFC 8391)
    - LMS (NIST SP 800-208)
  - Stateful signatures must include strict state-management controls

- **Symmetric Encryption:**
  - AES-256 only
  - Preferred mode: AES-256-GCM
  - Other secure modes allowed as defined in standards

- **Hash Functions:**
  - SHA-384 or SHA-512
  - SHA-512 preferred
  - SHA3-384 or SHA3-512 allowed for internal hardware functionality only (e.g., boot-up integrity checks)

- **Key Derivation / PRFs:**
  - HKDF or other KDFs based on SHA-384 / SHA-512

**NIST Post-Quantum Cryptography Standards:**

- **Key Encapsulation Mechanisms (KEM):**
  - ML-KEM (CRYSTALS-Kyber)
    - ML-KEM-512
    - ML-KEM-768
    - ML-KEM-1024 (aligned with CNSA 2.0 requirement)

- **Digital Signatures:**
  - ML-DSA (CRYSTALS-Dilithium)
    - ML-DSA-44
    - ML-DSA-65
    - ML-DSA-87
  - SLH-DSA (SPHINCS+)
  - Multiple parameter sets for security/performance tradeoffs

- **Hash Functions:**
    - SHA-256, SHA-384 or SHA-512
    - Does not allow SHA-128 

When assessing the **governance and compliance** vector, evaluate whether cryptographic components comply with these CNSA 2.0 and NIST Post-Quantum Cryptography requirements. Flag non-compliant algorithms and recommend compliant alternatives.

**Compliance timelines and transition estimation**

CNSA 2.0 timeline:
- 2022–2024: CNSA 2.0 is introduced, optional, and tested.
- By 2025: Software/firmware signing and web/cloud services prefer CNSA 2.0.
- By 2026: Traditional networking equipment prefers CNSA 2.0.
- By 2027: Operating systems prefer CNSA 2.0.
- By ~2030: Exclusive CNSA 2.0 use required for most categories.
- 2031–2033: Niche and legacy equipment must fully adopt CNSA 2.0.

NIST PQC Migration and deprecation timeline:
- August 2024: First PQC standards (FIPS 203/204/205) finalize. 
- 2030: NIST guidance aims to deprecate use of classical public-key algorithms (e.g., RSA, ECDSA, ECDH) by around this year for many use cases. 
- 2035: Quantum-vulnerable algorithms are expected to be fully removed/disallowed in federal standards later in this window

EU PQC roadmap:
- Dec 31, 2026: Initial national PQC roadmaps completed. 
- Dec 31, 2030: High-risk use cases implemented with PQC. 
- Dec 31, 2035: Full transition feasible for most systems

Benchmark Migration Durations

- **Small enterprises:** 5–7 years  
- **Medium enterprises:** 8–12 years  
- **Large enterprises:** 12–15+ years  
  - (may reach **20+ years** where legacy infrastructure is extreme)

Benchmark Component Timelines

These durations typically contribute to total migration time:

- **Cryptographic discovery & inventory:** 1–3 years  
- **Hardware & infrastructure upgrades**  
  *(HSMs, devices, network gear, secure enclaves, etc.):* **2–7 years**  
- **Application & protocol migration**  
  *(TLS, VPN, messaging, APIs, authentication, etc.):* **3–10 years**  
- **Vendor / partner ecosystem coordination:** 1–5 years  
- **Governance, training, and change-program onboarding:**  
  - Ongoing, but typically adds **~1+ year of ramp-up overhead**

**Required Structure:**

1. **Top-level fields (MANDATORY):**
   - `bomFormat`: "CycloneDX"
   - `specVersion`: "1.6"
   - `serialNumber`: "urn:uuid:XXXXX" (generate a UUID)
   - `version`: 1
   - `metadata`: object (see below)
   - `components`: array (see below)
   - `dependencies`: [] (can be empty array)
   - `quantumSecurity`: object (optional; if no quantum analysis is available, set every field inside to `"Not analysed"` so CBOMs stay backward compatible)

2. **Metadata structure:**
```json
{
  "metadata": {
    "timestamp": "ISO 8601 timestamp (e.g., 2025-02-26T09:01:57Z)",
    "properties": [
      {
        "name": "gitUrl",
        "value": "https://github.com/org/repo"
      },
      {
        "name": "revision",
        "value": "main"
      },
      {
        "name": "commit",
        "value": "commit-hash"
      }
    ]
  }
}
```

3. **Component structure (each cryptographic asset):**
```json
{
  "type": "cryptographic-asset",
  "bom-ref": "uuid-here",
  "name": "AlgorithmName (e.g., SHA256, AES, ECDH)",
  "evidence": {
    "occurrences": [
      {
        "location": "path/to/file.ext",
        "line": 123,
        "offset": 45,
        "additionalContext": "API call context (optional but recommended)"
      }
    ]
  },
  "cryptoProperties": {
    "assetType": "algorithm" | "related-crypto-material",
    "algorithmProperties": {
      "primitive": "hash" | "signature" | "key-agree" | "pke" | "kem" | "symmetric" | "other",
      "parameterSetIdentifier": "256" | "128" | "160" | "2048" | etc. (optional),
      "cryptoFunctions": ["digest"] | ["keygen"] | ["encrypt", "decrypt"] | etc.,
      "curve": "secp521r1" | etc. (optional, for elliptic curve algorithms)
    },
    "quantumAssessment": {
      "vector": "hndl" | "authentication" | "kml" | "thirdParty" | "cryptoAgility" | "governance" | "Not analysed",
      "severity": "critical" | "high" | "medium" | "low" | "informational" | "Not analysed",
      "urgency": "critical" | "high" | "medium" | "low" | "informational" | "Not analysed",
      "notes": "Free-text assessment notes (optional)"
    },
    "oid": "ASN.1 OID string" (optional)
  }
}
```

**Quantum Assessment Fields (per-component):**
- `vector`: The security vector this component relates to (hndl, authentication, kml, thirdParty, cryptoAgility, governance)
- `severity`: Severity level (critical, high, medium, low, informational)
- `urgency`: Urgency level (critical, high, medium, low, informational)
- `notes`: Free-text assessment notes


If you cannot compute the quantum metrics, keep every field as `"Not analysed"` so the CBOM stays backward compatible. If you can compute them, populate the vector `status`/`severity`/`urgency` fields and the `qtrl` fields accordingly.

**For related-crypto-material:**
```json
{
  "cryptoProperties": {
    "assetType": "related-crypto-material",
    "relatedCryptoMaterialProperties": {
      "type": "secret-key" | etc.
    }
  }
}
```

**Validation Requirements (from CBOMkit frontend):**
- `bomFormat` must exist
- `specVersion` must exist
- `serialNumber` must exist
- `version` must exist
- `components` must be an array (can be empty)
- Each component must have `type` field
- Components with `type: "cryptographic-asset"` must have `cryptoProperties` field
- Components with other types will be ignored

**Primitive Types Supported:**
- `hash` - Hash functions (SHA-256, SHA-1, MD5, etc.)
- `signature` - Digital signatures (DSA, RSA, ECDSA, EdDSA, etc.)
- `key-agree` - Key agreement (ECDH, DH, etc.)
- `pke` - Public key encryption
- `kem` - Key encapsulation mechanisms
- `symmetric` - Symmetric encryption (AES, etc.)
- `other` - Other cryptographic primitives

**Example Component - Hash Algorithm:**
```json
{
  "type": "cryptographic-asset",
  "bom-ref": "a0c043f6-e210-45c4-92ba-4461229e0232",
  "name": "SHA256",
  "evidence": {
    "occurrences": [
      {
        "location": "src/main/example.rs",
        "line": 42,
        "offset": 15,
        "additionalContext": "ring::digest::digest(ring::digest::SHA256, data)"
      }
    ]
  },
  "cryptoProperties": {
    "assetType": "algorithm",
    "algorithmProperties": {
      "primitive": "hash",
      "parameterSetIdentifier": "256",
      "cryptoFunctions": ["digest"]
    },
    "oid": "2.16.840.1.101.3.4.2.1"
  }
}
```

**Task:**
Scan the codebase for cryptographic usage and generate a complete and valid CBOM JSON file following the exact structure above. Include:
- All detected cryptographic algorithms
- All detected cryptographic keys/materials
- Evidence with file locations and line numbers
- Proper primitive types and crypto functions
- Valid UUIDs for bom-ref fields
- ISO 8601 timestamp
- **Quantum security analysis according to the Quantum Transition Readiness Framework:**
  - For each cryptographic component, assess which of the six quantum security vectors it relates to (HNDL, authentication, KML, thirdParty, cryptoAgility, or governance)
  - Assign per-component `quantumAssessment` with appropriate `vector`, `severity`, and `urgency` based on the dual-risk model
  - Assess severity based on the impact of a cryptographically relevant quantum computer attack (critical, high, medium, low, informational)
  - **Check compliance against CNSA 2.0 and NIST Post-Quantum Cryptography Standards:**
    - Verify algorithms comply with CNSA 2.0 requirements (ML-KEM-1024, ML-DSA, AES-256, SHA-384/512, etc.)
    - Verify algorithms comply with NIST Post-Quantum Cryptography Standards (ML-KEM, ML-DSA, SLH-DSA)
    - Flag non-compliant algorithms (e.g., RSA, ECC for long-term confidentiality, SHA-1, AES-128, etc.)
    - Note compliance status in the `governance` vector assessment and component `quantumAssessment.notes`
  - Compute the overall project Quantum Transition Readiness Level (QTRL) (0-3) based on the presence or absence of vulnerabilities across the six vectors
  - Assess urgency based on migration effort and timeline requirements (critical, high, medium, low, informational), considering the compliance timelines and transition estimation benchmarks (CNSA 2.0 timeline, NIST PQC migration timeline, EU PQC roadmap, and benchmark migration durations by enterprise size). Add to Notes section in Quantum Assessment your reasoning.
  - Populate the top-level `quantumSecurity` block with:
    - `qtrl` object containing the computed level, name, and conditions (Must have)
    - `vectors` array with status, severity, and urgency for each of the six security vectors
    - `riskModel` object with severity and urgency level definitions
  - If quantum analysis cannot be performed, set all quantum security fields to `"Not analysed"` to maintain backward compatibility

Output the complete CBOM as valid JSON that can be directly uploaded to CBOMkit.
```

## Short Version (Quick Reference)

```
Generate a CBOM JSON file compatible with CBOMkit platform. The file must follow CycloneDX 1.6 format with:

**Required top-level:**
- bomFormat: "CycloneDX"
- specVersion: "1.6"  
- serialNumber: "urn:uuid:..." (generate UUID)
- version: 1
- metadata: { timestamp, properties: [{name: "gitUrl", value: "..."}, {name: "revision", value: "..."}, {name: "commit", value: "..."}] }
- components: [] (array of cryptographic assets)
- dependencies: []

**Each component must have:**
- type: "cryptographic-asset"
- bom-ref: UUID
- name: Algorithm name
- evidence: { occurrences: [{location, line, offset, additionalContext}] }
- cryptoProperties: { assetType: "algorithm", algorithmProperties: { primitive: "hash"|"signature"|"key-agree"|"pke"|"symmetric"|"other", parameterSetIdentifier, cryptoFunctions: [], curve (optional), oid (optional) } }

Scan this codebase and output complete valid JSON that CBOMkit can read.
```

## Key Requirements Summary

1. **Mandatory Fields:**
   - `bomFormat`: "CycloneDX"
   - `specVersion`: "1.6"
   - `serialNumber`: "urn:uuid:..." (valid UUID)
   - `version`: 1
   - `components`: array (can be empty)
   - `dependencies`: array (can be empty)

2. **Component Requirements:**
   - `type`: Must be `"cryptographic-asset"` (other types are ignored by CBOMkit)
   - `bom-ref`: Unique UUID for each component
   - `name`: Algorithm or material name
   - `cryptoProperties`: **Required** for cryptographic-asset components
   - `evidence`: Optional but recommended for traceability

3. **Primitive Types:**
   - `hash` - Hash functions
   - `signature` - Digital signatures
   - `key-agree` - Key agreement
   - `pke` - Public key encryption
   - `kem` - Key encapsulation mechanisms
   - `symmetric` - Symmetric encryption
   - `other` - Other cryptographic primitives

4. **Evidence Structure:**
   - `evidence.occurrences` is an array
   - Each occurrence should have: `location`, `line`, `offset`
   - `additionalContext` is optional but helpful

5. **Format Requirements:**
   - Valid JSON
   - ISO 8601 timestamps (e.g., `2025-02-26T09:01:57Z`)
   - Standard UUID format for `bom-ref` fields

## Usage

Copy the full prompt above and paste it into Cursor (or your AI assistant) when you want to generate a CBOM file from a codebase. The AI will scan the code, detect cryptographic usage, and output a complete CBOM JSON file that can be directly uploaded to CBOMkit.

## Reference

- CBOMkit Repository: https://github.com/cbomkit/cbomkit
- CycloneDX Specification: https://cyclonedx.org/
- Example CBOM files: See `example/` directory in this repository

