export interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
  explanation: string;
}

export interface DropZoneTarget {
  id: string;
  label: string; // Expected label id (e.g. 'nucleus')
  name: string;
  xPercent: number; // SVG position 0..100
  yPercent: number;
  radiusPx: number;
}

export interface DraggableLabelItem {
  id: string;
  text: string;
  correctZoneId: string;
}

export interface LessonContent {
  id: string;
  title: string;
  topic: string;
  question: {
    id: string;
    prompt: string;
    options: QuestionOption[];
  };
  diagram: {
    title: string;
    instructions: string;
    zones: DropZoneTarget[];
    labels: DraggableLabelItem[];
  };
}

export const PLANT_CELL_LESSON: LessonContent = {
  id: 'plant_cell_01',
  title: 'Parts of a Plant Cell',
  topic: 'Cell Biology',
  question: {
    id: 'q1',
    prompt: 'Which organelle is responsible for conducting photosynthesis in plant cells?',
    options: [
      {
        id: 'opt_a',
        text: 'Mitochondria',
        isCorrect: false,
        explanation: 'Mitochondria generate cellular energy (ATP) via respiration, not photosynthesis.',
      },
      {
        id: 'opt_b',
        text: 'Chloroplast',
        isCorrect: true,
        explanation: 'Chloroplasts contain chlorophyll and convert sunlight into glucose via photosynthesis.',
      },
      {
        id: 'opt_c',
        text: 'Endoplasmic Reticulum',
        isCorrect: false,
        explanation: 'The ER synthesizes and transports proteins and lipids.',
      },
      {
        id: 'opt_d',
        text: 'Centriole',
        isCorrect: false,
        explanation: 'Centrioles are typically found in animal cells, aiding cell division.',
      },
    ],
  },
  diagram: {
    title: 'Plant Cell Structure',
    instructions: 'Grab and drop each anatomical label onto its corresponding structure.',
    zones: [
      {
        id: 'zone_nucleus',
        label: 'nucleus',
        name: 'Nucleus',
        xPercent: 46,
        yPercent: 44,
        radiusPx: 56,
      },
      {
        id: 'zone_chloroplast',
        label: 'chloroplast',
        name: 'Chloroplast',
        xPercent: 24,
        yPercent: 62,
        radiusPx: 52,
      },
      {
        id: 'zone_cell_wall',
        label: 'cell_wall',
        name: 'Cell Wall',
        xPercent: 78,
        yPercent: 28,
        radiusPx: 54,
      },
    ],
    labels: [
      {
        id: 'label_nucleus',
        text: 'Nucleus',
        correctZoneId: 'zone_nucleus',
      },
      {
        id: 'label_chloroplast',
        text: 'Chloroplast',
        correctZoneId: 'zone_chloroplast',
      },
      {
        id: 'label_cell_wall',
        text: 'Cell Wall',
        correctZoneId: 'zone_cell_wall',
      },
    ],
  },
};
