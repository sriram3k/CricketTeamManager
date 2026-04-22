export type PartyId = 'DMK' | 'AIADMK' | 'TVK' | 'NTK';

export interface Party {
  id: PartyId;
  name: string;
  fullName: string;
  color: string;
  barColor: string;
}

export interface AnswerOption {
  id: string;
  text: string;
  scores: Record<PartyId, number>;
}

export interface Question {
  id: number;
  topic: string;
  text: string;
  options: AnswerOption[];
}

export const PARTIES: Party[] = [
  {
    id: 'DMK',
    name: 'DMK',
    fullName: 'Dravida Munnetra Kazhagam',
    color: '#DC2626',
    barColor: '#EF4444',
  },
  {
    id: 'AIADMK',
    name: 'AIADMK',
    fullName: 'All India Anna Dravida Munnetra Kazhagam',
    color: '#16A34A',
    barColor: '#22C55E',
  },
  {
    id: 'TVK',
    name: 'TVK',
    fullName: 'Tamilaga Vettri Kazhagam',
    color: '#2563EB',
    barColor: '#3B82F6',
  },
  {
    id: 'NTK',
    name: 'NTK',
    fullName: 'Naam Tamilar Katchi',
    color: '#7C3AED',
    barColor: '#8B5CF6',
  },
];

// Scores are 0-3 per party per option.
// Max possible per party = 10 questions x 3 = 30 points -> percentage = score / 30 x 100.
// Questions are framed around documented manifesto and public policy positions.
// No option is designed to favour a single party exclusively.
export const QUESTIONS: Question[] = [
  {
    id: 1,
    topic: 'Poverty & Welfare',
    text: 'What should be the primary strategy to reduce poverty in Tamil Nadu?',
    options: [
      {
        id: '1a',
        text: 'Expand direct cash transfers and universal welfare schemes for every household',
        scores: { DMK: 3, AIADMK: 2, TVK: 1, NTK: 1 },
      },
      {
        id: '1b',
        text: 'Attract large-scale industrial investment to create permanent jobs',
        scores: { DMK: 1, AIADMK: 3, TVK: 1, NTK: 0 },
      },
      {
        id: '1c',
        text: 'Strengthen village-level self-reliance and support Tamil micro-enterprises',
        scores: { DMK: 1, AIADMK: 1, TVK: 2, NTK: 3 },
      },
      {
        id: '1d',
        text: 'Root out corruption so that existing government funds reach the intended beneficiaries',
        scores: { DMK: 0, AIADMK: 0, TVK: 3, NTK: 2 },
      },
    ],
  },
  {
    id: 2,
    topic: 'Medical Admissions (NEET)',
    text: 'What should Tamil Nadu do about NEET for medical college admissions?',
    options: [
      {
        id: '2a',
        text: 'Completely abolish NEET; Tamil Nadu should control its own medical admissions',
        scores: { DMK: 2, AIADMK: 1, TVK: 2, NTK: 3 },
      },
      {
        id: '2b',
        text: 'Retain NEET but increase weight given to Class 12 board marks alongside it',
        scores: { DMK: 3, AIADMK: 2, TVK: 2, NTK: 1 },
      },
      {
        id: '2c',
        text: 'Keep NEET but raise reservations for government-school students substantially',
        scores: { DMK: 2, AIADMK: 3, TVK: 1, NTK: 0 },
      },
      {
        id: '2d',
        text: 'Replace NEET with a state-designed aptitude test covering multiple competency areas',
        scores: { DMK: 1, AIADMK: 1, TVK: 3, NTK: 2 },
      },
    ],
  },
  {
    id: 3,
    topic: 'Language Policy',
    text: 'How should Tamil Nadu handle the role of Hindi in central government services and schools?',
    options: [
      {
        id: '3a',
        text: 'Firmly resist Hindi imposition; Tamil must have equal status in all central services',
        scores: { DMK: 2, AIADMK: 1, TVK: 2, NTK: 3 },
      },
      {
        id: '3b',
        text: 'Uphold the three-language policy while ensuring Tamil remains primary in the state',
        scores: { DMK: 3, AIADMK: 3, TVK: 2, NTK: 0 },
      },
      {
        id: '3c',
        text: 'Prioritise English proficiency for competitive employment while promoting Tamil culture',
        scores: { DMK: 1, AIADMK: 2, TVK: 3, NTK: 0 },
      },
      {
        id: '3d',
        text: 'Demand constitutional classical language status and a separate Tamil University for global Tamil studies',
        scores: { DMK: 1, AIADMK: 0, TVK: 1, NTK: 3 },
      },
    ],
  },
  {
    id: 4,
    topic: 'Alcohol Policy',
    text: 'What policy should Tamil Nadu adopt on alcohol?',
    options: [
      {
        id: '4a',
        text: 'Full prohibition  -  ban the production, sale and consumption of alcohol statewide',
        scores: { DMK: 0, AIADMK: 0, TVK: 2, NTK: 3 },
      },
      {
        id: '4b',
        text: 'Phased reduction over five years, paired with de-addiction and rehabilitation programmes',
        scores: { DMK: 3, AIADMK: 1, TVK: 3, NTK: 2 },
      },
      {
        id: '4c',
        text: 'Reform TASMAC for better safety standards; use its revenue for public welfare',
        scores: { DMK: 1, AIADMK: 3, TVK: 0, NTK: 0 },
      },
      {
        id: '4d',
        text: 'Restrict sale to licensed outlets, limit hours, and invest heavily in awareness campaigns',
        scores: { DMK: 2, AIADMK: 2, TVK: 1, NTK: 1 },
      },
    ],
  },
  {
    id: 5,
    topic: 'Agriculture',
    text: 'What is the most important support Tamil Nadu can provide to its farmers?',
    options: [
      {
        id: '5a',
        text: 'Comprehensive farm-loan waivers and increased subsidies on seeds, fertiliser and electricity',
        scores: { DMK: 3, AIADMK: 2, TVK: 1, NTK: 1 },
      },
      {
        id: '5b',
        text: 'Legally guaranteed minimum support price (MSP) for all crops grown in Tamil Nadu',
        scores: { DMK: 2, AIADMK: 3, TVK: 2, NTK: 2 },
      },
      {
        id: '5c',
        text: 'Promote natural and organic farming using traditional Tamil seeds and methods',
        scores: { DMK: 0, AIADMK: 0, TVK: 1, NTK: 3 },
      },
      {
        id: '5d',
        text: 'Build farmer-producer organisations, cold chains and direct market linkages using technology',
        scores: { DMK: 1, AIADMK: 1, TVK: 3, NTK: 0 },
      },
    ],
  },
  {
    id: 6,
    topic: "Women's Empowerment",
    text: "What is the most effective way to improve women's lives in Tamil Nadu?",
    options: [
      {
        id: '6a',
        text: 'Provide monthly financial assistance directly to women heads of households',
        scores: { DMK: 3, AIADMK: 2, TVK: 1, NTK: 1 },
      },
      {
        id: '6b',
        text: 'Strengthen law enforcement, set up fast-track courts and increase safety infrastructure',
        scores: { DMK: 1, AIADMK: 3, TVK: 2, NTK: 2 },
      },
      {
        id: '6c',
        text: 'Mandate 50 % representation for women in all elected bodies and government appointments',
        scores: { DMK: 2, AIADMK: 1, TVK: 3, NTK: 1 },
      },
      {
        id: '6d',
        text: 'Fund skill development, vocational training and employment generation targeted at women',
        scores: { DMK: 1, AIADMK: 2, TVK: 2, NTK: 2 },
      },
    ],
  },
  {
    id: 7,
    topic: 'Centre-State Relations',
    text: "How should Tamil Nadu manage its relationship with India's Central Government?",
    options: [
      {
        id: '7a',
        text: 'Assert maximum autonomy; resist central encroachment on state subjects firmly',
        scores: { DMK: 1, AIADMK: 0, TVK: 1, NTK: 3 },
      },
      {
        id: '7b',
        text: "Engage cooperatively but negotiate hard to secure Tamil Nadu's fair share of national resources",
        scores: { DMK: 3, AIADMK: 1, TVK: 2, NTK: 1 },
      },
      {
        id: '7c',
        text: 'Build strategic alliances with the national ruling party to unlock maximum development funds',
        scores: { DMK: 0, AIADMK: 3, TVK: 1, NTK: 0 },
      },
      {
        id: '7d',
        text: 'Unite southern states to collectively push for constitutional reforms on fiscal federalism',
        scores: { DMK: 2, AIADMK: 1, TVK: 3, NTK: 2 },
      },
    ],
  },
  {
    id: 8,
    topic: 'Anti-Corruption',
    text: 'What is the most effective way to reduce corruption in Tamil Nadu governance?',
    options: [
      {
        id: '8a',
        text: 'Establish an independent Lokayukta with suo-motu powers to investigate and prosecute',
        scores: { DMK: 2, AIADMK: 2, TVK: 2, NTK: 2 },
      },
      {
        id: '8b',
        text: 'Fully digitise all government services to eliminate human discretion and cash transactions',
        scores: { DMK: 1, AIADMK: 1, TVK: 3, NTK: 1 },
      },
      {
        id: '8c',
        text: 'Strengthen the Vigilance and Anti-Corruption Directorate with more resources and autonomy',
        scores: { DMK: 1, AIADMK: 3, TVK: 1, NTK: 2 },
      },
      {
        id: '8d',
        text: 'Elect leaders with no connection to past corruption to bring genuine systemic change',
        scores: { DMK: 0, AIADMK: 0, TVK: 2, NTK: 3 },
      },
    ],
  },
  {
    id: 9,
    topic: 'Environment',
    text: 'How should Tamil Nadu balance industrial growth with environmental protection?',
    options: [
      {
        id: '9a',
        text: 'Impose strict environmental clearances; reject projects that threaten ecosystems or communities',
        scores: { DMK: 1, AIADMK: 0, TVK: 1, NTK: 3 },
      },
      {
        id: '9b',
        text: 'Allow industry with mandatory real-time pollution monitoring and heavy penalties for violations',
        scores: { DMK: 2, AIADMK: 3, TVK: 2, NTK: 0 },
      },
      {
        id: '9c',
        text: 'Prioritise renewable energy and green manufacturing to grow the economy sustainably',
        scores: { DMK: 1, AIADMK: 1, TVK: 3, NTK: 1 },
      },
      {
        id: '9d',
        text: 'Give affected local communities veto power over any project that impacts their land or water',
        scores: { DMK: 3, AIADMK: 0, TVK: 1, NTK: 2 },
      },
    ],
  },
  {
    id: 10,
    topic: 'Healthcare',
    text: "What should be the top healthcare priority for Tamil Nadu's next government?",
    options: [
      {
        id: '10a',
        text: 'Universal free healthcare for every resident through fully upgraded government hospitals',
        scores: { DMK: 3, AIADMK: 1, TVK: 1, NTK: 2 },
      },
      {
        id: '10b',
        text: 'Expand health-insurance schemes giving patients a free choice between public and private hospitals',
        scores: { DMK: 1, AIADMK: 3, TVK: 2, NTK: 0 },
      },
      {
        id: '10c',
        text: 'Focus on preventive care, nutrition programmes and strengthening rural primary health centres',
        scores: { DMK: 2, AIADMK: 2, TVK: 1, NTK: 3 },
      },
      {
        id: '10d',
        text: 'Deploy telemedicine and AI-assisted diagnostics to reach underserved remote communities',
        scores: { DMK: 0, AIADMK: 1, TVK: 3, NTK: 1 },
      },
    ],
  },
];

export const MAX_SCORE_PER_PARTY = QUESTIONS.length * 3; // 30

export function calculateResults(answers: Record<number, string>): Record<PartyId, number> {
  const totals: Record<PartyId, number> = { DMK: 0, AIADMK: 0, TVK: 0, NTK: 0 };

  for (const question of QUESTIONS) {
    const selectedId = answers[question.id];
    if (!selectedId) continue;
    const option = question.options.find((o) => o.id === selectedId);
    if (!option) continue;
    for (const partyId of Object.keys(totals) as PartyId[]) {
      totals[partyId] += option.scores[partyId];
    }
  }

  const percentages: Record<PartyId, number> = { DMK: 0, AIADMK: 0, TVK: 0, NTK: 0 };
  for (const partyId of Object.keys(totals) as PartyId[]) {
    percentages[partyId] = Math.round((totals[partyId] / MAX_SCORE_PER_PARTY) * 100);
  }

  return percentages;
}

export function getTopParty(results: Record<PartyId, number>): PartyId {
  return (Object.keys(results) as PartyId[]).reduce((best, id) =>
    results[id] > results[best] ? id : best
  );
}
