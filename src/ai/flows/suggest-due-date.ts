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
  prompt: `You are an AI assistant that suggests a due date for a new task based on its description.\n\nConsider the task description and estimate the effort required to complete the task. Based on the estimated effort, suggest a due date in ISO 8601 format. Provide a brief reasoning for the suggested due date.\n\nTask Description: {{{taskDescription}}}`,
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
