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
    if (from === 'Pendiente') {
      setPendingTasks(pendingTasks.filter((t) => t !== task));
    } else if (from === 'En Progreso') {
      setInProgressTasks(inProgressTasks.filter((t) => t !== task));
    } else if (from === 'Completada') {
      setCompletedTasks(completedTasks.filter((t) => t !== task));
    }

    if (to === 'Pendiente') {
      setPendingTasks([...pendingTasks, task]);
    } else if (to === 'En Progreso') {
      setInProgressTasks([...inProgressTasks, task]);
    } else if (to === 'Completada') {
      setCompletedTasks([...completedTasks, task]);
    }
  };

  return (
    <main className="flex min-h-screen flex-col p-4 md:p-24 gap-4">
      <h1 className="text-2xl font-bold">Tablero Kanban de TaskFlow</h1>

      <div className="flex gap-4">
        <input
          type="text"
          placeholder="Ingrese la descripción de la tarea"
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
                <span>Escoge una fecha</span>
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
          Agregar Tarea
        </Button>
      </div>

      {suggestedDueDate && <p>Fecha de Vencimiento Sugerida: {suggestedDueDate}</p>}

      <div className="flex flex-wrap gap-4">
        <KanbanColumn
          title="Pendiente"
          tasks={pendingTasks}
          moveTask={moveTask}
          columnId="Pendiente"
        />
        <KanbanColumn
          title="En Progreso"
          tasks={inProgressTasks}
          moveTask={moveTask}
          columnId="En Progreso"
        />
        <KanbanColumn
          title="Completada"
          tasks={completedTasks}
          moveTask={moveTask}
          columnId="Completada"
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
            onClick={() => moveTask(task, from, 'Pendiente')}
            className="bg-teal-500 text-white rounded px-2 py-1"
          >
            Pendiente
          </Button>
          <Button
            size="sm"
            onClick={() => moveTask(task, from, 'En Progreso')}
            className="bg-teal-500 text-white rounded px-2 py-1"
          >
            En Progreso
          </Button>
          <Button
            size="sm"
            onClick={() => moveTask(task, from, 'Completada')}
            className="bg-teal-500 text-white rounded px-2 py-1"
          >
            Completada
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

