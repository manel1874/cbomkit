import jsPDF from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { model } from "@/model.js";
import {
  getDetections,
  getQuantumSecurity,
  hasValidComplianceResults,
  getComplianceRepartition,
  getComplianceDescription,
  getComplianceFindingsWithMessage,
  getCompliancePolicyName,
  getComplianceObjectFromId,
  getComplianceLevels,
  countOccurrences,
  countNames,
  capitalizeFirstLetter,
  getTermFullName,
  numberFormatter,
  formatSeconds,
  resolvePath,
  getComponentQuantumAssessment,
  getDependencies,
  NOT_ANALYSED_TEXT,
  getQuantumVectorDefinitions
} from "@/helpers.js";

// PDF Constants
const PAGE_WIDTH = 210; // A4 width in mm
const PAGE_HEIGHT = 297; // A4 height in mm
const MARGIN = 15; // Margin in mm
const USABLE_WIDTH = PAGE_WIDTH - (MARGIN * 2); // 180mm

// Color constants (RGB 0-255)
const COLORS = {
  primary: [15, 98, 254], // IBM Blue #0f62fe
  dark: [22, 22, 22], // #161616
  gray: [82, 82, 82], // #525252
  lightGray: [244, 244, 244], // #f4f4f4
  tableHeader: [57, 57, 57], // #393939
  qtrl0: [212, 187, 255], // #d4bbff
  qtrl1: [255, 175, 210], // #ffafd2
  qtrl2: [186, 230, 255], // #bae6ff
  qtrl3: [167, 240, 186], // #a7f0ba
  critical: [212, 187, 255], // Purple
  high: [255, 175, 210], // Magenta
  medium: [186, 230, 255], // Cyan
  low: [167, 240, 186], // Green
  info: [224, 224, 224] // Gray
};

/**
 * Check if we need a new page and add it if necessary
 * Returns the Y position to use (either current Y or MARGIN if new page)
 */
function checkPageBreak(doc, currentY, requiredHeight) {
  const remainingHeight = PAGE_HEIGHT - currentY - MARGIN;
  
  if (requiredHeight > remainingHeight) {
    doc.addPage();
    return MARGIN;
  }
  return currentY;
}

/**
 * Get header data
 */
function getHeaderData() {
  let title = 'CBOM Report';
  if (model.codeOrigin.uploadedFileName) {
    title = model.codeOrigin.uploadedFileName + ' (uploaded)';
  } else if (model.codeOrigin.projectIdentifier) {
    title = model.codeOrigin.projectIdentifier;
  } else if (model.codeOrigin.scanUrl) {
    title = model.codeOrigin.scanUrl.replace('https://', '');
  }

  const tags = [];
  if (model.codeOrigin.gitUrl) {
    tags.push(`gitUrl: ${model.codeOrigin.gitUrl}`);
  }
  if (model.codeOrigin.revision) {
    tags.push(`revision: ${model.codeOrigin.revision}`);
  }
  if (model.codeOrigin.commitID) {
    const shortCommit = model.codeOrigin.commitID.substring(0, 7);
    tags.push(`commit: ${shortCommit}`);
  }
  if (model.codeOrigin.subfolder) {
    tags.push(`subfolder: ${model.codeOrigin.subfolder}`);
  }

  return { title, tags };
}

/**
 * Get summary data
 */
function getSummaryData() {
  const detections = getDetections();
  const assetCount = detections.length;
  
  let scanInfo = null;
  if (model.scanning.numberOfFiles && model.scanning.numberOfLines) {
    scanInfo = `Scanned ${numberFormatter(model.scanning.numberOfLines)} lines across ${numberFormatter(model.scanning.numberOfFiles)} files`;
  }
  
  let timeInfo = null;
  if (model.scanning.totalDuration) {
    timeInfo = `Total time: ${formatSeconds(model.scanning.totalDuration)}`;
  }

  const typesCounts = countOccurrences('primitive');
  const typesCount = typesCounts[1] || 0;

  const namesCounts = countNames();
  const uniqueNamesCount = namesCounts[1] || 0;

  return {
    assetCount,
    uniqueNamesCount,
    typesCount,
    scanInfo,
    timeInfo
  };
}

/**
 * Get statistics data
 */
function getStatisticsData() {
  const data = {
    compliance: null,
    assetTypes: [],
    primitives: [],
    functions: []
  };

  if (hasValidComplianceResults()) {
    const repartition = getComplianceRepartition();
    const levels = getComplianceLevels();
    const labelsMap = levels.reduce((acc, level) => {
      acc[level.id] = level;
      return acc;
    }, {});

    data.compliance = Object.entries(repartition).map(([id, count]) => ({
      label: labelsMap[id]?.label || id,
      count
    }));
  }

  const primitives = countOccurrences('primitive')[0];
  if (primitives.length > 0) {
    data.primitives = primitives.slice(0, 10).map(item => ({
      name: capitalizeFirstLetter(item.group),
      count: item.value
    }));
  }

  const functions = countOccurrences('cryptoFunctions')[0];
  if (functions.length > 0) {
    data.functions = functions.slice(0, 10).map(item => ({
      name: capitalizeFirstLetter(item.group),
      count: item.value
    }));
  }

  const names = countNames()[0];
  if (names.length > 0) {
    data.assetTypes = names.slice(0, 15).map(item => ({
      name: item.name.toUpperCase(),
      count: item.value
    }));
  }

  return data;
}

/**
 * Get quantum security data
 */
function getQuantumSecurityData() {
  const quantum = getQuantumSecurity();
  const qtrl = quantum.qtrl;
  const vectors = quantum.vectors;
  const vectorDefs = getQuantumVectorDefinitions();

  const vectorsData = vectors.map(vector => {
    const def = vectorDefs.find(d => d.id === vector.id);
    const displayName = def?.name || vector.name || vector.id || 'Unknown';
    
    return {
      name: displayName,
      status: vector.status || NOT_ANALYSED_TEXT,
      severity: vector.severity || NOT_ANALYSED_TEXT,
      urgency: vector.urgency || NOT_ANALYSED_TEXT,
      notes: vector.notes && vector.notes !== NOT_ANALYSED_TEXT ? vector.notes : null
    };
  });

  return {
    qtrl: {
      level: qtrl.level !== NOT_ANALYSED_TEXT ? qtrl.level : null,
      name: qtrl.name || '',
      conditions: qtrl.conditions && qtrl.conditions !== NOT_ANALYSED_TEXT ? qtrl.conditions : null
    },
    vectors: vectorsData
  };
}

/**
 * Get data table data
 */
function getDataTableData() {
  const detections = getDetections();
  
  return detections.map(asset => {
    const name = asset.name || 'Unknown';
    const type = getAssetType(asset);
    const primitive = getPrimitive(asset);
    const location = getLocation(asset);
    const qa = getComponentQuantumAssessment(asset);
    
    return {
      name: name.toUpperCase(),
      type: formatShortType(type),
      primitive: formatShortType(primitive),
      vector: qa.vector !== NOT_ANALYSED_TEXT ? formatShortVector(qa.vectorName) : 'N/A',
      severity: qa.severity !== NOT_ANALYSED_TEXT ? qa.severity : 'N/A',
      urgency: qa.urgency !== NOT_ANALYSED_TEXT ? qa.urgency : 'N/A',
      location: location
    };
  });
}

/**
 * Get detailed asset data for PDF
 */
function getDetailedAssetData(asset) {
  const name = asset.name || 'Unknown';
  const type = getAssetType(asset);
  
  // Code location
  const occurrences = resolvePath(asset, 'evidence.occurrences');
  let codeLocation = null;
  if (occurrences && occurrences.length > 0) {
    const occ = occurrences[0];
    const filePath = occ.location || '';
    const fileName = filePath.substring(filePath.lastIndexOf('/') + 1);
    const line = occ.line || '';
    codeLocation = line ? `${fileName}:${line}` : fileName;
  }
  
  // Compliance
  let compliance = null;
  if (hasValidComplianceResults()) {
    const description = getComplianceDescription(asset);
    const policyName = getCompliancePolicyName();
    const findings = getComplianceFindingsWithMessage(asset);
    
    if (description || findings.length > 0) {
      compliance = {
        description: description || 'Not available',
        policyName: policyName || 'Not available',
        findings: findings.map(finding => ({
          message: finding.message || '',
          category: getComplianceObjectFromId(finding.levelId)?.label || 'Unknown'
        }))
      };
    }
  }
  
  // Quantum Assessment
  const qa = getComponentQuantumAssessment(asset);
  const quantumAssessment = {
    vector: qa.vector !== NOT_ANALYSED_TEXT ? qa.vectorName : null,
    severity: qa.severity !== NOT_ANALYSED_TEXT ? qa.severity : null,
    urgency: qa.urgency !== NOT_ANALYSED_TEXT ? qa.urgency : null,
    notes: qa.notes !== NOT_ANALYSED_TEXT ? qa.notes : null
  };
  
  // Dependencies
  const bomRef = asset['bom-ref'];
  let dependencies = null;
  if (bomRef) {
    const deps = getDependencies(bomRef);
    if (deps.dependsComponentList.length > 0 || 
        deps.isDependedOnComponentList.length > 0 || 
        deps.providesComponentList.length > 0 || 
        deps.isProvidedByComponentList.length > 0) {
      dependencies = {
        dependsOn: deps.dependsComponentList.map(([depAsset, path]) => ({
          name: depAsset.name || 'Unknown',
          type: getAssetType(depAsset),
          bomRef: depAsset['bom-ref'] || '',
          source: path
        })),
        isDependedOn: deps.isDependedOnComponentList.map(([depAsset, path]) => ({
          name: depAsset.name || 'Unknown',
          type: getAssetType(depAsset),
          bomRef: depAsset['bom-ref'] || '',
          source: path
        })),
        provides: deps.providesComponentList.map(([depAsset, path]) => ({
          name: depAsset.name || 'Unknown',
          type: getAssetType(depAsset),
          bomRef: depAsset['bom-ref'] || '',
          source: path
        })),
        isProvidedBy: deps.isProvidedByComponentList.map(([depAsset, path]) => ({
          name: depAsset.name || 'Unknown',
          type: getAssetType(depAsset),
          bomRef: depAsset['bom-ref'] || '',
          source: path
        }))
      };
    }
  }
  
  // Specification properties
  const propertyPaths = [
    { name: "Asset Type", path: "cryptoProperties.assetType" },
    { name: "Primitive", path: "cryptoProperties.algorithmProperties.primitive" },
    { name: "Parameter Set Identifier", path: "cryptoProperties.algorithmProperties.parameterSetIdentifier" },
    { name: "Curve", path: "cryptoProperties.algorithmProperties.curve" },
    { name: "Execution Environment", path: "cryptoProperties.algorithmProperties.executionEnvironment" },
    { name: "Implementation Platform", path: "cryptoProperties.algorithmProperties.implementationPlatform" },
    { name: "Certification Level", path: "cryptoProperties.algorithmProperties.certificationLevel" },
    { name: "Mode", path: "cryptoProperties.algorithmProperties.mode" },
    { name: "Padding", path: "cryptoProperties.algorithmProperties.padding" },
    { name: "Crypto Functions", path: "cryptoProperties.algorithmProperties.cryptoFunctions" },
    { name: "Classical Security Level", path: "cryptoProperties.algorithmProperties.classicalSecurityLevel" },
    { name: "NIST Quantum Security Level", path: "cryptoProperties.algorithmProperties.nistQuantumSecurityLevel" },
    { name: "Subject Name", path: "cryptoProperties.certificateProperties.subjectName" },
    { name: "Issuer Name", path: "cryptoProperties.certificateProperties.issuerName" },
    { name: "Not Valid Before", path: "cryptoProperties.certificateProperties.notValidBefore" },
    { name: "Not Valid After", path: "cryptoProperties.certificateProperties.notValidAfter" },
    { name: "Signature Algorithm Reference", path: "cryptoProperties.certificateProperties.signatureAlgorithmRef" },
    { name: "Subject Public Key Reference", path: "cryptoProperties.certificateProperties.subjectPublicKeyRef" },
    { name: "Certificate Format", path: "cryptoProperties.certificateProperties.certificateFormat" },
    { name: "Certificate Extension", path: "cryptoProperties.certificateProperties.certificateExtension" },
    { name: "Type", path: "cryptoProperties.relatedCryptoMaterialProperties.type" },
    { name: "ID", path: "cryptoProperties.relatedCryptoMaterialProperties.id" },
    { name: "State", path: "cryptoProperties.relatedCryptoMaterialProperties.state" },
    { name: "Algorithm Reference", path: "cryptoProperties.relatedCryptoMaterialProperties.algorithmRef" },
    { name: "Creation Date", path: "cryptoProperties.relatedCryptoMaterialProperties.creationDate" },
    { name: "Activation Date", path: "cryptoProperties.relatedCryptoMaterialProperties.activationDate" },
    { name: "Update Date", path: "cryptoProperties.relatedCryptoMaterialProperties.updateDate" },
    { name: "Expiration Date", path: "cryptoProperties.relatedCryptoMaterialProperties.expirationDate" },
    { name: "Value", path: "cryptoProperties.relatedCryptoMaterialProperties.value" },
    { name: "Size", path: "cryptoProperties.relatedCryptoMaterialProperties.size" },
    { name: "Format", path: "cryptoProperties.relatedCryptoMaterialProperties.format" },
    { name: "Secured By", path: "cryptoProperties.relatedCryptoMaterialProperties.securedBy" },
    { name: "Type", path: "cryptoProperties.protocolProperties.type" },
    { name: "Version", path: "cryptoProperties.protocolProperties.version" },
    { name: "Cipher Suites", path: "cryptoProperties.protocolProperties.cipherSuites" },
    { name: "IKEv2 Transform Types", path: "cryptoProperties.protocolProperties.ikev2TransformTypes" },
    { name: "Cryptographic References", path: "cryptoProperties.protocolProperties.cryptoRefArray" },
    { name: "OID", path: "cryptoProperties.oid" },
    { name: "BOM Reference", path: "bom-ref" }
  ];
  
  const specification = propertyPaths
    .map(property => {
      const values = resolvePath(asset, property.path);
      if (values && values.length > 0) {
        return {
          name: property.name,
          values: values.map(value => {
            const fullName = getTermFullName(value);
            return fullName || value;
          })
        };
      }
      return null;
    })
    .filter(prop => prop !== null);
  
  return {
    name: name.toUpperCase(),
    type: type,
    codeLocation: codeLocation,
    compliance: compliance,
    quantumAssessment: quantumAssessment,
    dependencies: dependencies,
    specification: specification
  };
}

/**
 * Render header section
 */
function renderHeader(doc, y) {
  const headerData = getHeaderData();
  
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.dark);
  doc.text(headerData.title, MARGIN, y);
  
  y += 8;
  
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.primary);
  doc.text('Cryptography Bill of Materials Report', MARGIN, y);
  
  if (headerData.tags.length > 0) {
    y += 6;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.gray);
    
    let x = MARGIN;
    headerData.tags.forEach((tag, index) => {
      const tagWidth = doc.getTextWidth(tag);
      if (x + tagWidth > PAGE_WIDTH - MARGIN && index > 0) {
        x = MARGIN;
        y += 5;
      }
      doc.text(tag, x, y);
      x += tagWidth + 8;
    });
    y += 5;
  }
  
  return y + 10;
}

/**
 * Render summary section
 */
function renderSummary(doc, y) {
  const summaryData = getSummaryData();
  
  y = checkPageBreak(doc, y, 40);
  
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.primary);
  doc.text('Summary', MARGIN, y);
  y += 8;
  
  // Summary boxes
  const boxWidth = USABLE_WIDTH / 3;
  const boxHeight = 20;
  let x = MARGIN;
  
  // Total Crypto Assets
  doc.setFillColor(...COLORS.lightGray);
  doc.rect(x, y, boxWidth, boxHeight, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.gray);
  doc.text('Total Crypto Assets', x + 3, y + 6);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.dark);
  doc.text(summaryData.assetCount.toString(), x + 3, y + 14);
  x += boxWidth;
  
  // Unique Asset Types
  doc.setFillColor(...COLORS.lightGray);
  doc.rect(x, y, boxWidth, boxHeight, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.gray);
  doc.text('Unique Asset Types', x + 3, y + 6);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.dark);
  doc.text(summaryData.uniqueNamesCount.toString(), x + 3, y + 14);
  x += boxWidth;
  
  // Crypto Primitives
  doc.setFillColor(...COLORS.lightGray);
  doc.rect(x, y, boxWidth, boxHeight, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.gray);
  doc.text('Crypto Primitives', x + 3, y + 6);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.dark);
  doc.text(summaryData.typesCount.toString(), x + 3, y + 14);
  
  y += boxHeight + 8;
  
  // Scan info if available
  if (summaryData.scanInfo || summaryData.timeInfo) {
    y = checkPageBreak(doc, y, 20);
    x = MARGIN;
    const infoBoxWidth = summaryData.scanInfo && summaryData.timeInfo ? USABLE_WIDTH / 2 : USABLE_WIDTH;
    
    if (summaryData.scanInfo) {
      doc.setFillColor(...COLORS.lightGray);
      doc.rect(x, y, infoBoxWidth, boxHeight, 'F');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.gray);
      doc.text('Scan Coverage', x + 3, y + 6);
      doc.setFontSize(12);
      doc.setTextColor(...COLORS.dark);
      const lines = doc.splitTextToSize(summaryData.scanInfo, infoBoxWidth - 6);
      doc.text(lines, x + 3, y + 14);
      x += infoBoxWidth;
    }
    
    if (summaryData.timeInfo) {
      doc.setFillColor(...COLORS.lightGray);
      doc.rect(x, y, infoBoxWidth, boxHeight, 'F');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.gray);
      doc.text('Scan Duration', x + 3, y + 6);
      doc.setFontSize(14);
      doc.setTextColor(...COLORS.dark);
      doc.text(summaryData.timeInfo, x + 3, y + 14);
    }
    
    y += boxHeight + 8;
  }
  
  return y;
}

/**
 * Render a stat item with label and number in a box
 */
function renderStatItem(doc, x, y, label, count) {
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.gray);
  
  // Render label
  doc.text(label, x, y);
  const labelWidth = doc.getTextWidth(label);
  
  // Calculate box dimensions for number
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  const countText = count.toString();
  const numberWidth = doc.getTextWidth(countText);
  const boxWidth = numberWidth + 6;
  const boxHeight = 5;
  const boxX = x + labelWidth + 4;
  const boxY = y - 4;
  
  // Draw box background
  doc.setFillColor(...COLORS.lightGray);
  doc.rect(boxX, boxY, boxWidth, boxHeight, 'F');
  
  // Draw number in box
  doc.setTextColor(...COLORS.dark);
  doc.text(countText, boxX + 3, y);
  
  return boxX + boxWidth + 6; // Return next X position
}

/**
 * Render statistics section
 */
function renderStatistics(doc, y) {
  const statsData = getStatisticsData();
  
  y = checkPageBreak(doc, y, 60);
  
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.primary);
  doc.text('Statistics', MARGIN, y);
  y += 10;
  
  // Compliance Distribution
  if (statsData.compliance) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.dark);
    doc.text('Compliance Distribution', MARGIN, y);
    y += 8;
    
    let x = MARGIN;
    statsData.compliance.forEach((item, index) => {
      const itemWidth = doc.getTextWidth(item.label) + doc.getTextWidth(item.count.toString()) + 20;
      if (x + itemWidth > PAGE_WIDTH - MARGIN && index > 0) {
        x = MARGIN;
        y += 8;
      }
      x = renderStatItem(doc, x, y, item.label, item.count);
    });
    y += 10;
  }
  
  // Asset Types
  if (statsData.assetTypes.length > 0) {
    y = checkPageBreak(doc, y, 20);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.dark);
    doc.text('Asset Types', MARGIN, y);
    y += 8;
    
    let x = MARGIN;
    statsData.assetTypes.forEach((item, index) => {
      const itemWidth = doc.getTextWidth(item.name) + doc.getTextWidth(item.count.toString()) + 20;
      if (x + itemWidth > PAGE_WIDTH - MARGIN && index > 0) {
        x = MARGIN;
        y += 8;
      }
      x = renderStatItem(doc, x, y, item.name, item.count);
    });
    y += 10;
  }
  
  // Cryptographic Primitives
  if (statsData.primitives.length > 0) {
    y = checkPageBreak(doc, y, 20);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.dark);
    doc.text('Cryptographic Primitives', MARGIN, y);
    y += 8;
    
    let x = MARGIN;
    statsData.primitives.forEach((item, index) => {
      const itemWidth = doc.getTextWidth(item.name) + doc.getTextWidth(item.count.toString()) + 20;
      if (x + itemWidth > PAGE_WIDTH - MARGIN && index > 0) {
        x = MARGIN;
        y += 8;
      }
      x = renderStatItem(doc, x, y, item.name, item.count);
    });
    y += 10;
  }
  
  // Cryptographic Functions
  if (statsData.functions.length > 0) {
    y = checkPageBreak(doc, y, 20);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.dark);
    doc.text('Cryptographic Functions', MARGIN, y);
    y += 8;
    
    let x = MARGIN;
    statsData.functions.forEach((item, index) => {
      const itemWidth = doc.getTextWidth(item.name) + doc.getTextWidth(item.count.toString()) + 20;
      if (x + itemWidth > PAGE_WIDTH - MARGIN && index > 0) {
        x = MARGIN;
        y += 8;
      }
      x = renderStatItem(doc, x, y, item.name, item.count);
    });
    y += 10;
  }
  
  return y;
}

/**
 * Get tag color based on level
 */
function getTagColor(level) {
  if (!level || level === NOT_ANALYSED_TEXT) return COLORS.info;
  const lower = level.toLowerCase();
  if (lower === 'critical') return COLORS.critical;
  if (lower === 'high') return COLORS.high;
  if (lower === 'medium') return COLORS.medium;
  if (lower === 'low') return COLORS.low;
  return COLORS.info;
}

/**
 * Render quantum security section
 */
function renderQuantumSecurity(doc, y) {
  const quantumData = getQuantumSecurityData();
  
  y = checkPageBreak(doc, y, 80);
  
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.primary);
  doc.text('Quantum Security Assessment', MARGIN, y);
  y += 10;
  
  // QTRL Section
  const qtrlStartY = y;
  
  // Calculate content height first
  doc.setFontSize(10);
  let qtrlContentHeight = 6; // Top padding
  qtrlContentHeight += 6; // Title line
  qtrlContentHeight += 8; // Level tag and name line
  if (quantumData.qtrl.conditions) {
    const conditionLines = doc.splitTextToSize(quantumData.qtrl.conditions, USABLE_WIDTH - 6);
    qtrlContentHeight += conditionLines.length * 5 + 3; // Conditions + spacing
  }
  qtrlContentHeight += 3; // Bottom padding
  
  // Draw background box
  doc.setFillColor(...COLORS.lightGray);
  doc.rect(MARGIN, qtrlStartY, USABLE_WIDTH, qtrlContentHeight, 'F');
  
  // Draw content
  y = qtrlStartY + 6;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.dark);
  doc.text('Quantum Transition Readiness Level (QTRL)', MARGIN + 3, y);
  
  y += 10;
  
  if (quantumData.qtrl.level !== null) {
    const qtrlLevel = `Level ${quantumData.qtrl.level}`;
    let qtrlColor = COLORS.info;
    if (quantumData.qtrl.level === 0) qtrlColor = COLORS.qtrl0;
    else if (quantumData.qtrl.level === 1) qtrlColor = COLORS.qtrl1;
    else if (quantumData.qtrl.level === 2) qtrlColor = COLORS.qtrl2;
    else if (quantumData.qtrl.level === 3) qtrlColor = COLORS.qtrl3;
    
    doc.setFillColor(...qtrlColor);
    const tagWidth = doc.getTextWidth(qtrlLevel) + 6;
    doc.rect(MARGIN + 3, y - 4, tagWidth, 6, 'F');
    doc.setTextColor(...COLORS.dark);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(qtrlLevel, MARGIN + 6, y);
    
    if (quantumData.qtrl.name) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(quantumData.qtrl.name, MARGIN + 3 + tagWidth + 5, y);
    }
  } else {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.gray);
    doc.text(NOT_ANALYSED_TEXT, MARGIN + 3, y);
  }
  
  if (quantumData.qtrl.conditions) {
    y += 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.gray);
    const conditionLines = doc.splitTextToSize(quantumData.qtrl.conditions, USABLE_WIDTH - 6);
    doc.text(conditionLines, MARGIN + 3, y);
  }
  
  y = qtrlStartY + qtrlContentHeight + 10;
  
  // Security Vectors
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.dark);
  doc.text('Security Vectors', MARGIN, y);
  y += 8;
  
  quantumData.vectors.forEach((vector) => {
    // Calculate actual card height
    let cardContentHeight = 6; // Top padding
    cardContentHeight += 8; // Name line
    cardContentHeight += 8; // Tags line
    if (vector.notes) {
      doc.setFontSize(9);
      const notesLines = doc.splitTextToSize(vector.notes, USABLE_WIDTH - 6);
      cardContentHeight += notesLines.length * 4 + 3; // Notes + spacing
    }
    cardContentHeight += 3; // Bottom padding
    
    // Check if we need a new page for this vector card
    y = checkPageBreak(doc, y, cardContentHeight);
    
    const cardStartY = y;
    
    // Vector card background
    doc.setFillColor(...COLORS.lightGray);
    doc.rect(MARGIN, y, USABLE_WIDTH, cardContentHeight, 'F');
    
    // Vector name and status
    y += 6;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.dark);
    doc.text(vector.name, MARGIN + 3, y);
    
    if (vector.status && vector.status !== NOT_ANALYSED_TEXT) {
      const statusText = vector.status;
      doc.setFontSize(8);
      const statusWidth = doc.getTextWidth(statusText) + 6;
      const statusColor = vector.status.toLowerCase() === 'vulnerable' ? COLORS.critical : COLORS.info;
      doc.setFillColor(...statusColor);
      doc.rect(MARGIN + USABLE_WIDTH - statusWidth - 3, cardStartY + 1, statusWidth, 5, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.dark);
      doc.text(statusText, MARGIN + USABLE_WIDTH - statusWidth, cardStartY + 4);
    }
    
    y += 10;
    
    // Severity and Urgency tags
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    let x = MARGIN + 3;
    
    if (vector.severity && vector.severity !== NOT_ANALYSED_TEXT) {
      const severityText = `Severity: ${vector.severity}`;
      const severityColor = getTagColor(vector.severity);
      const tagWidth = doc.getTextWidth(severityText) + 6;
      doc.setFillColor(...severityColor);
      doc.rect(x, y - 4, tagWidth, 5, 'F');
      doc.setTextColor(...COLORS.dark);
      doc.text(severityText, x + 3, y);
      x += tagWidth + 6;
    }
    
    if (vector.urgency && vector.urgency !== NOT_ANALYSED_TEXT) {
      const urgencyText = `Urgency: ${vector.urgency}`;
      const urgencyColor = getTagColor(vector.urgency);
      const tagWidth = doc.getTextWidth(urgencyText) + 6;
      doc.setFillColor(...urgencyColor);
      doc.rect(x, y - 4, tagWidth, 5, 'F');
      doc.setTextColor(...COLORS.dark);
      doc.text(urgencyText, x + 3, y);
    }
    
    if (vector.notes) {
      y += 10;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.gray);
      const notesLines = doc.splitTextToSize(vector.notes, USABLE_WIDTH - 6);
      doc.text(notesLines, MARGIN + 3, y);
    }
    
    // Update Y to end of card
    y = cardStartY + cardContentHeight + 8;
  });
  
  return y;
}

/**
 * Render data table using jspdf-autotable
 */
function renderDataTable(doc, y) {
  const tableData = getDataTableData();
  
  // Check page break and add new page if needed for table
  y = checkPageBreak(doc, y, 30);
  
  if (tableData.length === 0) {
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.primary);
    doc.text('Cryptographic Assets', MARGIN, y);
    y += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.gray);
    doc.text('No cryptographic assets found.', MARGIN, y);
    return y + 10;
  }
  
  // Render section title
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.primary);
  doc.text(`Cryptographic Assets (${tableData.length} total)`, MARGIN, y);
  y += 10;
  
  // Prepare table data
  const tableRows = tableData.map(row => [
    row.name,
    row.type,
    row.primitive,
    row.vector,
    row.severity,
    row.urgency,
    row.location
  ]);
  
  doc.autoTable({
    startY: y,
    head: [['Asset', 'Type', 'Primitive', 'Vector', 'Severity', 'Urgency', 'Location']],
    body: tableRows,
    theme: 'striped',
    headStyles: {
      fillColor: COLORS.tableHeader,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8
    },
    bodyStyles: {
      fontSize: 8,
      textColor: COLORS.dark
    },
    columnStyles: {
      0: { cellWidth: 32, fontStyle: 'bold' }, // Asset
      1: { cellWidth: 22 }, // Type
      2: { cellWidth: 22 }, // Primitive
      3: { cellWidth: 22 }, // Vector
      4: { cellWidth: 18 }, // Severity
      5: { cellWidth: 18 }, // Urgency
      6: { cellWidth: 46, fontSize: 7 } // Location
    },
    margin: { left: MARGIN, right: MARGIN },
    styles: {
      cellPadding: 2,
      overflow: 'linebreak',
      cellWidth: 'wrap'
    },
    didParseCell: (data) => {
     
      // Apply colors to Severity column (index 4) - body rows only
      if (data.column.index === 4 && data.section === 'body' && data.row.index >= 0) {
        const severity = data.cell.text[0] || '';
        const severityLower = severity.toLowerCase();
        let fillColor = null;
        
        if (severityLower === 'critical') {
          fillColor = COLORS.critical; // purple
        } else if (severityLower === 'high') {
          fillColor = COLORS.high; // pink
        } else if (severityLower === 'medium') {
          fillColor = COLORS.medium; // blue
        } else if (severityLower === 'low') {
          fillColor = COLORS.low; // green
        }
        // If N/A or unrecognized, don't set fillColor - let striped theme handle it
        
        if (fillColor) {
          data.cell.styles.fillColor = fillColor;
        }
        // Always use black text for values (low, medium, high, critical)
        data.cell.styles.textColor = COLORS.dark;
        data.cell.styles.fontStyle = 'bold';
      }
      
      // Apply colors to Urgency column (index 5) - body rows only
      if (data.column.index === 5 && data.section === 'body' && data.row.index >= 0) {
        const urgency = data.cell.text[0] || '';
        const urgencyLower = urgency.toLowerCase();
        let fillColor = null;
        
        if (urgencyLower === 'critical') {
          fillColor = COLORS.critical; // purple
        } else if (urgencyLower === 'high') {
          fillColor = COLORS.high; // pink
        } else if (urgencyLower === 'medium') {
          fillColor = COLORS.medium; // blue
        } else if (urgencyLower === 'low') {
          fillColor = COLORS.low; // green
        }
        // If N/A or unrecognized, don't set fillColor - let striped theme handle it
        
        if (fillColor) {
          data.cell.styles.fillColor = fillColor;
        }
        // Always use black text for values (low, medium, high, critical)
        data.cell.styles.textColor = COLORS.dark;
        data.cell.styles.fontStyle = 'bold';
      }
    }
  });
  
  // Get final Y position after table
  const finalY = doc.lastAutoTable.finalY;
  return finalY + 10;
}

/**
 * Render footer on current page
 */
function renderFooter(doc) {
  const pageCount = doc.internal.getNumberOfPages();
  
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.gray);
    
    const footerY = PAGE_HEIGHT - MARGIN + 5;
    doc.text('Tectonic Labs', PAGE_WIDTH / 2, footerY, { align: 'center' });
  }
}

/**
 * Render code location information
 */
function renderCodeLocation(doc, y, codeLocation) {
  if (!codeLocation) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.gray);
    const message = 'No code location has been specified in the CBOM for this cryptographic asset.';
    const lines = doc.splitTextToSize(message, USABLE_WIDTH - 6);
    doc.text(lines, MARGIN + 3, y);
    return y + lines.length * 5 + 5;
  }
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.dark);
  doc.text(codeLocation, MARGIN + 3, y);
  return y + 6;
}

/**
 * Render compliance information
 */
function renderCompliance(doc, y, compliance) {
  if (!compliance) return y;
  
  y = checkPageBreak(doc, y, 30);
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.dark);
  doc.text('Compliance', MARGIN, y);
  y += 8;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.dark);
  doc.text(compliance.description, MARGIN + 3, y);
  y += 6;
  
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.gray);
  doc.text(`Policy: ${compliance.policyName}`, MARGIN + 3, y);
  y += 8;
  
  if (compliance.findings.length > 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.dark);
    doc.text('Compliance Findings', MARGIN + 3, y);
    y += 6;
    
    compliance.findings.forEach(finding => {
      y = checkPageBreak(doc, y, 15);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.dark);
      const messageLines = doc.splitTextToSize(finding.message, USABLE_WIDTH - 6);
      doc.text(messageLines, MARGIN + 6, y);
      y += messageLines.length * 4;
      
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.gray);
      doc.text(`Category: ${finding.category}`, MARGIN + 6, y);
      y += 6;
    });
  }
  
  return y + 5;
}

/**
 * Render quantum assessment for individual asset
 */
function renderQuantumAssessment(doc, y, qa) {
  y = checkPageBreak(doc, y, 40);
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.dark);
  doc.text('Quantum Assessment', MARGIN, y);
  y += 8;
  
  // Security Vector
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.gray);
  doc.text('Security Vector:', MARGIN + 3, y);
  if (qa.vector) {
    doc.setTextColor(...COLORS.dark);
    doc.text(qa.vector, MARGIN + 50, y);
  } else {
    doc.setTextColor(...COLORS.gray);
    doc.text(NOT_ANALYSED_TEXT, MARGIN + 50, y);
  }
  y += 6;
  
  // Severity
  doc.setTextColor(...COLORS.gray);
  doc.text('Severity:', MARGIN + 3, y);
  if (qa.severity) {
    const severityColor = getTagColor(qa.severity);
    const tagWidth = doc.getTextWidth(qa.severity) + 6;
    doc.setFillColor(...severityColor);
    doc.rect(MARGIN + 50, y - 4, tagWidth, 5, 'F');
    doc.setTextColor(...COLORS.dark);
    doc.text(qa.severity, MARGIN + 53, y);
  } else {
    doc.setTextColor(...COLORS.gray);
    doc.text(NOT_ANALYSED_TEXT, MARGIN + 50, y);
  }
  y += 6;
  
  // Urgency
  doc.setTextColor(...COLORS.gray);
  doc.text('Urgency:', MARGIN + 3, y);
  if (qa.urgency) {
    const urgencyColor = getTagColor(qa.urgency);
    const tagWidth = doc.getTextWidth(qa.urgency) + 6;
    doc.setFillColor(...urgencyColor);
    doc.rect(MARGIN + 50, y - 4, tagWidth, 5, 'F');
    doc.setTextColor(...COLORS.dark);
    doc.text(qa.urgency, MARGIN + 53, y);
  } else {
    doc.setTextColor(...COLORS.gray);
    doc.text(NOT_ANALYSED_TEXT, MARGIN + 50, y);
  }
  y += 6;
  
  // Notes
  if (qa.notes) {
    y += 3;
    doc.setTextColor(...COLORS.gray);
    doc.text('Notes:', MARGIN + 3, y);
    y += 5;
    doc.setFontSize(9);
    const notesLines = doc.splitTextToSize(qa.notes, USABLE_WIDTH - 6);
    doc.text(notesLines, MARGIN + 3, y);
    y += notesLines.length * 4;
  }
  
  return y + 5;
}

/**
 * Render dependencies
 */
function renderDependencies(doc, y, dependencies) {
  if (!dependencies) return y;
  
  let hasAnyDeps = dependencies.dependsOn.length > 0 || 
                   dependencies.isDependedOn.length > 0 || 
                   dependencies.provides.length > 0 || 
                   dependencies.isProvidedBy.length > 0;
  
  if (!hasAnyDeps) return y;
  
  y = checkPageBreak(doc, y, 30);
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.dark);
  doc.text('Dependencies', MARGIN, y);
  y += 8;
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  
  // Depends on
  if (dependencies.dependsOn.length > 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.dark);
    doc.text('Depends on', MARGIN + 3, y);
    y += 6;
    
    dependencies.dependsOn.forEach(dep => {
      y = checkPageBreak(doc, y, 12);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.dark);
      doc.text(`${dep.name.toUpperCase()} — ${dep.type}`, MARGIN + 6, y);
      y += 5;
      if (dep.bomRef) {
        doc.setFontSize(8);
        doc.setTextColor(...COLORS.gray);
        doc.text(`BOM Reference: ${dep.bomRef}`, MARGIN + 6, y);
        y += 4;
      }
      if (dep.source) {
        doc.text(`Source: ${dep.source}`, MARGIN + 6, y);
        y += 4;
      }
      y += 2;
    });
  }
  
  // Provides to
  if (dependencies.provides.length > 0) {
    y += 3;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.dark);
    doc.text('Provides to', MARGIN + 3, y);
    y += 6;
    
    dependencies.provides.forEach(dep => {
      y = checkPageBreak(doc, y, 12);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.dark);
      doc.text(`${dep.name.toUpperCase()} — ${dep.type}`, MARGIN + 6, y);
      y += 5;
      if (dep.bomRef) {
        doc.setFontSize(8);
        doc.setTextColor(...COLORS.gray);
        doc.text(`BOM Reference: ${dep.bomRef}`, MARGIN + 6, y);
        y += 4;
      }
      if (dep.source) {
        doc.text(`Source: ${dep.source}`, MARGIN + 6, y);
        y += 4;
      }
      y += 2;
    });
  }
  
  // Is depended on
  if (dependencies.isDependedOn.length > 0) {
    y += 3;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.dark);
    doc.text('Is used by', MARGIN + 3, y);
    y += 6;
    
    dependencies.isDependedOn.forEach(dep => {
      y = checkPageBreak(doc, y, 12);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.dark);
      doc.text(`${dep.name.toUpperCase()} — ${dep.type}`, MARGIN + 6, y);
      y += 5;
      if (dep.bomRef) {
        doc.setFontSize(8);
        doc.setTextColor(...COLORS.gray);
        doc.text(`BOM Reference: ${dep.bomRef}`, MARGIN + 6, y);
        y += 4;
      }
      if (dep.source) {
        doc.text(`Source: ${dep.source}`, MARGIN + 6, y);
        y += 4;
      }
      y += 2;
    });
  }
  
  // Is provided by
  if (dependencies.isProvidedBy.length > 0) {
    y += 3;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.dark);
    doc.text('Is provided by', MARGIN + 3, y);
    y += 6;
    
    dependencies.isProvidedBy.forEach(dep => {
      y = checkPageBreak(doc, y, 12);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.dark);
      doc.text(`${dep.name.toUpperCase()} — ${dep.type}`, MARGIN + 6, y);
      y += 5;
      if (dep.bomRef) {
        doc.setFontSize(8);
        doc.setTextColor(...COLORS.gray);
        doc.text(`BOM Reference: ${dep.bomRef}`, MARGIN + 6, y);
        y += 4;
      }
      if (dep.source) {
        doc.text(`Source: ${dep.source}`, MARGIN + 6, y);
        y += 4;
      }
      y += 2;
    });
  }
  
  return y + 5;
}

/**
 * Render specification properties
 */
function renderSpecification(doc, y, specification) {
  if (!specification || specification.length === 0) return y;
  
  y = checkPageBreak(doc, y, 30);
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.dark);
  doc.text('Specification', MARGIN, y);
  y += 8;
  
  // Use a simple table format
  specification.forEach(property => {
    y = checkPageBreak(doc, y, 10);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.dark);
    const propertyNameWidth = doc.getTextWidth(property.name);
    doc.text(property.name, MARGIN + 3, y);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.gray);
    const valueText = Array.isArray(property.values) ? property.values.join(', ') : String(property.values || '');
    const valueLines = doc.splitTextToSize(valueText, USABLE_WIDTH - propertyNameWidth - 15);
    doc.text(valueLines, MARGIN + propertyNameWidth + 10, y);
    y += Math.max(6, valueLines.length * 4);
  });
  
  return y + 5;
}

/**
 * Render a single asset subsection
 */
function renderAssetSubsection(doc, y, assetData) {
  // Check if we need a new page for this asset
  y = checkPageBreak(doc, y, 50);
  
  // Asset header with background
  const headerHeight = 12;
  doc.setFillColor(...COLORS.lightGray);
  doc.rect(MARGIN, y, USABLE_WIDTH, headerHeight, 'F');
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.dark);
  doc.text(assetData.name, MARGIN + 3, y + 8);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.gray);
  doc.text(assetData.type, MARGIN + 3 + doc.getTextWidth(assetData.name) + 8, y + 8);
  
  y += headerHeight + 8;
  
  // Code Location
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.dark);
  doc.text('Code', MARGIN, y);
  y += 6;
  y = renderCodeLocation(doc, y, assetData.codeLocation);
  
  // Compliance
  if (assetData.compliance) {
    y = renderCompliance(doc, y, assetData.compliance);
  }
  
  // Quantum Assessment
  y = renderQuantumAssessment(doc, y, assetData.quantumAssessment);
  
  // Dependencies
  if (assetData.dependencies) {
    y = renderDependencies(doc, y, assetData.dependencies);
  }
  
  // Specification
  if (assetData.specification && assetData.specification.length > 0) {
    y = renderSpecification(doc, y, assetData.specification);
  }
  
  return y + 10; // Extra space between assets
}

/**
 * Render detailed cryptographic assets section
 */
function renderDetailedAssets(doc, y) {
  const detections = getDetections();
  
  if (detections.length === 0) {
    return y;
  }
  
  y = checkPageBreak(doc, y, 30);
  
  // Section title
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.primary);
  doc.text('Detailed Cryptographic Assets', MARGIN, y);
  y += 10;
  
  // Render each asset
  detections.forEach((asset) => {
    const assetData = getDetailedAssetData(asset);
    y = renderAssetSubsection(doc, y, assetData);
  });
  
  return y;
}

/**
 * Capture charts from the page and return as base64 images
 * Reserved for future use when chart rendering is implemented
 */
// eslint-disable-next-line no-unused-vars
async function captureCharts() {
  const charts = [];
  
  try {
    // Find Carbon Charts on the page
    const chartElements = document.querySelectorAll('cv-bar-chart, cv-line-chart, cv-pie-chart, cv-area-chart');
    
    for (const chartElement of chartElements) {
      try {
        const canvas = await html2canvas(chartElement, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff'
        });
        charts.push({
          dataUrl: canvas.toDataURL('image/png'),
          type: chartElement.tagName.toLowerCase()
        });
      } catch (e) {
        console.warn('Could not capture chart:', e);
      }
    }
  } catch (e) {
    console.warn('Error capturing charts:', e);
  }
  
  return charts;
}

/**
 * Generate filename for PDF
 */
function generateFilename() {
  let name = 'cbom-report';
  if (model.codeOrigin.uploadedFileName) {
    name = model.codeOrigin.uploadedFileName.replace(/\.[^/.]+$/, '');
  } else if (model.codeOrigin.projectIdentifier) {
    name = model.codeOrigin.projectIdentifier.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  }
  return `${name}-${new Date().toISOString().split('T')[0]}.pdf`;
}

// Helper functions from original file
function getAssetType(asset) {
  const type = resolvePath(asset, 'cryptoProperties.assetType');
  if (type && type.length > 0) {
    const fullName = getTermFullName(type[0]);
    return fullName || type[0];
  }
  return 'Unspecified';
}

function getPrimitive(asset) {
  const primitive = resolvePath(asset, 'cryptoProperties.algorithmProperties.primitive');
  if (primitive && primitive.length > 0) {
    const fullName = getTermFullName(primitive[0]);
    return fullName || primitive[0];
  }
  return 'Unspecified';
}

function getLocation(asset) {
  const occurrences = resolvePath(asset, 'evidence.occurrences');
  if (occurrences && occurrences.length > 0) {
    const occ = occurrences[0];
    const filePath = occ.location || '';
    const fileName = filePath.substring(filePath.lastIndexOf('/') + 1);
    const line = occ.line || '';
    return line ? `${fileName}:${line}` : fileName;
  }
  return 'No location';
}

function formatShortType(type) {
  if (!type || type === 'Unspecified') return '-';
  return type
    .replace('Key Agreement', 'Key Agr.')
    .replace('Block Cipher', 'Block')
    .replace('Hash Function', 'Hash')
    .replace('Digital Signature', 'Signature')
    .replace('Message Authentication Code', 'MAC')
    .replace('Authenticated Encryption', 'Auth Enc.')
    .replace('Random Number Generator', 'RNG')
    .replace('Key Derivation Function', 'KDF');
}

function formatShortVector(vector) {
  if (!vector) return 'N/A';
  return vector
    .replace('HNDL', 'HNDL')
    .replace('Authentication', 'Auth')
    .replace('Key Management Lifecycle', 'KML')
    .replace('Third Party', '3rd Party')
    .replace('Crypto Agility', 'Agility')
    .replace('Compliance', 'Compl.');
}

/**
 * Generate a PDF report of the CBOM data
 * @param {Function} onProgress - Optional callback for progress updates
 * @returns {Promise} - Resolves when PDF is downloaded
 */
export async function generatePdfReport(onProgress = () => {}) {
  onProgress('Preparing PDF content...');
  
  // Create an overlay to show loading state
  const overlay = document.createElement('div');
  overlay.id = 'pdf-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(255, 255, 255, 0.95);
    z-index: 99999;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'IBM Plex Sans', sans-serif;
    font-size: 16px;
    color: #161616;
  `;
  overlay.innerHTML = '<div>Generating PDF report...</div>';
  document.body.appendChild(overlay);

  try {
    onProgress('Generating PDF...');
    
    // Create new PDF document
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    let y = MARGIN;
    
    // Render sections
    y = renderHeader(doc, y);
    y = renderSummary(doc, y);
    y = renderStatistics(doc, y);
    y = renderQuantumSecurity(doc, y);
    y = renderDataTable(doc, y);
    renderDetailedAssets(doc, y);
    
    // Note: Charts can be added later using captureCharts() if needed
    
    // Add footer to all pages
    renderFooter(doc);
    
    // Save PDF
    const filename = generateFilename();
    doc.save(filename);
    
    onProgress('PDF downloaded!');
  } catch (error) {
    console.error('Error generating PDF:', error);
    onProgress('Error generating PDF. Please try again.');
    throw error;
  } finally {
    // Clean up overlay
    if (document.body.contains(overlay)) {
      document.body.removeChild(overlay);
    }
  }
}
