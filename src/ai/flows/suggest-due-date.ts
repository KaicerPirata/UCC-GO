'use server';
/**
 * @fileOverview An AI agent that suggests a due date for a new task based on its description.
 *
 * - suggestDueDate - A function that suggests a due date for a new task.
 * - SuggestDueDateInput - The input type for the suggestDueDate function.
 * - SuggestDueDateOutput - The return type for the suggestDueDate function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const SuggestDueDateInputSchema = z.object({
  taskDescription: z.string().describe('The description of the task.'),
});
export type SuggestDueDateInput = z.infer<typeof SuggestDueDateInputSchema>;

const SuggestDueDateOutputSchema = z.object({
  suggestedDueDate: z.string().describe('The suggested due date for the task in ISO 8601 format.'),
  reasoning: z.string().describe('The reasoning behind the suggested due date.'),
});
export type SuggestDueDateOutput = z.infer<typeof SuggestDueDateOutputSchema>;

export async function suggestDueDate(input: SuggestDueDateInput): Promise<SuggestDueDateOutput> {
  return suggestDueDateFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestDueDatePrompt',
  input: {
    schema: z.object({
      taskDescription: z.string().describe('The description of the task.'),
    }),
  },
  output: {
    schema: z.object({
      suggestedDueDate: z.string().describe('The suggested due date for the task in ISO 8601 format.'),
      reasoning: z.string().describe('The reasoning behind the suggested due date.'),
    }),
  },
  prompt: `Eres un asistente de IA que sugiere una fecha de vencimiento para una nueva tarea basándose en su descripción.\n\nConsidera la descripción de la tarea y estima el esfuerzo necesario para completarla. Basándote en el esfuerzo estimado, sugiere una fecha de vencimiento en formato ISO 8601. Proporciona un breve razonamiento para la fecha de vencimiento sugerida.\n\nDescripción de la tarea: {{{taskDescription}}}`,
});

const suggestDueDateFlow = ai.defineFlow<
  typeof SuggestDueDateInputSchema,
  typeof SuggestDueDateOutputSchema
>({
  name: 'suggestDueDateFlow',
  inputSchema: SuggestDueDateInputSchema,
  outputSchema: SuggestDueDateOutputSchema,
}, async input => {
  const {output} = await prompt(input);
  return output!;
});

