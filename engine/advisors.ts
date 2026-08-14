import { z } from 'zod';
import { AdvisorAssessment, Campaign } from './domain';
import { ModelGateway } from './model';
import { playerVisibleState } from './projections';
import { canAccess } from './visibility';

const assessmentsSchema = z.object({
  assessments: z.array(z.object({
    advisorId: z.string(),
    advisorName: z.string(),
    assessment: z.string().max(900),
    confidence: z.enum(['VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH']),
    biasDisclosure: z.string().max(400),
  })).max(6),
});

export const consultAdvisors = async (
  campaign: Campaign,
  question: string,
  gateway?: ModelGateway,
): Promise<AdvisorAssessment[]> => {
  if (!question.trim()) throw new Error('An advisor question is required.');
  const advisors = campaign.state.manifest.advisors.filter((advisor) =>
    canAccess(advisor.visibility, campaign.state.manifest.playerId, campaign.state.manifest.playerId, campaign.state.gameOver));
  if (!gateway) return advisors.map((advisor) => ({
    advisorId: advisor.id,
    advisorName: advisor.name,
    assessment: `${advisor.worldview} On “${question.trim()}”, ${advisor.expertise.join(' and ')} should guide the decision, but the available evidence does not justify certainty.`,
    confidence: 'MEDIUM',
    biasDisclosure: advisor.bias,
  }));
  const result = await gateway.callJson('narrator', [
    {
      role: 'system',
      content: 'Answer as the supplied advisors. They may disagree and be wrong. Use only the player-visible packet; never infer hidden truth. Keep each assessment under 120 words and disclose the advisor bias. This is consultation, not an operational action or turn outcome.',
    },
    {
      role: 'user',
      content: JSON.stringify({ question, advisors, playerVisibleContext: playerVisibleState(campaign.state, campaign.beliefs) }),
    },
  ], assessmentsSchema, 'AdvisorAssessments');
  const allowed = new Set(advisors.map((advisor) => advisor.id));
  return result.value.assessments.filter((assessment) => allowed.has(assessment.advisorId));
};
