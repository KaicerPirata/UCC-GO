
'use client';

import {useState} from 'react';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
import {suggestDueDate} from '@/ai/flows/suggest-due-date';
import {Calendar} from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"

export default function Home() {
  const [pendingTasks, setPendingTasks] = useState<string[]>([]);
  const [inProgressTasks, setInProgressTasks] = useState<string[]>([]);
  const [completedTasks, setCompletedTasks] = useState<string[]>([]);
  const [newTaskDescription, setNewTaskDescription] = useState<string>('');
  const [suggestedDueDate, setSuggestedDueDate] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<Date | undefined>(new Date());

    const handleDateChange = (date: Date | undefined) => {
        setDueDate(date);
    };

  const handleAddTask = async () => {
    if (newTaskDescription) {
      setPendingTasks([...pendingTasks, newTaskDescription]);
      setNewTaskDescription('');

      try {
        const aiSuggestion = await suggestDueDate({
          taskDescription: newTaskDescription,
        });
        setSuggestedDueDate(aiSuggestion.suggestedDueDate);
      } catch (error) {
        console.error('Error getting AI suggestion:', error);
        setSuggestedDueDate('Error getting suggestion');
      }
    }
  };

  const moveTask = (task: string, from: string, to: string) => {
    if (from === 'Pending') {
      setPendingTasks(pendingTasks.filter((t) => t !== task));
    } else if (from === 'In Progress') {
      setInProgressTasks(inProgressTasks.filter((t) => t !== task));
    } else if (from === 'Completed') {
      setCompletedTasks(completedTasks.filter((t) => t !== task));
    }

    if (to === 'Pending') {
      setPendingTasks([...pendingTasks, task]);
    } else if (to === 'In Progress') {
      setInProgressTasks([...inProgressTasks, task]);
    } else if (to === 'Completed') {
      setCompletedTasks([...completedTasks, task]);
    }
  };

  return (
    <main className="flex min-h-screen flex-col p-4 md:p-24 gap-4">
      <h1 className="text-2xl font-bold">TaskFlow Kanban Board</h1>

      <div className="flex gap-4">
        <input
          type="text"
          placeholder="Enter task description"
          value={newTaskDescription}
          onChange={(e) => setNewTaskDescription(e.target.value)}
          className="border rounded p-2 w-full"
        />
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-[240px] justify-start text-left font-normal",
                !dueDate && "text-muted-foreground"
              )}
            >
              {dueDate ? (
                format(dueDate, "PPP")
              ) : (
                <span>Pick a date</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start" side="bottom">
            <Calendar
              mode="single"
              selected={dueDate}
              onSelect={handleDateChange}
              disabled={(date) =>
                date > new Date()
              }
              initialFocus
            />
          </PopoverContent>
        </Popover>

        <Button onClick={handleAddTask} className="bg-teal-500 text-white rounded px-4 py-2">
          Add Task
        </Button>
      </div>

      {suggestedDueDate && <p>Suggested Due Date: {suggestedDueDate}</p>}

      <div className="flex flex-wrap gap-4">
        <KanbanColumn
          title="Pending"
          tasks={pendingTasks}
          moveTask={moveTask}
          columnId="Pending"
        />
        <KanbanColumn
          title="In Progress"
          tasks={inProgressTasks}
          moveTask={moveTask}
          columnId="In Progress"
        />
        <KanbanColumn
          title="Completed"
          tasks={completedTasks}
          moveTask={moveTask}
          columnId="Completed"
        />
      </div>
    </main>
  );
}

interface KanbanColumnProps {
  title: string;
  tasks: string[];
  moveTask: (task: string, from: string, to: string) => void;
  columnId: string;
}

function KanbanColumn({title, tasks, moveTask, columnId}: KanbanColumnProps) {
  return (
    <Card className="w-80 bg-gray-100 rounded-md shadow-sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {tasks.map((task, index) => (
          <TaskCard
            key={index}
            task={task}
            moveTask={moveTask}
            from={columnId}
          />
        ))}
      </CardContent>
    </Card>
  );
}

interface TaskCardProps {
  task: string;
  moveTask: (task: string, from: string, to: string) => void;
  from: string;
}

function TaskCard({task, moveTask, from}: TaskCardProps) {
  return (
    <Card className="bg-white rounded-md shadow-sm">
      <CardContent>
        <p>{task}</p>
        <div className="flex justify-between mt-2">
          <Button
            size="sm"
            onClick={() => moveTask(task, from, 'Pending')}
            className="bg-teal-500 text-white rounded px-2 py-1"
          >
            Pending
          </Button>
          <Button
            size="sm"
            onClick={() => moveTask(task, from, 'In Progress')}
            className="bg-teal-500 text-white rounded px-2 py-1"
          >
            In Progress
          </Button>
          <Button
            size="sm"
            onClick={() => moveTask(task, from, 'Completed')}
            className="bg-teal-500 text-white rounded px-2 py-1"
          >
            Completed
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
