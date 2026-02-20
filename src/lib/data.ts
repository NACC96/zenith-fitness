import type { WorkoutSession } from "./types";

export const WORKOUT_DATA: WorkoutSession[] = [
  // Workout 1 — Chest, Jan 25, 2026
  {
    id: "w1",
    date: "2026-01-25",
    type: "Chest",
    exercises: [
      {
        name: "Bench Press",
        sets: [
          { weight: 65, reps: 12 },
          { weight: 75, reps: 12 },
          { weight: 95, reps: 12 },
          { weight: 95, reps: 12 },
        ],
      },
      {
        name: "Incline Bench",
        sets: [
          { weight: 55, reps: 12 },
          { weight: 65, reps: 12 },
          { weight: 75, reps: 12 },
          { weight: 85, reps: 13 },
        ],
      },
      {
        name: "DB Press",
        sets: [
          { weight: 50, reps: 12 },
          { weight: 70, reps: 11 },
          { weight: 70, reps: 7 },
          { weight: 80, reps: 7 },
          { weight: 60, reps: 6 },
        ],
      },
      {
        name: "Fly Machine",
        sets: [
          { weight: 40, reps: 7 },
          { weight: 30, reps: 12 },
          { weight: 30, reps: 12 },
          { weight: 30, reps: 12 },
        ],
      },
    ],
  },

  // Workout 2 — Chest, Feb 8, 2026
  {
    id: "w2",
    date: "2026-02-08",
    type: "Chest",
    exercises: [
      {
        name: "Bench Press",
        sets: [
          { weight: 65, reps: 12 },
          { weight: 75, reps: 12 },
          { weight: 95, reps: 12 },
          { weight: 115, reps: 6 },
        ],
      },
      {
        name: "Incline Bench",
        sets: [
          { weight: 75, reps: 12 },
          { weight: 95, reps: 8 },
          { weight: 95, reps: 6 },
          { weight: 115, reps: 4 },
        ],
      },
      {
        name: "DB Press",
        sets: [
          { weight: 80, reps: 9 },
          { weight: 80, reps: 7 },
          { weight: 80, reps: 7 },
          { weight: 90, reps: 2 },
        ],
      },
      {
        name: "Fly Machine",
        sets: [
          { weight: 40, reps: 5 },
          { weight: 35, reps: 12 },
          { weight: 35, reps: 9 },
          { weight: 35, reps: 4 },
        ],
      },
    ],
  },

  // Workout 3 — Chest, Feb 15, 2026
  {
    id: "w3",
    date: "2026-02-15",
    type: "Chest",
    exercises: [
      {
        name: "Bench Press",
        sets: [
          { weight: 85, reps: 12 },
          { weight: 95, reps: 12 },
          { weight: 105, reps: 11.5 },
          { weight: 115, reps: 6 },
        ],
      },
      {
        name: "Incline Bench",
        sets: [
          { weight: 85, reps: 12 },
          { weight: 95, reps: 8 },
          { weight: 105, reps: 3 },
          { weight: 95, reps: 6 },
        ],
      },
      {
        name: "DB Press",
        sets: [
          { weight: 80, reps: 10 },
          { weight: 80, reps: 5 },
          { weight: 70, reps: 3 },
          { weight: 70, reps: 9 },
          { weight: 70, reps: 8 },
        ],
      },
      {
        name: "DB Pec Flys",
        sets: [
          { weight: 20, reps: 12 },
          { weight: 20, reps: 12 },
          { weight: 20, reps: 25 },
        ],
      },
    ],
  },

  // Workout 4 — Back, Jan 27, 2026
  {
    id: "w4",
    date: "2026-01-27",
    type: "Back",
    exercises: [
      {
        name: "Lat Pulldown",
        sets: [
          { weight: 90, reps: 12 },
          { weight: 100, reps: 10 },
          { weight: 110, reps: 8 },
          { weight: 110, reps: 7 },
        ],
      },
      {
        name: "Seated Row",
        sets: [
          { weight: 80, reps: 12 },
          { weight: 90, reps: 10 },
          { weight: 100, reps: 8 },
        ],
      },
      {
        name: "DB Row",
        sets: [
          { weight: 70, reps: 12 },
          { weight: 80, reps: 10 },
          { weight: 80, reps: 8 },
        ],
      },
    ],
  },

  // Workout 5 — Legs, Jan 29, 2026
  {
    id: "w5",
    date: "2026-01-29",
    type: "Legs",
    exercises: [
      {
        name: "Squat",
        sets: [
          { weight: 95, reps: 12 },
          { weight: 115, reps: 10 },
          { weight: 135, reps: 8 },
          { weight: 135, reps: 6 },
        ],
      },
      {
        name: "Leg Press",
        sets: [
          { weight: 180, reps: 12 },
          { weight: 200, reps: 10 },
          { weight: 220, reps: 8 },
        ],
      },
      {
        name: "Leg Curl",
        sets: [
          { weight: 60, reps: 12 },
          { weight: 70, reps: 10 },
          { weight: 70, reps: 8 },
        ],
      },
    ],
  },
];
