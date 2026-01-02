import {ErrorStatus, model} from "@/model.js";

export const NOT_ANALYSED_TEXT = "Not analysed";
const QUANTUM_VECTOR_DEFINITIONS = [
  { id: "hndl", name: "HNDL", fullName: "Harvest-now-decrypt-later threat", description: "Analyses storage exposure in data at rest, traffic analysis exposure, and long-term data retention policies." },
  { id: "authentication", name: "Authentication", fullName: "Authentication threat", description: "Analyses digital signatures, certificate management, and multi-factor authentication." },
  { id: "kml", name: "KML", fullName: "Key management and lifecycle", description: "Analyses quantum robustness of key storage, rotation, destruction, and escrow policies." },
  { id: "thirdParty", name: "Third Party", fullName: "Dependency on third parties", description: "Analyses vendor quantum readiness, library dependencies, API security, and supply chain risks." },
  { id: "cryptoAgility", name: "Crypto Agility", fullName: "Cryptographic agility", description: "Analyses cryptographic abstraction layers, protocol flexibility, update mechanisms, and hybrid algorithms." },
  { id: "governance", name: "Compliance", fullName: "Governance and compliance", description: "Analyses compliance with NIST, CNSA 2.0, ETSI, ISO/IEC standards and breach detection processes." },
];

// This function partially checks the CBOM properties that are necessary for the frontend, but does not formally verifies the validity of the CBOM format
function checkCbomValidity(cbom) {
  var isValid = true;
  var isIgnoringSomeComponent = false;
  var errorMessages = [];

  if (cbom === undefined || cbom == null) {
    isValid = false;
    errorMessages.push("CBOM is undefined or null.");
  } else {
    if (!Object.hasOwn(cbom, "bomFormat")) {
      isValid = false;
      errorMessages.push("Missing mandatory field: bomFormat.");
    }
    if (!Object.hasOwn(cbom, "specVersion")) {
      isValid = false;
      errorMessages.push("Missing mandatory field: specVersion.");
    }
    if (!Object.hasOwn(cbom, "serialNumber")) {
      isValid = false;
      errorMessages.push("Missing mandatory field: serialNumber.");
    }
    if (!Object.hasOwn(cbom, "version")) {
      isValid = false;
      errorMessages.push("Missing mandatory field: version.");
    }
    if (!Object.hasOwn(cbom, "components")) {
      // We can have a valid CBOM with no components
      return;
    } else if (!Array.isArray(cbom.components)) {
      isValid = false;
      errorMessages.push("Components field is not an array.");
    } else {
      cbom.components.forEach(function (component, index) {
        if (!Object.hasOwn(component, "type")) {
          isValid = false;
          errorMessages.push(`Component at index ${index} is missing mandatory field: type.`);
        } else {
          if (component.type !== "cryptographic-asset") {
            isIgnoringSomeComponent = true
            console.warn(`Ignoring CBOM component at index ${index} of type: ${component.type}`)
          } else {
            if (!Object.hasOwn(component, "cryptoProperties")) {
              isValid = false;
              errorMessages.push(`Component at index ${index} is missing mandatory field: cryptoProperties.`);
            }
            // if (!Object.hasOwn(component, "evidence")) {
            //   isValid = false;
            //   errorMessages.push(`Component at index ${index} is missing mandatory field: evidence.`);
            // } else if (!Object.hasOwn(component.evidence, "occurrences")) {
            //   isValid = false;
            //   errorMessages.push(`Component at index ${index} is missing mandatory field: evidence.occurrences.`);
            // } else if (!Array.isArray(component.evidence.occurrences)) {
            //   isValid = false;
            //   errorMessages.push(`evidence.occurrences for component at index ${index} is not an array.`);
            // }
          }
        }
      });
    }
  }

  if (isIgnoringSomeComponent) {
    model.addError(ErrorStatus.IgnoredComponent);
  }
  if (!isValid) {
    console.error(`Invalid CBOM detected. ${errorMessages.length} errors:\n   - ${errorMessages.join("\n   - ")}`);
    model.addError(ErrorStatus.InvalidCbom);
  }
}

export function resolvePath(obj, path) {
  const pathParts = path.split('.');

  function traverse(currentObj, remainingPath) {
      if (remainingPath.length === 0) {
          // Base case: if we have reached the last part of the path.
          // Always return an array, except when `undefined`
          return currentObj !== undefined && !Array.isArray(currentObj) ? [currentObj] : currentObj;
      }

      const key = remainingPath[0];  // current path part
      const nextPath = remainingPath.slice(1);  // remaining path after the current key

      if (Array.isArray(currentObj)) {
          // If the current object is an array, we need to traverse each element in the array
          return currentObj
                .map(item => traverse(item, remainingPath))  // Recursively process each item
                .filter(item => item !== undefined)          // Filter out undefined results
                .flat();      
      }

      if (typeof currentObj === 'object' && currentObj !== null && Object.hasOwn(currentObj, key)) {
          // If the current object has the required key, continue traversing
          return traverse(currentObj[key], nextPath);
      }

      // If we can't find the key in the current object, return undefined
      return undefined;
  }

  return traverse(obj, pathParts);
}


function setDependenciesMap(cbom) {
  const dependsMap = new Map();
  const isDependedOnMap = new Map();
  const providesMap = new Map();
  const isProvidedByMap = new Map();
  const detectionsMap = new Map(); /* bom-ref -> component */

  /* Dependencies defined at the top level */
  if (Object.hasOwn(cbom, "dependencies") && Array.isArray(cbom.dependencies)) {
    for (const dep of cbom.dependencies) {
      if (Object.hasOwn(dep, "ref")) {
        let bomRef = dep.ref;

        // dependsOn
        if (Object.hasOwn(dep, "dependsOn") && Array.isArray(dep.dependsOn)) {
          for (const dependsOnRef of dep.dependsOn) {
            if (!dependsMap.has(bomRef)) {
              dependsMap.set(bomRef, []);
            }
            // Add a pair [ref, path]
            dependsMap.get(bomRef).push([dependsOnRef, "dependencies.dependsOn"]);

            if (!isDependedOnMap.has(dependsOnRef)) {
              isDependedOnMap.set(dependsOnRef, []);
            }
            // Add a pair [ref, path]
            isDependedOnMap.get(dependsOnRef).push([bomRef, "dependencies.dependsOn"]);
          }
        }

        // provides
        if (Object.hasOwn(dep, "provides") && Array.isArray(dep.provides)) {
          for (const providesRef of dep.provides) {
            if (!providesMap.has(bomRef)) {
              providesMap.set(bomRef, []);
            }
            // Add a pair [ref, path]
            providesMap.get(bomRef).push([providesRef, "dependencies.provides"]);

            if (!isProvidedByMap.has(providesRef)) {
              isProvidedByMap.set(providesRef, []);
            }
            // Add a pair [ref, path]
            isProvidedByMap.get(providesRef).push([bomRef, "dependencies.provides"]);
          }
        }
      }
    }
  }

  /* Dependencies defined in components */
  for (const detection of getDetections()) {
    if (Object.hasOwn(detection, "bom-ref")) {
      let bomRef = detection["bom-ref"];

      /* Building the map of detections */
      detectionsMap.set(bomRef, detection);

      /* Adding additional dependencies */
      let dependencyPaths = [
        "cryptoProperties.certificateProperties.signatureAlgorithmRef",
        "cryptoProperties.certificateProperties.subjectPublicKeyRef",
        "cryptoProperties.protocolProperties.cipherSuites.algorithms",
        "cryptoProperties.protocolProperties.ikev2TransformTypes.encr",
        "cryptoProperties.protocolProperties.ikev2TransformTypes.prf",
        "cryptoProperties.protocolProperties.ikev2TransformTypes.integ",
        "cryptoProperties.protocolProperties.ikev2TransformTypes.ke",
        "cryptoProperties.protocolProperties.ikev2TransformTypes.esn",
        "cryptoProperties.protocolProperties.ikev2TransformTypes.auth",
        "cryptoProperties.protocolProperties.cryptoRefArray",
        "cryptoProperties.relatedCryptoMaterialProperties.algorithmRef",
        "cryptoProperties.relatedCryptoMaterialProperties.securedBy.algorithmRef"
      ]

      for (const path of dependencyPaths) {
        const allRefs = resolvePath(detection, path);
        if (allRefs !== undefined) {
          for (const ref of allRefs) {
            if (!dependsMap.has(bomRef)) {
              dependsMap.set(bomRef, []);
            }
            // Add a pair [ref, path]
            dependsMap.get(bomRef).push([ref, path]);

            if (!isDependedOnMap.has(ref)) {
              isDependedOnMap.set(ref, []);
            }
            // Add a pair [ref, path]
            isDependedOnMap.get(ref).push([bomRef, path]);
          }
        }
      }
    }
  }

  model.dependencies = { dependsMap, isDependedOnMap, providesMap, isProvidedByMap, detectionsMap };
}

export function getDependencies(bomRef) {
  const dependsMap = model.dependencies["dependsMap"];
  const isDependedOnMap = model.dependencies["isDependedOnMap"];
  const providesMap = model.dependencies["providesMap"];
  const isProvidedByMap = model.dependencies["isProvidedByMap"];
  const detectionsMap = model.dependencies["detectionsMap"];
  var dependsComponentList = [];
  var isDependedOnComponentList = [];
  var providesComponentList = [];
  var isProvidedByComponentList = [];

  const dependsRefPathList = dependsMap.get(bomRef) || [];
  const isDependedOnRefPathList = isDependedOnMap.get(bomRef) || [];
  const providesRefPathList = providesMap.get(bomRef) || [];
  const isProvidedByRefPathList = isProvidedByMap.get(bomRef) || [];

  for (const refPath of dependsRefPathList) {
    let ref = refPath[0]
    let path = refPath[1]
    if (detectionsMap.has(ref)) {
      // Add a pair [component, path]
      dependsComponentList.push([detectionsMap.get(ref), path]);
    }
  }
  for (const refPath of isDependedOnRefPathList) {
    let ref = refPath[0]
    let path = refPath[1]
    if (detectionsMap.has(ref)) {
      // Add a pair [component, path]
      isDependedOnComponentList.push([detectionsMap.get(ref), path]);
    }
  }
  for (const refPath of providesRefPathList) {
    let ref = refPath[0]
    let path = refPath[1]
    if (detectionsMap.has(ref)) {
      // Add a pair [component, path]
      providesComponentList.push([detectionsMap.get(ref), path]);
    }
  }
  for (const refPath of isProvidedByRefPathList) {
    let ref = refPath[0]
    let path = refPath[1]
    if (detectionsMap.has(ref)) {
      // Add a pair [component, path]
      isProvidedByComponentList.push([detectionsMap.get(ref), path]);
    }
  }

  return { dependsComponentList, isDependedOnComponentList, providesComponentList, isProvidedByComponentList };
}


export function setCbom(cbom) {
  checkCbomValidity(cbom);
  model.cbom = cbom;

  if (Object.hasOwn(cbom, "metadata")) {
    if (Object.hasOwn(cbom.metadata, "properties") && Array.isArray(cbom.metadata.properties)) {
      cbom.metadata.properties.forEach(function (prop) {
        if (Object.hasOwn(prop, "name") && Object.hasOwn(prop, "value")) {
          switch (prop.name) {
            case "gitUrl":
              model.codeOrigin.gitUrl = prop.value;
              break;
            case "revision":
              model.codeOrigin.revision = prop.value;
              break;
            case "subfolder":
              model.codeOrigin.subfolder = prop.value
              break;
            case "commit":
              model.codeOrigin.commitID = prop.value
          }
        }
      });
    }
  }
}

export function showResultFromApi(cbomApi) {
  let cbom = getCbomFromScan(cbomApi);
  setCbom(cbom);
  setDependenciesMap(cbom)
  model.codeOrigin.projectIdentifier = cbomApi.projectIdentifier
  model.codeOrigin.gitUrl = cbomApi.gitUrl;
  model.codeOrigin.revision = cbomApi.branch;
  model.showResults = true;
}

export function showResultFromUpload(cbom, name) {
  setCbom(cbom);
  setDependenciesMap(cbom)
  model.codeOrigin.uploadedFileName = name;
  model.showResults = true;
}

// Takes a Scan object as returned by the API and returns the CBOM as an Object.
export function getCbomFromScan(scan) {
  if (scan && scan.bom) {
    return scan.bom
  }
  console.error("Error fetching latest CBOM");
  model.addError(ErrorStatus.InvalidCbom);
  return JSON.parse("{}");

}

export function getDetections() {
  var detections = getDetectionsFromCbom(model.cbom);
  if (model.scanning.isScanning) {
    detections = model.scanning.liveDetections;
  }
  return removeBomRefFromDetectionNames(detections); 
}

function removeBomRefFromDetectionNames(detections) {
  // Some detections have a name "actual-name@xxx-xxx-xxx", containing their bomRef
  // We remove this bomRef from a cleaner visualization
  detections.forEach(function (detection) {
    if (Object.hasOwn(detection, "name") && detection.name.includes("@")) {
      detection.name = detection.name.split('@')[0]
    }
  })
  return detections
}

// Takes a CBOM Object and returns an array of detections
export function getDetectionsFromCbom(cbom) {
  // No invalid CBOM error handling occurs in this method because it is used to display reactive information, which could result in an infinite loop of errors
  try {
    if (cbom === undefined || cbom === null) {
      return [];
    }
    if (Object.hasOwn(cbom, "components") && Array.isArray(cbom.components)) {
      var detections = [];
      // In a CBOM, each component can be detected in several contexts.
      // To display them, we 'unwrap' all contexts and return a list of detections where each component appears with a single context.
      cbom.components.forEach(function (component) {
        if (Object.hasOwn(component, "type") && component.type === "cryptographic-asset") {
          if (
              Object.hasOwn(component, "evidence") &&
              Object.hasOwn(component.evidence, "occurrences") &&
              Array.isArray(component.evidence.occurrences)
          ) {
            component.evidence.occurrences.forEach(function (
              singleContext
            ) {
              let detectionWithSingleContext = JSON.parse(
                JSON.stringify(component)
              );
              detectionWithSingleContext.evidence.occurrences = [
                singleContext,
              ];
              detections.push(detectionWithSingleContext);
            });
          } else {
            // The component has no occurence
            detections.push(component);
          }
        }
      });
      return detections;
    } else {
      return []; // The "components" array is either missing or not an array.
    }
  } catch (error) {
    console.error("Error parsing JSON:", error);
    model.addError(ErrorStatus.JsonParsing);
    return []; // An error occurred while parsing the JSON string.
  }
}

export function getQuantumSecurity(cbom = model.cbom) {
  return getQuantumSecurityFromCbom(cbom);
}

export function getQuantumSecurityFromCbom(cbom) {
  if (!cbom || typeof cbom !== "object") {
    return defaultQuantumSecurity();
  }

  const quantum = cbom.quantumSecurity;
  if (!quantum || typeof quantum !== "object") {
    return defaultQuantumSecurity();
  }

  const base = defaultQuantumSecurity();
  const normalizedQtrl = normalizeQtrl(quantum.qtrl, base.qtrl);
  const normalizedVectors = normalizeVectors(quantum.vectors, base.vectors);
  const normalizedRiskModel = normalizeRiskModel(quantum.riskModel, base.riskModel);

  return {
    qtrl: normalizedQtrl,
    vectors: normalizedVectors,
    riskModel: normalizedRiskModel,
  };
}

function defaultQuantumSecurity() {
  return {
    qtrl: {
      level: NOT_ANALYSED_TEXT,
      name: NOT_ANALYSED_TEXT,
      conditions: NOT_ANALYSED_TEXT,
    },
    vectors: QUANTUM_VECTOR_DEFINITIONS.map((def) => ({
      ...def,
      status: NOT_ANALYSED_TEXT,
      severity: NOT_ANALYSED_TEXT,
      urgency: NOT_ANALYSED_TEXT,
      notes: NOT_ANALYSED_TEXT,
    })),
    riskModel: {
      severityLevels: ["critical", "high", "medium", "low", "informational"],
      urgencyLevels: ["critical", "high", "medium", "low", "informational"],
      notes: NOT_ANALYSED_TEXT,
    },
  };
}

function normalizeQtrl(candidate, fallback) {
  if (!candidate || typeof candidate !== "object") {
    return fallback;
  }
  return {
    level: candidate.level ?? fallback.level,
    name: candidate.name ?? fallback.name,
    conditions: candidate.conditions ?? fallback.conditions,
  };
}

function normalizeVectors(candidateVectors, fallbackVectors) {
  const merged = new Map(fallbackVectors.map((vector) => [vector.id, { ...vector }]));

  if (Array.isArray(candidateVectors)) {
    candidateVectors.forEach((vector) => {
      if (!vector || typeof vector !== "object") {
        return;
      }
      const id = vector.id ?? vector.name ?? `vector-${merged.size + 1}`;
      const base = merged.get(id) ?? {
        id: id,
        name: vector.name ?? id,
        status: NOT_ANALYSED_TEXT,
        severity: NOT_ANALYSED_TEXT,
        urgency: NOT_ANALYSED_TEXT,
        notes: NOT_ANALYSED_TEXT,
      };
      merged.set(id, {
        ...base,
        name: vector.name ?? base.name,
        status: vector.status ?? base.status,
        severity: vector.severity ?? base.severity,
        urgency: vector.urgency ?? base.urgency,
        notes: vector.notes ?? base.notes,
      });
    });
  }

  return Array.from(merged.values());
}

function normalizeRiskModel(candidate, fallback) {
  if (!candidate || typeof candidate !== "object") {
    return fallback;
  }
  return {
    severityLevels: Array.isArray(candidate.severityLevels)
      ? candidate.severityLevels
      : fallback.severityLevels,
    urgencyLevels: Array.isArray(candidate.urgencyLevels)
      ? candidate.urgencyLevels
      : fallback.urgencyLevels,
    notes: candidate.notes ?? fallback.notes,
  };
}

/**
 * Returns the quantum assessment for a single crypto component.
 * Extracts from cryptoProperties.quantumAssessment with fallback defaults.
 * @param {Object} asset - A cryptographic asset component
 * @returns {Object} { vector, severity, urgency, notes, vectorName }
 */
export function getComponentQuantumAssessment(asset) {
  const defaultAssessment = {
    vector: NOT_ANALYSED_TEXT,
    severity: NOT_ANALYSED_TEXT,
    urgency: NOT_ANALYSED_TEXT,
    notes: NOT_ANALYSED_TEXT,
    vectorName: NOT_ANALYSED_TEXT,
  };

  if (!asset || typeof asset !== "object") {
    return defaultAssessment;
  }

  const cryptoProps = asset.cryptoProperties;
  if (!cryptoProps || typeof cryptoProps !== "object") {
    return defaultAssessment;
  }

  const qa = cryptoProps.quantumAssessment;
  if (!qa || typeof qa !== "object") {
    return defaultAssessment;
  }

  const vectorId = qa.vector ?? NOT_ANALYSED_TEXT;
  const vectorDef = QUANTUM_VECTOR_DEFINITIONS.find((v) => v.id === vectorId);
  const vectorName = vectorDef ? vectorDef.name : vectorId;

  return {
    vector: vectorId,
    severity: qa.severity ?? NOT_ANALYSED_TEXT,
    urgency: qa.urgency ?? NOT_ANALYSED_TEXT,
    notes: qa.notes ?? NOT_ANALYSED_TEXT,
    vectorName: vectorName,
  };
}

/**
 * Returns the vector definitions for display purposes.
 * @returns {Array} Array of { id, name, fullName, description } objects
 */
export function getQuantumVectorDefinitions() {
  return QUANTUM_VECTOR_DEFINITIONS;
}

/**
 * Returns the description for a specific vector by ID.
 * @param {string} id - The vector ID (e.g., "hndl", "authentication")
 * @returns {string} The vector description or empty string if not found
 */
export function getVectorDescription(id) {
  const vector = QUANTUM_VECTOR_DEFINITIONS.find(v => v.id === id);
  return vector ? vector.description : "";
}

/**
 * Returns the full name for a specific vector by ID.
 * @param {string} id - The vector ID
 * @returns {string} The vector full name or empty string if not found
 */
export function getVectorFullName(id) {
  const vector = QUANTUM_VECTOR_DEFINITIONS.find(v => v.id === id);
  return vector ? vector.fullName : "";
}
