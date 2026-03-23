

import { GoogleGenAI, Type, Schema, GenerateContentResponse, ThinkingLevel } from "@google/genai";
import { TurnData, HistoryEntry, SimulationManifest, Advisor } from '../types';
import { calculateOutcome } from './mechanics';

const getClient = () => {
  // Allow local VITE env for dev, but default to localStorage for BYOK version.
  // CRITICAL SECURITY FIX: Never include the local .env key in production builds.
  const localKey = (import.meta as any).env?.DEV ? (import.meta as any).env?.VITE_GEMINI_API_KEY : null;
  const apiKey = localStorage.getItem('chronus_api_key') || localKey;
  if (!apiKey) {
    throw new Error("API_KEY is not set. Please provide a Gemini API Key.");
  }
  return new GoogleGenAI({ apiKey });
};

// === RETRY LOGIC ===
async function withRetry<T>(fn: () => Promise<T>, retries = 3, initialDelay = 2000): Promise<T> {
  let currentDelay = initialDelay;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      const isRateLimit = error.status === 429 || error.code === 429 || error.message?.includes('429') || error.message?.includes('quota') || error.status === 503;
      
      if (isRateLimit && i < retries - 1) {
        console.warn(`Gemini API Quota/Rate Limit hit. Retrying in ${currentDelay}ms... (Attempt ${i + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, currentDelay));
        currentDelay *= 2; // Exponential backoff
        continue;
      }
      throw error;
    }
  }
  throw new Error("Max retries exceeded");
}

// === UNIVERSAL SIMULATION SCHEMA ===
const entitySchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING },
    name: { type: Type.STRING },
    type: { type: Type.STRING, enum: ['Faction', 'Asset', 'Figure', 'Threat'] },
    description: { type: Type.STRING },
    power: { type: Type.INTEGER, description: "0-100. Capability/Strength." },
    loyalty: { type: Type.INTEGER, description: "0-100. Willingness/Alignment." },
    status: { type: Type.STRING, description: "Current state (e.g. 'Mobilizing', 'Striking', 'Idle')." }
  },
  required: ["id", "name", "type", "description", "power", "loyalty", "status"]
};

const turnSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    turnNumber: { type: Type.INTEGER },
    year: { type: Type.STRING },
    eventTitle: { type: Type.STRING },
    
    // The Static Rulebook
    manifest: {
      type: Type.OBJECT,
      properties: {
        genre: { type: Type.STRING },
        timeUnit: { type: Type.STRING },
        statsConfig: {
          type: Type.OBJECT,
          properties: {
            stabilityLabel: { type: Type.STRING },
            wealthLabel: { type: Type.STRING },
            supportLabel: { type: Type.STRING },
            primaryStatLabel: { type: Type.STRING }
          },
          required: ["stabilityLabel", "wealthLabel", "supportLabel", "primaryStatLabel"]
        }
      },
      required: ["genre", "timeUnit", "statsConfig"]
    },

    // The Mission Objective
    currentGoal: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING },
        description: { type: Type.STRING },
        type: { type: Type.STRING, enum: ['SURVIVAL', 'CONQUEST', 'DIPLOMACY', 'REFORM'] },
        turnsRemaining: { type: Type.INTEGER },
        totalTurns: { type: Type.INTEGER },
        status: { type: Type.STRING, enum: ['ACTIVE', 'ACHIEVED', 'FAILED'] },
        victoryCondition: { type: Type.STRING }
      },
      required: ["id", "description", "type", "turnsRemaining", "totalTurns", "status", "victoryCondition"]
    },

    // End of Goal Report
    goalResult: {
      type: Type.OBJECT,
      properties: {
        outcome: { type: Type.STRING, enum: ['VICTORY', 'DEFEAT'] },
        title: { type: Type.STRING },
        description: { type: Type.STRING }
      },
      required: ["outcome", "title", "description"]
    },

    // The Quest Log
    arcs: {
      type: Type.ARRAY,
      description: "Long-term storylines with progress bars.",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          title: { type: Type.STRING },
          currentValue: { type: Type.INTEGER },
          maxValue: { type: Type.INTEGER },
          status: { type: Type.STRING }
        },
        required: ["id", "title", "currentValue", "maxValue", "status"]
      }
    },

    news: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          source: { type: Type.STRING },
          headline: { type: Type.STRING }
        },
        required: ["source", "headline"]
      }
    },

    narrative: { type: Type.STRING, description: "3-paragraph detailed situation report." },

    advisors: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          name: { type: Type.STRING },
          role: { type: Type.STRING },
          advice: { type: Type.STRING },
          bias: { type: Type.STRING, enum: ['force', 'diplomacy', 'profit', 'innovation'] },
          status: { type: Type.STRING, description: "Active, Compromised, Deceased, etc." }
        },
        required: ["id", "name", "role", "advice", "bias", "status"]
      }
    },

    stats: {
      type: Type.OBJECT,
      properties: {
        stability: { type: Type.INTEGER },
        wealth: { type: Type.INTEGER },
        support: { type: Type.INTEGER },
        primaryStatValue: { type: Type.INTEGER },
      },
      required: ["stability", "wealth", "support", "primaryStatValue"]
    },
    statsDelta: {
      type: Type.OBJECT,
      properties: {
        stability: { type: Type.INTEGER },
        wealth: { type: Type.INTEGER },
        support: { type: Type.INTEGER },
        primaryStatValue: { type: Type.INTEGER },
      },
      required: ["stability", "wealth", "support", "primaryStatValue"]
    },
    statsReasoning: { type: Type.STRING },
    
    // The State Database
    ledger: {
      type: Type.OBJECT,
      properties: {
        allies: { type: Type.ARRAY, items: entitySchema, description: "Factions/Figures supporting the player." },
        enemies: { type: Type.ARRAY, items: entitySchema, description: "Threats, Rivals, or Hostile Factions." },
        assets: { type: Type.ARRAY, items: entitySchema, description: "Tangible resources (Armies, Fleets, Patents)." }
      },
      required: ["allies", "enemies", "assets"]
    },
    
    choices: {
      type: Type.ARRAY,
      description: "Standard choices presented to the player. Risk and cost are ADVISOR ESTIMATES, not absolute facts.",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          text: { type: Type.STRING },
          type: { type: Type.STRING, enum: ['diplomacy', 'force', 'profit', 'innovation'] },
          risk: { type: Type.STRING, enum: ['LOW', 'MEDIUM', 'HIGH', 'EXTREME'], description: "The risk level as estimated by the advisors." },
          projectedCost: { type: Type.STRING, description: "The cost as estimated by the advisors." },
          detailedDescription: { type: Type.STRING },
          forecastRange: { type: Type.STRING },
          forecastConfidence: { type: Type.STRING, enum: ['HIGH', 'MEDIUM', 'LOW', 'VOLATILE'] },
          technicalReport: { type: Type.STRING }
        },
        required: ["id", "text", "type", "risk", "detailedDescription", "forecastRange", "forecastConfidence", "technicalReport"]
      }
    },

    executionAnalysis: {
        type: Type.OBJECT,
        properties: {
            directiveType: { type: Type.STRING, enum: ['STANDARD', 'CUSTOM'] },
            perceivedRisk: { type: Type.STRING, enum: ['LOW', 'MEDIUM', 'HIGH', 'EXTREME'] },
            forecastedRange: { type: Type.STRING },
            forecastConfidence: { type: Type.STRING, enum: ['HIGH', 'MEDIUM', 'LOW', 'VOLATILE'] },
            intelModifierValue: { type: Type.INTEGER, description: "The numeric shift applied to the matrix." },
            outcomeCategory: { type: Type.STRING, enum: ['VICTORY', 'PARTIAL_SUCCESS', 'PARTIAL_FAILURE', 'CRITICAL_FAILURE'] },
            outcomeLabel: { type: Type.STRING },
            resourcesConsumed: { type: Type.STRING },
            rollValue: { type: Type.STRING, description: "The simulated d20 roll result, e.g. '3/20'" }
        },
        required: ["directiveType", "perceivedRisk", "forecastedRange", "forecastConfidence", "intelModifierValue", "outcomeCategory", "outcomeLabel", "resourcesConsumed", "rollValue"]
    },

    gameOver: { type: Type.BOOLEAN }
  },
  required: ["turnNumber", "year", "eventTitle", "manifest", "currentGoal", "arcs", "news", "narrative", "advisors", "stats", "statsDelta", "statsReasoning", "ledger", "choices", "gameOver", "executionAnalysis"]
};

const SYSTEM_INSTRUCTION = `
You are the "Chronus" Universal Divergence Engine. You are a Grand Strategy Simulation AI.

=== THE UNIVERSAL ENGINE PROTOCOL ===
You are not writing a story. You are managing a STATEFUL SIMULATION.
Every turn, you must update the "World Ledger" (Entities), "Plot Arcs", and the "Mission Goal".

1. **THE MANIFEST (Physics)**:
   - Respect the Time Unit (Months, Days, Years). Do not skip large chunks of time unless the narrative demands it.

2. **THE FORCED RESOLUTION SYSTEM**:
   - The user input now includes a **MANDATORY RESOLUTION** (a d20 roll and a mandated outcome category).
   - **YOU MUST OBEY THIS OUTCOME**.
   - If the input says "ROLL: 3/20, RESULT: CRITICAL_FAILURE", you **MUST** narrate a disaster. Do not soften the blow.
   - If the input says "ROLL: 18/20, RESULT: VICTORY", you **MUST** narrate a triumph.
   - **DO NOT** bias towards "Partial Success". If the engine says "CRITICAL_FAILURE", burn the assets.

3. **THE OBJECTIVE ENGINE (Goal Logic)**:
   - You MUST track a \`currentGoal\` (e.g., "Win the 2026 Midterms").
   - **Deadline Rule**: Every turn, decrement \`turnsRemaining\` by 1.
   - **Audit Rule**: 
     - IF \`turnsRemaining\` <= 0 OR the objective is conclusively met/failed:
       - **POPULATE** the \`goalResult\` object with a valid outcome, title, and description.
       - **GENERATE** a NEW \`currentGoal\` for the next phase.
     - ELSE (Goal is still active):
       - **OMIT** the \`goalResult\` field entirely. Do not include it in the JSON.
   - **GAME OVER RULE**: If the player suffers a CRITICAL FAILURE on a survival goal, or the narrative logically concludes in total defeat/victory, set \`gameOver: true\`.

4. **ADVISOR DYNAMICS**: 
   - **Contextual Rotation**: Select 3-4 advisors most relevant to the *current* crisis (e.g. General for war, Treasurer for debt).
   - **Role Uniqueness**: Only one person per specific title (e.g. One "Secretary of State").
   - **Character Continuity**: If a specific role (e.g. General) has been established in previous turns, YOU MUST use the same person unless they have been removed. Check the "KNOWN PERSONNEL" list.
   - **Status**: Advisors have a 'status' (Active, Compromised, Deceased). Do NOT use Deceased or Compromised advisors.

5. **THE ENTITY LOGIC (Depth)**:
   - **Calculation Rule**: Outcome = (Your Asset Power + Roll) - (Enemy Power + Difficulty).
   - If an Ally has Low Loyalty (<30), they may betray the player.
   - If an Enemy has High Power (>80), they will actively reduce Player Stats.

=== CASTING DIRECTOR PROTOCOL (REALITY ANCHOR) ===
For any Historical or Modern scenario, you must follow these STRICT CASTING RULES:
1. **BAN ON "AI NAMES"**: You are FORBIDDEN from generating generic names like "Dr. Aris Thorne" or "Senator Stone".
2. **REAL INCUMBENTS**: Use real people holding the title in that year.
3. **HYPOTHETICAL DRAFTING**: If the role is hypothetical (e.g. "Resistance Leader"), DRAFT A REAL PERSON who fits the ideology (e.g. "Stacey Abrams" or "Edward Snowden"). NEVER invent a name.
4. **NO "AI" CHARACTERS**: Unless the genre is specifically SciFi/Cyberpunk, do NOT create characters named "AI Interface" or "System".

=== NARRATIVE STYLE ===
- Tone: Serious, high-stakes.
- Focus: Use the names of the Entities defined in your Ledger.
- Detail: Be verbose (300+ words).
`;

const ADVISOR_INSTRUCTION = `
You are acting as a specific advisor in a high-stakes political/military simulation.
Your goal is to answer the player's question IN CHARACTER.

RULES:
1. Do NOT act as the "Game Engine". Do NOT output stats, ledgers, JSON, or simulation reports.
2. Do NOT output headers like "=== CHRONUS UNIVERSAL DIVERGENCE ENGINE ===".
3. Speak directly to the player (the leader).
4. **BREVITY IS KEY**: Keep your initial response under 100 words. Be direct and punchy.
5. If asked for a plan, use a short bulleted list (max 3-4 items). Do not write an essay.
6. Keep the tone consistent with your Persona and Bias.
`;

const enrichScenario = async (baseContext: string): Promise<string> => {
  const ai = getClient();
  
  const isCustom = baseContext.startsWith("CUSTOM SCENARIO");
  const coreContent = isCustom 
    ? baseContext.replace("CUSTOM SCENARIO CREATED BY PLAYER. CONTEXT: ", "").split(". INSTRUCTIONS:")[0]
    : baseContext;

  const prompt = `
    ROLE: Simulation Architect & Historian.
    INPUT SCENARIO SEED: "${coreContent}"
    OBJECTIVE: Transform this seed into a highly detailed "Classified Dossier".
    
    CRITICAL INSTRUCTIONS:
    1. **EXTRACT & PRESERVE**: Identify every specific Name, Date, and Asset listed in the Input Seed.
    2. **CASTING CALL**: Populate this world with REAL PEOPLE. No generic names.
    3. **DEFINE THE GOAL**: Identify the implicit or explicit "Victory Condition" and a reasonable timeframe (e.g., 12 Months).
    4. **STRUCTURE**: Organize into Factions, Assets, Threats, Dilemmas, and PRIMARY OBJECTIVE.
  `;

  try {
    const response = await withRetry(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { maxOutputTokens: 8192 }
    })) as GenerateContentResponse;
    return response.text || baseContext;
  } catch (e) {
    console.error("Scenario enrichment failed", e);
    return baseContext;
  }
};

export const initializeGame = async (scenarioContext: string): Promise<TurnData> => {
  const ai = getClient();
  const fullDossier = await enrichScenario(scenarioContext);

  const prompt = `
    ${SYSTEM_INSTRUCTION}
    
    === PHASE 1: GENESIS ===
    
    DOSSIER:
    ${fullDossier}
    
    TASK:
    1. **Create the Simulation Manifest**: Define genre, time unit, and stats.
    2. **Initialize Goal**: Extract the PRIMARY OBJECTIVE from the dossier. Set \`turnsRemaining\` (e.g. 12) and \`totalTurns\`.
    3. **Populate Ledger & Advisors**: Use REAL people from the dossier. Limit to 3-4 key advisors.
    4. **Generate Turn 1**: The inciting incident.
    5. **Generate Choices**: Address the dilemmas.
  `;

  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: turnSchema,
        maxOutputTokens: 20000
      }
    })) as GenerateContentResponse;

    if (!response.text) throw new Error("No response from AI");
    return JSON.parse(response.text) as TurnData;
  } catch (error) {
    console.error("Failed to init game:", error);
    throw error;
  }
};

export const processTurn = async (
  currentHistory: HistoryEntry[],
  playerChoiceText: string,
  choiceDetails: string | null,
  choiceMetadata: { risk: string; type: string; confidence: string } | null,
  customInput?: string
): Promise<TurnData> => {
  const ai = getClient();
  
  const latestState = currentHistory[currentHistory.length - 1];
  const manifest = latestState.manifestSnapshot;
  
  const recentHistory = currentHistory.slice(-10);
  const historyLog = (currentHistory.length > 10 ? "... [Prior history archived. See structured state for current world reality] ...\n" : "") + 
    recentHistory.map(h => 
      `[Turn ${h.turnNumber} | ${h.year}] Event: ${h.eventTitle}. Choice: ${h.userChoice || "None"}. Goal Status: ${h.goalSnapshot.turnsRemaining} turns left on "${h.goalSnapshot.description}".`
    ).join("\n");

  const actionDescription = customInput 
    ? `Player input custom directive: "${customInput}"\nCONTEXTUAL ANALYSIS: ${choiceDetails || 'None'}` 
    : `Player selected: "${playerChoiceText}".\nEXECUTION DETAILS: ${choiceDetails}`;

  // === CALCULATE RNG OUTCOME (CODE SIDE) ===
  const riskProfile = choiceMetadata ? choiceMetadata.risk : 'HIGH';
  const confidenceProfile = choiceMetadata ? choiceMetadata.confidence : 'MEDIUM';

  const rngResult = calculateOutcome(riskProfile, confidenceProfile);

  // === STAKES / IMPACT GUIDANCE GENERATOR ===
  const getImpactGuidance = (risk: string) => {
    switch (risk) {
        case 'LOW': return "LOW STAKES. Stat changes should be minor (+/- 1 to 5).";
        case 'MEDIUM': return "MODERATE STAKES. Stat changes should be noticeable (+/- 5 to 15).";
        case 'HIGH': return "HIGH STAKES. Stat changes should be significant (+/- 15 to 25).";
        case 'EXTREME': return "EXISTENTIAL STAKES. Stat changes can be massive (+/- 25 to 50).";
        default: return "MODERATE STAKES. Stat changes should be noticeable (+/- 5 to 15).";
    }
  };

  // Construct context about the shift so the AI can explain why it failed/succeeded unexpectedly
  let shiftContext = "";
  if (rngResult.modifier > 0) shiftContext = `INTEL FAILURE: The situation was HARDER than expected (+${rngResult.modifier} Difficulty). Narrate unexpected resistance or complications.`;
  if (rngResult.modifier < 0) shiftContext = `INTEL SURPRISE: The situation was EASIER than expected (${rngResult.modifier} Difficulty). Narrate incompetence on the enemy's part or lucky breaks.`;

  const riskContext = `
    === MANDATORY RESOLUTION ENGINE ===
    RISK PROFILE: ${riskProfile}
    INTEL CONFIDENCE: ${confidenceProfile}
    
    REALITY CHECK (FOG OF WAR):
    ${shiftContext || "Intel was accurate. No hidden variables."}
    
    FINAL D20 ROLL: ${rngResult.roll}/20
    REQUIRED OUTCOME: ${rngResult.outcome} (${rngResult.label})

    IMPACT LIMITS (STAKES):
    ${getImpactGuidance(riskProfile)}
    
    INSTRUCTIONS:
    1. You MUST accept this outcome. Do not change it.
    2. Narrate the events that lead to this specific result.
    3. In 'executionAnalysis', set:
       - 'rollValue' to "${rngResult.roll}/20"
       - 'outcomeCategory' to "${rngResult.outcome}"
       - 'intelModifierValue' to ${rngResult.modifier}
    4. STRICTLY ADHERE to the Impact Limits above when calculating 'statsDelta'.
  `;

  // AGGREGATE KNOWN ADVISORS FROM HISTORY (Character Bible)
  const knownAdvisorsMap = new Map<string, Advisor>();
  currentHistory.forEach(entry => {
    entry.advisorsSnapshot?.forEach(adv => {
       if (!knownAdvisorsMap.has(adv.name)) {
         knownAdvisorsMap.set(adv.name, adv);
       }
    });
  });

  const knownPersonnelList = Array.from(knownAdvisorsMap.values())
    .map(a => `- ${a.name} (${a.role}) [Bias: ${a.bias}]`)
    .join("\n");

  const prompt = `
    ${SYSTEM_INSTRUCTION}

    === MISSION: ADVANCE SIMULATION ===

    **SIMULATION MANIFEST**:
    ${JSON.stringify(manifest, null, 2)}

    **CURRENT GOAL (AUDIT REQUIRED IF TURNS <= 0)**:
    ${JSON.stringify(latestState.goalSnapshot, null, 2)}

    **CURRENT LEDGER**:
    ${JSON.stringify(latestState.ledgerSnapshot, null, 2)}

    **ACTIVE PLOT ARCS**:
    ${JSON.stringify(latestState.arcsSnapshot, null, 2)}
    
    **KNOWN PERSONNEL ROSTER (CHARACTER BIBLE)**:
    ${knownPersonnelList || "None established yet."}
    
    INSTRUCTIONS FOR ADVISORS:
    1. Select 3-4 advisors from the ROSTER who are relevant to the current event.
    2. If a new perspective is absolutely needed, you may recruit a new historical figure.
    3. DO NOT output two advisors with the same role/title.
    4. Respect their 'status'. Do not use deceased or compromised advisors.

    HISTORY:
    ${historyLog}

    PREVIOUS NARRATIVE:
    ${latestState.narrative}

    PLAYER DECISION:
    ${actionDescription}
    
    ${riskContext}

    TASK:
    1. **ADJUDICATE**: Apply the consequences of the FORCED OUTCOME.
    2. **UPDATE GOAL**: 
       - Decrement \`turnsRemaining\`. 
       - If \`turnsRemaining\` <= 0 OR outcome is decisive, **POPULATE goalResult** and **GENERATE NEW GOAL**.
    3. **UPDATE STATE**: Update Arcs, Entities, Stats.
    4. **ADVISORS**: Select the 3-4 most relevant advisors.
    5. **NARRATE**: Write the response.
  `;

  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: turnSchema,
        maxOutputTokens: 20000,
      }
    })) as GenerateContentResponse;

    if (!response.text) throw new Error("No response from AI");
    return JSON.parse(response.text) as TurnData;
  } catch (error) {
    console.error("Turn processing failed:", error);
    throw error;
  }
};

export const consultAdvisor = async (
    advisor: any, 
    currentContext: string,
    userQuestion: string
  ): Promise<string> => {
    const ai = getClient();
    const prompt = `
      ${ADVISOR_INSTRUCTION}
      
      === SCENARIO CONTEXT ===
      ${currentContext}
      
      === YOUR PERSONA ===
      NAME: ${advisor.name}
      ROLE: ${advisor.role}
      BIAS: ${advisor.bias} (Let this guide your tone and suggestions)
      
      === PLAYER QUESTION ===
      "${userQuestion}"
      
      RESPONSE:
    `;
    try {
      const response = await withRetry(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { 
            maxOutputTokens: 500,
            temperature: 0.7 
        }
      })) as GenerateContentResponse;
      return response.text || "No comment.";
    } catch (error) {
      console.error("Advisor chat failed:", error);
      return "Comm-link disrupted.";
    }
  };